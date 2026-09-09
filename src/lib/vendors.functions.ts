import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function checkAdminOrMarketing(context: any) {
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const canManage = (roleRows ?? []).some(
    (r: any) => r.role === "admin" || r.role === "marketing_coordinator",
  );
  if (!canManage) throw new Error("Forbidden: Admin or Marketing Coordinator required");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// 1. List all vendors & categories for admin
export const listAdminVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();

    const [
      { data: vendors, error: vErr },
      { data: categories, error: cErr },
      { data: requests, error: rErr },
    ] = await Promise.all([
      sb
        .from("vendors")
        .select("*, category:vendor_categories(*)")
        .order("name", { ascending: true }),
      sb
        .from("vendor_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      sb
        .from("vendor_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (vErr) throw vErr;
    if (cErr) throw cErr;
    if (rErr) throw rErr;

    return {
      vendors: vendors ?? [],
      categories: categories ?? [],
      requests: requests ?? [],
    };
  });

// 2. Save Vendor (Insert or Update)
const SaveVendorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Vendor name required").max(200),
  category_id: z.string().uuid("Category required"),
  region: z.string().min(1, "Region required"),
  primary_contact: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().min(1, "Phone number required").max(50),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  website: z.string().trim().max(255).nullable().optional().or(z.literal("")),
  specialty_notes: z.string().trim().max(2000).nullable().optional(),
  is_preferred: z.boolean().default(false),
  status: z.enum(["active", "flagged", "archived"]).default("active"),
});

export const saveVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveVendorSchema.parse(d))
  .handler(async ({ data, context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();

    const payload: any = {
      name: data.name.trim(),
      category_id: data.category_id,
      region: data.region,
      primary_contact: data.primary_contact?.trim() || null,
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      website: data.website?.trim() || null,
      specialty_notes: data.specialty_notes?.trim() || null,
      is_preferred: data.is_preferred,
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: updated, error } = await sb
        .from("vendors")
        .update(payload)
        .eq("id", data.id)
        .select("*, category:vendor_categories(*)")
        .single();
      if (error) throw error;
      return { ok: true, vendor: updated };
    } else {
      payload.created_by = context.userId;
      const { data: inserted, error } = await sb
        .from("vendors")
        .insert(payload)
        .select("*, category:vendor_categories(*)")
        .single();
      if (error) throw error;
      return { ok: true, vendor: inserted };
    }
  });

// 3. Delete Vendor
export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();
    const { error } = await sb.from("vendors").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// 4. Save Vendor Category
const SaveCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Category name required").max(100),
  slug: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(50).nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const saveVendorCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveCategorySchema.parse(d))
  .handler(async ({ data, context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();

    const payload = {
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      icon: data.icon?.trim() || "Wrench",
      sort_order: data.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: updated, error } = await sb
        .from("vendor_categories")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return { ok: true, category: updated };
    } else {
      const { data: inserted, error } = await sb
        .from("vendor_categories")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return { ok: true, category: inserted };
    }
  });

// 5. Delete Category
export const deleteVendorCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();

    // Check if any vendors exist in category
    const { count } = await sb
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);

    if ((count ?? 0) > 0) {
      throw new Error(`Cannot delete category: ${count} vendor(s) are still assigned to it.`);
    }

    const { error } = await sb.from("vendor_categories").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// 6. Bulk Import Vendors
const BulkImportSchema = z.object({
  vendors: z.array(
    z.object({
      name: z.string().trim().min(1),
      category_name: z.string().trim().min(1),
      region: z.string().trim().min(1),
      primary_contact: z.string().trim().nullable().optional(),
      phone: z.string().trim().min(1),
      email: z.string().trim().nullable().optional(),
      website: z.string().trim().nullable().optional(),
      specialty_notes: z.string().trim().nullable().optional(),
      is_preferred: z.boolean().optional(),
    }),
  ),
});

export const bulkImportVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BulkImportSchema.parse(d))
  .handler(async ({ data, context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();

    // Fetch or create categories
    const { data: existingCategories = [] } = await sb
      .from("vendor_categories")
      .select("id, name, slug");

    const categoriesList = [...(existingCategories as any[])];
    const categoryByName = new Map<string, string>();
    const categoryBySlug = new Map<string, string>();

    const indexCategory = (c: { id: string; name: string; slug: string }) => {
      categoryByName.set(c.name.toLowerCase().trim(), c.id);
      categoryBySlug.set(c.slug.toLowerCase().trim(), c.id);
    };

    for (const c of categoriesList) {
      indexCategory(c);
    }

    let nextSortOrder = (categoriesList.length + 1) * 10;
    const recordsToInsert: any[] = [];

    for (const item of data.vendors) {
      const cleanCatName = item.category_name.trim();
      const rawSlug = cleanCatName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const lowerCatName = cleanCatName.toLowerCase();

      // 1. Exact name match
      let catId = categoryByName.get(lowerCatName);

      // 2. Exact slug match
      if (!catId && rawSlug) {
        catId = categoryBySlug.get(rawSlug);
      }

      // 3. Smart fuzzy prefix/partial match against existing categories
      if (!catId) {
        const matched = categoriesList.find((c) => {
          const cLower = c.name.toLowerCase();
          const cSlug = c.slug.toLowerCase();
          // e.g. "Appliance Repair" matches "Appliance Repair & Installation"
          // e.g. "Roofing" matches "Roofing & Gutters"
          // e.g. "HVAC" matches "HVAC Heating & Cooling"
          // e.g. "Inspectors" matches "Home Inspectors"
          return (
            cLower.includes(lowerCatName) ||
            lowerCatName.includes(cLower) ||
            (rawSlug && (cSlug.startsWith(rawSlug) || rawSlug.startsWith(cSlug)))
          );
        });

        if (matched) {
          catId = matched.id;
        }
      }

      // 4. Auto-create category if not found
      if (!catId) {
        // Ensure slug is unique
        let uniqueSlug = rawSlug || "category";
        if (categoryBySlug.has(uniqueSlug)) {
          uniqueSlug = `${uniqueSlug}-${Math.random().toString(36).substring(2, 6)}`;
        }

        const { data: newCat, error: catErr } = await sb
          .from("vendor_categories")
          .insert({
            name: cleanCatName,
            slug: uniqueSlug,
            icon: "Wrench",
            sort_order: nextSortOrder,
          })
          .select("id, name, slug")
          .single();

        if (catErr || !newCat) {
          // If insert conflicted on unique constraint, query by slug or name as last resort
          const { data: fallbackCat } = await sb
            .from("vendor_categories")
            .select("id, name, slug")
            .or(`slug.eq."${uniqueSlug}",name.ilike."${cleanCatName}"`)
            .maybeSingle();

          if (fallbackCat) {
            catId = fallbackCat.id;
            indexCategory(fallbackCat);
            categoriesList.push(fallbackCat);
          } else {
            throw new Error(`Could not create or find category "${cleanCatName}": ${catErr?.message || "Unknown error"}`);
          }
        } else {
          catId = newCat.id;
          indexCategory(newCat);
          categoriesList.push(newCat);
          nextSortOrder += 10;
        }
      }

      // Normalize region
      let normalizedRegion = "st_robert_rolla";
      const rLower = (item.region || "").toLowerCase();
      if (
        rLower.includes("lake") ||
        rLower.includes("ozark") ||
        rLower.includes("osage") ||
        rLower.includes("camdenton") ||
        rLower === "lake_of_the_ozarks"
      ) {
        normalizedRegion = "lake_of_the_ozarks";
      }

      recordsToInsert.push({
        category_id: catId,
        region: normalizedRegion,
        name: item.name.trim(),
        primary_contact: item.primary_contact?.trim() || null,
        phone: item.phone.trim(),
        email: item.email?.trim() || null,
        website: item.website?.trim() || null,
        specialty_notes: item.specialty_notes?.trim() || null,
        is_preferred: !!item.is_preferred,
        status: "active",
        created_by: context.userId,
      });
    }

    const { data: inserted, error: insErr } = await sb
      .from("vendors")
      .insert(recordsToInsert)
      .select();

    if (insErr) throw insErr;

    return {
      ok: true,
      importedCount: inserted?.length || recordsToInsert.length,
    };
  });

// 7. Review Vendor Request (Approve or Reject)
const ReviewRequestSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().trim().max(1000).nullable().optional(),
});

export const reviewVendorRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ReviewRequestSchema.parse(d))
  .handler(async ({ data, context }) => {
    await checkAdminOrMarketing(context);
    const sb = await admin();

    const { data: req, error: reqErr } = await sb
      .from("vendor_requests")
      .select("*")
      .eq("id", data.requestId)
      .single();

    if (reqErr || !req) throw new Error("Request not found");

    if (data.decision === "approved") {
      if (req.request_type === "add") {
        // Create vendor from request payload
        await sb.from("vendors").insert({
          name: req.vendor_name,
          category_id: req.category_id,
          region: req.region || "st_robert_rolla",
          primary_contact: req.primary_contact,
          phone: req.phone || "",
          email: req.email,
          website: req.website,
          specialty_notes: req.specialty_notes,
          status: "active",
          created_by: req.user_id || context.userId,
        });
      } else if (req.request_type === "remove" && req.vendor_id) {
        // Archive or remove vendor
        await sb
          .from("vendors")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", req.vendor_id);
      } else if (req.request_type === "flag" && req.vendor_id) {
        // Mark vendor as flagged
        await sb
          .from("vendors")
          .update({ status: "flagged", updated_at: new Date().toISOString() })
          .eq("id", req.vendor_id);
      }
    }

    // Update request row
    const { error: updErr } = await sb
      .from("vendor_requests")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.reviewNotes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);

    if (updErr) throw updErr;

    return { ok: true, status: data.decision };
  });
