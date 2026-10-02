/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_API_VERSION = "v19.0";
const GRAPH_BASE_URL = "https://graph.facebook.com";

// ── 1. Get Meta Config & Connected Pages ────────────────────────
export const getMetaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const appId = process.env.META_APP_ID || "2004401023558912";
    const hasSecret = Boolean(process.env.META_APP_SECRET);

    // Fetch saved page configurations
    const { data: pages, error } = await sb
      .from("meta_page_configs")
      .select(
        "id, page_id, page_name, brand_tag, instagram_username, is_active, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (error && error.code !== "42P01") {
      console.warn("[meta-social] Error fetching page configs:", error.message);
    }

    return {
      appId,
      hasSecret,
      pages: pages || [],
    };
  });

// ── 2. Test & Save Page Connection ──────────────────────────────
export const connectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      pageId: z.string().trim().min(3, "Page ID is required"),
      pageAccessToken: z.string().trim().min(10, "Page Access Token is required"),
      brandTag: z.string().optional().default("MSREG PP"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const trimmedPageId = data.pageId.trim();
    const trimmedToken = data.pageAccessToken.trim();

    // 1. Verify credentials against Meta Graph API
    const verifyUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${trimmedPageId}?fields=id,name,fan_count,picture,instagram_business_account{id,username}&access_token=${encodeURIComponent(
      trimmedToken,
    )}`;

    const res = await fetch(verifyUrl);
    const metaResponse = (await res.json()) as any;

    if (!res.ok || metaResponse.error) {
      const errMsg =
        metaResponse.error?.message || "Failed to verify Facebook Page credentials with Meta.";
      console.error("[meta-social] Verification error:", metaResponse.error);
      throw new Error(`Meta API Error: ${errMsg}`);
    }

    const pageName = metaResponse.name || "Connected Facebook Page";
    const instagramAccountId = metaResponse.instagram_business_account?.id || null;
    const instagramUsername = metaResponse.instagram_business_account?.username || null;

    // 2. Upsert into meta_page_configs table
    const { data: savedPage, error: saveErr } = await sb
      .from("meta_page_configs")
      .upsert(
        {
          page_id: trimmedPageId,
          page_name: pageName,
          page_access_token: trimmedToken,
          brand_tag: data.brandTag || "MSREG PP",
          instagram_account_id: instagramAccountId,
          instagram_username: instagramUsername,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "page_id" },
      )
      .select("id, page_id, page_name, brand_tag, instagram_username, is_active")
      .single();

    if (saveErr) {
      console.error("[meta-social] Error saving page config:", saveErr);
      throw new Error(`Failed to save page connection: ${saveErr.message}`);
    }

    return {
      success: true,
      page: savedPage,
      metaDetails: {
        fanCount: metaResponse.fan_count,
        pictureUrl: metaResponse.picture?.data?.url,
      },
    };
  });

// ── 3. Disconnect Page ──────────────────────────────────────────
export const disconnectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { error } = await sb.from("meta_page_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    return { success: true };
  });

// ── 4. Publish Post to Facebook Page ────────────────────────────
export const publishPostToMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      contentItemId: z.string().uuid().optional(),
      pageId: z.string().optional(),
      brandTag: z.string().optional(),
      message: z.string().min(1, "Post message or caption is required"),
      mediaUrl: z.string().url().optional().or(z.literal("")),
      mediaType: z.enum(["photo", "video", "status"]).optional().default("status"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Find the page to publish to
    let query = sb.from("meta_page_configs").select("*").eq("is_active", true);

    if (data.pageId) {
      query = query.eq("page_id", data.pageId);
    } else if (data.brandTag) {
      query = query.eq("brand_tag", data.brandTag);
    }

    const { data: pageRows, error: pageErr } = await query.limit(1);

    if (pageErr || !pageRows || pageRows.length === 0) {
      throw new Error(
        "No active connected Facebook Page found. Please connect your Facebook Page in Meta Social Settings first.",
      );
    }

    const targetPage = pageRows[0];
    const { page_id: pageId, page_access_token: token } = targetPage;

    let postId = "";
    let permalinkUrl = "";

    // Publish to Meta Graph API
    if (data.mediaType === "photo" && data.mediaUrl) {
      // Photo Post
      const photoEndpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}/photos`;
      const form = new URLSearchParams();
      form.append("url", data.mediaUrl);
      form.append("caption", data.message);
      form.append("access_token", token);

      const res = await fetch(photoEndpoint, {
        method: "POST",
        body: form,
      });

      const resData = (await res.json()) as any;
      if (!res.ok || resData.error) {
        throw new Error(resData.error?.message || "Failed to publish photo to Facebook Page.");
      }

      postId = resData.post_id || resData.id;
      permalinkUrl = `https://www.facebook.com/${postId}`;
    } else {
      // Standard Feed Post
      const feedEndpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}/feed`;
      const form = new URLSearchParams();
      form.append("message", data.message);
      if (data.mediaUrl) {
        form.append("link", data.mediaUrl);
      }
      form.append("access_token", token);

      const res = await fetch(feedEndpoint, {
        method: "POST",
        body: form,
      });

      const resData = (await res.json()) as any;
      if (!res.ok || resData.error) {
        throw new Error(resData.error?.message || "Failed to publish post to Facebook Page.");
      }

      postId = resData.id;
      permalinkUrl = `https://www.facebook.com/${postId}`;
    }

    // Record published post in database
    await sb
      .from("meta_published_posts")
      .insert({
        content_item_id: data.contentItemId || null,
        page_id: pageId,
        facebook_post_id: postId,
        permalink_url: permalinkUrl,
        message: data.message,
        media_type: data.mediaType,
        media_url: data.mediaUrl || null,
        published_by: context.userId,
      })
      .catch((err: any) =>
        console.warn("[meta-social] Note: failed to log meta_published_posts:", err),
      );

    // If attached to a content calendar item, mark as published
    if (data.contentItemId) {
      await sb
        .from("content_items")
        .update({
          status: "published",
          published_post_id: postId,
          published_post_url: permalinkUrl,
        })
        .eq("id", data.contentItemId)
        .catch((err: any) =>
          console.warn("[meta-social] Note: failed to update content_items status:", err),
        );
    }

    return {
      success: true,
      postId,
      permalinkUrl,
      pageName: targetPage.page_name,
    };
  });

// ── 5. Get Facebook Page Analytics & Insights ───────────────────
export const getPageAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ pageId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    let query = sb.from("meta_page_configs").select("*").eq("is_active", true);
    if (data.pageId) {
      query = query.eq("page_id", data.pageId);
    }

    const { data: pageRows } = await query.limit(1);

    if (!pageRows || pageRows.length === 0) {
      return {
        connected: false,
        message: "No connected Facebook Page. Configure your Page Access Token to see analytics.",
      };
    }

    const page = pageRows[0];
    const { page_id: pageId, page_access_token: token, page_name: pageName } = page;

    try {
      // 1. Fetch Page Info & Follower Counts
      const pageInfoRes = await fetch(
        `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}?fields=id,name,fan_count,followers_count,picture.type(large)&access_token=${encodeURIComponent(
          token,
        )}`,
      );
      const pageInfo = (await pageInfoRes.json()) as any;

      // 2. Fetch Recent Posts with Engagement Counts
      const postsRes = await fetch(
        `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}/posts?limit=15&fields=id,message,created_time,permalink_url,shares,attachments{media,type,url},reactions.summary(total_count),comments.summary(total_count)&access_token=${encodeURIComponent(
          token,
        )}`,
      );
      const postsData = (await postsRes.json()) as any;

      const posts = (postsData.data || []).map((p: any) => ({
        id: p.id,
        message: p.message || "(No text caption)",
        createdTime: p.created_time,
        permalinkUrl: p.permalink_url || `https://facebook.com/${p.id}`,
        imageUrl: p.attachments?.data?.[0]?.media?.image?.src || null,
        likesCount: p.reactions?.summary?.total_count ?? 0,
        commentsCount: p.comments?.summary?.total_count ?? 0,
        sharesCount: p.shares?.count ?? 0,
      }));

      // Calculate totals from recent posts
      const totalLikes = posts.reduce((acc: number, p: any) => acc + p.likesCount, 0);
      const totalComments = posts.reduce((acc: number, p: any) => acc + p.commentsCount, 0);
      const totalShares = posts.reduce((acc: number, p: any) => acc + p.sharesCount, 0);

      return {
        connected: true,
        pageId,
        pageName: pageInfo.name || pageName,
        pictureUrl: pageInfo.picture?.data?.url || null,
        fanCount: pageInfo.fan_count ?? 0,
        followersCount: pageInfo.followers_count ?? pageInfo.fan_count ?? 0,
        recentStats: {
          totalPosts: posts.length,
          totalLikes,
          totalComments,
          totalShares,
          totalEngagements: totalLikes + totalComments + totalShares,
        },
        posts,
      };
    } catch (err: any) {
      console.error("[meta-social] Analytics fetch error:", err);
      return {
        connected: true,
        pageId,
        pageName,
        error: err.message || "Failed to fetch analytics from Meta Graph API.",
      };
    }
  });
