/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_API_VERSION = "v19.0";
const GRAPH_BASE_URL = "https://graph.facebook.com";

// Helper to format Meta Graph API error messages with helpful, human-friendly guidance
function formatMetaErrorMessage(error: any, pageName?: string): string {
  const code = error?.code;
  const rawMsg = error?.message || "Meta API request failed";

  if (
    code === 190 ||
    rawMsg.toLowerCase().includes("session has expired") ||
    rawMsg.toLowerCase().includes("error validating access token") ||
    rawMsg.toLowerCase().includes("session is invalid")
  ) {
    const target = pageName ? ` for "${pageName}"` : "";
    return `Facebook access token${target} has expired. Temporary Graph API Explorer tokens automatically expire at midnight PDT. Please generate a permanent, never-expiring token in Meta Business Suite -> System Users (or Meta App) and reconnect the page in Meta Settings.`;
  }
  return rawMsg;
}

// ── 1. Get Meta Config & Connected Pages ────────────────────────
export const getMetaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const appId = process.env.META_APP_ID || "2004401023558912";
    const hasSecret = Boolean(process.env.META_APP_SECRET);
    const envPageId = process.env.META_PAGE_ID;

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

    let finalPages = pages || [];
    if (finalPages.length === 0 && envPageId) {
      finalPages = [
        {
          id: "env-default",
          page_id: envPageId,
          page_name: "Integrity Property Management",
          brand_tag: "Default",
          instagram_username: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }

    return {
      appId,
      hasSecret,
      pages: finalPages,
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
    let finalToken = data.pageAccessToken.trim();
    let resolvedPageId = trimmedPageId;

    const appId = process.env.META_APP_ID || "2004401023558912";
    const appSecret = process.env.META_APP_SECRET;

    // 0. If App ID & Secret are available, attempt to exchange candidate token for a long-lived token
    let workingToken = finalToken;
    if (appId && appSecret) {
      try {
        const exchangeUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(
          finalToken,
        )}`;
        const exRes = await fetch(exchangeUrl);
        const exData = (await exRes.json()) as any;
        if (exRes.ok && exData.access_token) {
          console.log("[meta-social] Successfully exchanged token for long-lived 60-day token");
          workingToken = exData.access_token;
        }
      } catch (exErr) {
        console.warn("[meta-social] Token exchange attempt skipped or failed:", exErr);
      }
    }

    // 1. Check if token can access /me/accounts to extract permanent Page Access Token
    try {
      const accountsUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(
        workingToken,
      )}`;
      const accountsRes = await fetch(accountsUrl);
      const accountsData = (await accountsRes.json()) as any;

      if (accountsRes.ok && Array.isArray(accountsData.data) && accountsData.data.length > 0) {
        const matchedPage =
          accountsData.data.find((p: any) => p.id === trimmedPageId) ||
          (accountsData.data.length === 1 ? accountsData.data[0] : null);

        if (matchedPage?.access_token) {
          resolvedPageId = matchedPage.id;
          finalToken = matchedPage.access_token;
          console.log(
            `[meta-social] Acquired permanent Page Access Token for "${matchedPage.name}" (${resolvedPageId}) via /me/accounts`,
          );
        }
      }
    } catch (accountsErr) {
      console.warn("[meta-social] /me/accounts lookup error:", accountsErr);
    }

    // 2. Verify credentials directly against Meta Graph API
    const verifyUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${resolvedPageId}?fields=id,name,fan_count,picture,instagram_business_account{id,username}&access_token=${encodeURIComponent(
      finalToken,
    )}`;

    const res = await fetch(verifyUrl);
    const metaResponse = (await res.json()) as any;

    if (!res.ok || metaResponse.error) {
      let errMsg =
        metaResponse.error?.message || "Failed to verify Facebook Page credentials with Meta.";
      if (
        metaResponse.error?.code === 190 ||
        errMsg.toLowerCase().includes("session has expired")
      ) {
        errMsg =
          "Session has expired (temporary Graph API Explorer tokens expire at midnight PDT). Please generate a permanent token in Meta Business Suite -> System Users (or Meta App).";
      } else if (metaResponse.error?.code === 100 || errMsg.includes("pages_read_engagement")) {
        errMsg =
          "Missing 'pages_read_engagement' permission. In Meta, ensure 'pages_read_engagement' and 'pages_manage_posts' are granted.";
      }
      console.error("[meta-social] Verification error:", metaResponse.error);
      throw new Error(`Meta API Error: ${errMsg}`);
    }

    const pageName = metaResponse.name || "Connected Facebook Page";
    const instagramAccountId = metaResponse.instagram_business_account?.id || null;
    const instagramUsername = metaResponse.instagram_business_account?.username || null;

    // 3. Upsert into meta_page_configs table
    const { data: savedPage, error: saveErr } = await sb
      .from("meta_page_configs")
      .upsert(
        {
          page_id: resolvedPageId,
          page_name: pageName,
          page_access_token: finalToken,
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
      firstComment: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // 1. Fetch all active connected Facebook Pages
    const { data: allActivePages, error: pagesErr } = await sb
      .from("meta_page_configs")
      .select("*")
      .eq("is_active", true);

    if (pagesErr) {
      console.error("[meta-social] Error fetching pages:", pagesErr);
      throw new Error(`Failed to load connected pages: ${pagesErr.message}`);
    }

    let targetPages: any[] = [];

    if (data.pageId) {
      targetPages = (allActivePages || []).filter((p: any) => p.page_id === data.pageId);
    } else if (data.brandTag) {
      const b = data.brandTag.toUpperCase().trim();
      if (b === "MSREG ALL" || b === "ALL") {
        // Publish to ALL connected pages (both PP and LOZ)
        targetPages = allActivePages || [];
      } else if (b === "LOZ") {
        targetPages = (allActivePages || []).filter(
          (p: any) =>
            p.brand_tag?.toUpperCase() === "LOZ" ||
            p.page_name?.toLowerCase().includes("lake of the ozarks"),
        );
      } else if (b === "PP" || b === "MSREG") {
        targetPages = (allActivePages || []).filter(
          (p: any) =>
            p.brand_tag?.toUpperCase() === "PP" ||
            !p.page_name?.toLowerCase().includes("lake of the ozarks"),
        );
      } else {
        targetPages = (allActivePages || []).filter((p: any) => p.brand_tag?.toUpperCase() === b);
        if (targetPages.length === 0 && allActivePages && allActivePages.length > 0) {
          targetPages = [allActivePages[0]];
        }
      }
    } else if (allActivePages && allActivePages.length > 0) {
      targetPages = [allActivePages[0]];
    }

    if (targetPages.length === 0) {
      throw new Error(
        `No connected Facebook Page found for brand "${data.brandTag || "default"}". Please connect your Page in Meta Social Settings.`,
      );
    }

    const results: Array<{
      pageId: string;
      pageName: string;
      postId: string;
      permalinkUrl: string;
    }> = [];

    // 2. Publish to each target page
    for (const page of targetPages) {
      const { page_id: pageId, page_access_token: token, page_name: pageName } = page;
      let postId = "";
      let permalinkUrl = "";

      if (data.mediaType === "photo" && data.mediaUrl) {
        // Photo post
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
          console.error(`[meta-social] Error publishing to ${pageName}:`, resData.error);
          throw new Error(formatMetaErrorMessage(resData.error, pageName));
        }

        postId = resData.post_id || resData.id;
        permalinkUrl = `https://www.facebook.com/${postId}`;
      } else if (data.mediaType === "video" && data.mediaUrl) {
        // Native Video post via Facebook Video API
        const videoEndpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}/videos`;
        const form = new URLSearchParams();
        form.append("file_url", data.mediaUrl);
        form.append("description", data.message);
        form.append("access_token", token);

        const res = await fetch(videoEndpoint, {
          method: "POST",
          body: form,
        });

        const resData = (await res.json()) as any;
        if (!res.ok || resData.error) {
          console.error(`[meta-social] Error publishing video to ${pageName}:`, resData.error);
          throw new Error(formatMetaErrorMessage(resData.error, pageName));
        }

        postId = resData.id;
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
          console.error(`[meta-social] Error publishing to ${pageName}:`, resData.error);
          throw new Error(formatMetaErrorMessage(resData.error, pageName));
        }

        postId = resData.id;
        permalinkUrl = `https://www.facebook.com/${postId}`;
      }

      // Optional First Comment (e.g. link in comments, disclosures, agent contact)
      if (data.firstComment && data.firstComment.trim() && postId) {
        try {
          const commentEndpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${postId}/comments`;
          const cForm = new URLSearchParams();
          cForm.append("message", data.firstComment.trim());
          cForm.append("access_token", token);
          const cRes = await fetch(commentEndpoint, {
            method: "POST",
            body: cForm,
          });
          const cData = (await cRes.json()) as any;
          if (!cRes.ok || cData.error) {
            console.warn(`[meta-social] Note: first comment warning for ${pageName}:`, cData.error);
          } else {
            console.log(`[meta-social] First comment posted to ${pageName} (${postId})`);
          }
        } catch (cErr: any) {
          console.warn(`[meta-social] Note: failed to post first comment to ${pageName}:`, cErr);
        }
      }

      // Record in meta_published_posts
      try {
        await sb.from("meta_published_posts").insert({
          content_item_id: data.contentItemId || null,
          page_id: pageId,
          facebook_post_id: postId,
          permalink_url: permalinkUrl,
          message: data.message,
          media_type: data.mediaType,
          media_url: data.mediaUrl || null,
          published_by: context.userId,
        });
      } catch (err: any) {
        console.warn(
          `[meta-social] Note: failed to log meta_published_posts for ${pageName}:`,
          err,
        );
      }

      results.push({ pageId, pageName, postId, permalinkUrl });
    }

    // 3. If attached to a content calendar item, mark as published
    if (data.contentItemId && results.length > 0) {
      const combinedUrls = results.map((r) => r.permalinkUrl).join(", ");
      const combinedIds = results.map((r) => r.postId).join(", ");

      try {
        await sb
          .from("content_items")
          .update({
            status: "published",
            published_post_id: combinedIds,
            published_post_url: combinedUrls,
            meta_first_comment: data.firstComment || null,
          })
          .eq("id", data.contentItemId);
      } catch (err: any) {
        console.warn("[meta-social] Note: failed to update content_items status:", err);
      }
    }

    return {
      success: true,
      publishedPages: results,
      postId: results[0]?.postId || "",
      permalinkUrl: results[0]?.permalinkUrl || "",
      pageName: results.map((r) => r.pageName).join(" & "),
    };
  });

// ── 4b. Post Comment to Live Facebook Post ──────────────────────
export const postCommentToMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      contentItemId: z.string().uuid().optional(),
      postId: z.string().optional(),
      message: z.string().min(1, "Comment text is required"),
      brandTag: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: allActivePages, error: pagesErr } = await sb
      .from("meta_page_configs")
      .select("*")
      .eq("is_active", true);

    if (pagesErr || !allActivePages || allActivePages.length === 0) {
      throw new Error("No connected Facebook Pages found.");
    }

    let postIds: string[] = [];
    if (data.postId) {
      postIds = data.postId
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (data.contentItemId) {
      const { data: item } = await sb
        .from("content_items")
        .select("published_post_id")
        .eq("id", data.contentItemId)
        .single();
      if (item?.published_post_id) {
        postIds = item.published_post_id
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }

    if (postIds.length === 0) {
      throw new Error("No live Facebook post found to comment on.");
    }

    const successes: Array<{ postId: string; commentId: string; pageName: string }> = [];

    for (const rawId of postIds) {
      // Determine target page
      let targetPage = allActivePages[0];
      if (data.brandTag) {
        const b = data.brandTag.toUpperCase().trim();
        const found = allActivePages.find(
          (p: any) =>
            p.brand_tag?.toUpperCase() === b ||
            (b === "LOZ" && p.page_name?.toLowerCase().includes("lake of the ozarks")),
        );
        if (found) targetPage = found;
      }

      const commentEndpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${rawId}/comments`;
      const form = new URLSearchParams();
      form.append("message", data.message.trim());
      form.append("access_token", targetPage.page_access_token);

      const res = await fetch(commentEndpoint, {
        method: "POST",
        body: form,
      });

      const resData = (await res.json()) as any;
      if (!res.ok || resData.error) {
        console.error(`[meta-social] Error posting comment to ${rawId}:`, resData.error);
        throw new Error(formatMetaErrorMessage(resData.error, targetPage.page_name));
      }

      successes.push({
        postId: rawId,
        commentId: resData.id,
        pageName: targetPage.page_name,
      });
    }

    return {
      success: true,
      comments: successes,
      message: `Posted comment to ${successes.length} live Facebook post(s)!`,
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

    let page = pageRows?.[0];
    if (!page && process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN) {
      page = {
        page_id: process.env.META_PAGE_ID,
        page_access_token: process.env.META_PAGE_ACCESS_TOKEN,
        page_name: "Integrity Property Management",
      };
    }

    if (!page) {
      return {
        connected: false,
        message: "No connected Facebook Page. Configure your Page Access Token to see analytics.",
      };
    }

    const { page_id: pageId, page_access_token: token, page_name: pageName } = page;

    try {
      // 1. Fetch Page Info & Follower Counts
      const pageInfoRes = await fetch(
        `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}?fields=id,name,fan_count,followers_count,picture.type(large)&access_token=${encodeURIComponent(
          token,
        )}`,
      );
      const pageInfo = (await pageInfoRes.json()) as any;
      if (!pageInfoRes.ok || pageInfo.error) {
        throw new Error(formatMetaErrorMessage(pageInfo.error, pageName));
      }

      // 2. Fetch Recent Posts with Engagement Counts
      const postsRes = await fetch(
        `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${pageId}/posts?limit=15&fields=id,message,created_time,permalink_url,shares,attachments{media,type,url},reactions.summary(total_count),comments.summary(total_count)&access_token=${encodeURIComponent(
          token,
        )}`,
      );
      const postsData = (await postsRes.json()) as any;
      if (!postsRes.ok || postsData.error) {
        throw new Error(formatMetaErrorMessage(postsData.error, pageName));
      }

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
        brandTag: page.brand_tag,
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
