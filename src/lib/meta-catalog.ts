import { createClient } from "@supabase/supabase-js";

export interface RuusterListRecord {
  id: string;
  listingNumber?: string;
  mlsRecordId?: string;
  firstAddress?: string;
  secondAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  postalCode?: string;
  price?: number;
  oldPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square?: number | null;
  lotSizeAcres?: number | null;
  type?: string;
  status?: string;
  mlsStatus?: string;
  label?: string;
  labelUpdatedAt?: string;
  media?: string[];
  mediaCount?: number;
  newConstruction?: boolean;
}

export interface RuusterDetailRecord {
  id: string;
  mlsRecordId?: string;
  listingNumber?: string;
  firstAddress?: string;
  secondAddress?: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  price?: number;
  oldPrice?: number | null;
  label?: string;
  type?: string;
  subType?: string;
  unifiedSubtype?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square?: number | null;
  lotSizeAcres?: number | null;
  description?: string;
  status?: string;
  mlsStatus?: string;
  location?: {
    type?: string;
    coordinates?: [number, number]; // [lat, lng]
  };
  media?: Array<{
    imagePath?: string;
    fileName?: string;
    MediaCategory?: string;
    Order?: number;
  }>;
}

export interface MetaListingRow {
  id: string;
  listing_number: string;
  first_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  old_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lot_acres: number | null;
  property_type: string | null;
  status: string | null;
  label: string | null;
  images: string[];
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  excluded: boolean;
  missing_fields: string[];
  last_seen_at: string;
  updated_at?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  totalFetched: number;
  newCount: number;
  updatedCount: number;
  removedCount: number;
  errors: string[];
  durationMs: number;
}

// XML escaping helper
export function escapeXml(unsafe: unknown): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Geocode address fallback using Nominatim
export async function geocodeAddressFallback(
  address: string,
  city: string,
  state: string,
  zip: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = [address, city, state, zip].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MSREG-Catalog-Feed/1.0 (info@mattsmithrealestategroup.com)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch (err) {
    console.warn("[MetaSync] Geocode fallback error:", err);
  }
  return null;
}

// Fetch all active/coming soon listings from Ruuster List API
export async function fetchAllRuusterListings(sessionId: string): Promise<RuusterListRecord[]> {
  const records: RuusterListRecord[] = [];
  let page = 1;

  while (true) {
    const url = new URL("https://mattsmithrealestategroup.ruuster.com/api/listings");
    url.searchParams.set(
      "address",
      JSON.stringify({
        label: "EXRT02",
        value: "EXRT02",
        source: "listOfficeMlsId",
        data: { mlsId: "506b0b52-1e61-4343-b474-578626ae1fdf" },
      }),
    );
    url.searchParams.set("priceMax", "0");
    url.searchParams.set("priceMin", "0");
    url.searchParams.append("status", "Active");
    url.searchParams.append("status", "ComingSoon");
    url.searchParams.set("type", "all");
    url.searchParams.set("view", "list");
    url.searchParams.set("listingsPerPage", "48");
    url.searchParams.set("page", page.toString());
    url.searchParams.set("isNeededSendToCRM", "false");
    url.searchParams.set("slug", "unassigned");

    const res = await fetch(url.toString(), {
      headers: {
        Origin: "https://mattsmithrealestategroup.com",
        Referer: "https://mattsmithrealestategroup.com",
        "X-Request-Id": crypto.randomUUID(),
        "X-Session-Id": sessionId,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Ruuster list API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.records)) {
      throw new Error("Invalid response format from Ruuster list API");
    }

    records.push(...data.records);

    if (records.length >= data.totalCount || data.records.length === 0) {
      break;
    }
    page++;
  }

  return records;
}

// Fetch single listing detail from Ruuster Detail API
export async function fetchRuusterListingDetail(
  id: string,
  sessionId: string,
): Promise<RuusterDetailRecord | null> {
  const detailUrl = `https://mattsmithrealestategroup.ruuster.com/api/listings/${id}?isUseLegacyDetails=false&slug=unassigned`;
  const res = await fetch(detailUrl, {
    headers: {
      Origin: "https://mattsmithrealestategroup.com",
      Referer: "https://mattsmithrealestategroup.com",
      "X-Request-Id": crypto.randomUUID(),
      "X-Session-Id": sessionId,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    console.error(`Ruuster detail API failed for ${id} with status ${res.status}`);
    return null;
  }

  return (await res.json()) as RuusterDetailRecord;
}

// Parse missing fields for catalog compliance
export function detectMissingFields(
  item: Partial<MetaListingRow>,
  isLand: boolean,
): string[] {
  const missing: string[] = [];
  if (!item.first_address) missing.push("address");
  if (!item.city) missing.push("city");
  if (!item.zip) missing.push("zip");
  if (!item.price || item.price <= 0) missing.push("price");
  if (!item.description || item.description.trim().length === 0) missing.push("description");
  if (item.latitude == null || item.longitude == null) missing.push("coordinates");
  if (!item.images || item.images.length === 0) missing.push("images");
  if (!isLand) {
    if (item.bedrooms == null) missing.push("bedrooms");
    if (item.bathrooms == null) missing.push("bathrooms");
  }
  return missing;
}

// Run the full synchronization pipeline
export async function syncMetaCatalogListings(supabaseClient: any): Promise<SyncResult> {
  const startTime = Date.now();
  const sessionId = crypto.randomUUID();
  const errors: string[] = [];

  let records: RuusterListRecord[] = [];
  try {
    records = await fetchAllRuusterListings(sessionId);
  } catch (err: any) {
    const errorMsg = `Failed to fetch listings from Ruuster: ${err.message}`;
    errors.push(errorMsg);

    // Step 4: If API errors or returns 0 listings, don't wipe anything; log the run
    await supabaseClient.from("meta_feed_runs").insert({
      run_time: new Date().toISOString(),
      listing_count: 0,
      errors: [errorMsg],
    });

    return {
      success: false,
      message: errorMsg,
      totalFetched: 0,
      newCount: 0,
      updatedCount: 0,
      removedCount: 0,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // Safety check: if 0 listings returned, DO NOT wipe anything!
  if (records.length === 0) {
    const errorMsg = "Ruuster API returned 0 listings. Sync aborted to protect existing catalog data.";
    errors.push(errorMsg);

    await supabaseClient.from("meta_feed_runs").insert({
      run_time: new Date().toISOString(),
      listing_count: 0,
      errors: [errorMsg],
    });

    return {
      success: false,
      message: errorMsg,
      totalFetched: 0,
      newCount: 0,
      updatedCount: 0,
      removedCount: 0,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // Fetch all existing rows in meta_listings to identify new vs changed
  const { data: existingRows, error: fetchErr } = await supabaseClient
    .from("meta_listings")
    .select("id, listing_number, price, status, label, updated_at, latitude, longitude, description, images");

  if (fetchErr) {
    const errorMsg = `Database read error on meta_listings: ${fetchErr.message}`;
    errors.push(errorMsg);
    await supabaseClient.from("meta_feed_runs").insert({
      run_time: new Date().toISOString(),
      listing_count: records.length,
      errors: [errorMsg],
    });
    return {
      success: false,
      message: errorMsg,
      totalFetched: records.length,
      newCount: 0,
      updatedCount: 0,
      removedCount: 0,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  const existingMap = new Map<string, any>();
  if (existingRows) {
    for (const row of existingRows) {
      existingMap.set(row.id, row);
    }
  }

  const nowIso = new Date().toISOString();
  let newCount = 0;
  let updatedCount = 0;
  const activeIds = new Set<string>();

  for (const r of records) {
    activeIds.add(r.id);
    const existing = existingMap.get(r.id);

    // Determine if we need to fetch detail endpoint:
    // 1. Completely new listing
    // 2. Existing listing missing coordinates or description
    // 3. Price, status, or label changed
    const isNew = !existing;
    const isPriceChanged = existing && existing.price !== r.price;
    const isStatusChanged = existing && existing.status !== (r.status || r.mlsStatus);
    const isLabelChanged = existing && existing.label !== r.label;
    const isMissingDetails =
      existing &&
      (existing.latitude == null ||
        existing.longitude == null ||
        !existing.description ||
        !existing.images ||
        existing.images.length === 0);

    const needsDetail = isNew || isPriceChanged || isStatusChanged || isLabelChanged || isMissingDetails;

    let detail: RuusterDetailRecord | null = null;
    if (needsDetail) {
      // 300ms pause between calls to respect rate limit
      await new Promise((resolve) => setTimeout(resolve, 300));
      detail = await fetchRuusterListingDetail(r.id, sessionId);
    }

    const listingNumber = detail?.mlsRecordId || detail?.listingNumber || r.listingNumber || r.mlsRecordId || "";
    const firstAddress = detail?.firstAddress || r.firstAddress || null;
    const city = detail?.city || r.city || null;
    const state = detail?.state || r.state || null;
    const zip = detail?.postalCode || r.postalCode || r.zip || null;
    const price = detail?.price != null ? detail.price : r.price != null ? r.price : null;
    const oldPrice = detail?.oldPrice != null ? detail.oldPrice : r.oldPrice != null ? r.oldPrice : null;
    const bedrooms = detail?.bedrooms != null ? detail.bedrooms : r.bedrooms != null ? r.bedrooms : null;
    const bathrooms = detail?.bathrooms != null ? detail.bathrooms : r.bathrooms != null ? r.bathrooms : null;
    const sqft = detail?.square != null ? detail.square : r.square != null ? r.square : null;
    const lotAcres = detail?.lotSizeAcres != null ? detail.lotSizeAcres : r.lotSizeAcres != null ? r.lotSizeAcres : null;
    const propertyType = detail?.type || r.type || "Residential";
    const status = detail?.status || detail?.mlsStatus || r.status || r.mlsStatus || "Active";
    const label = detail?.label || r.label || null;
    const description = detail?.description || existing?.description || null;

    // Collect images (up to 20)
    let images: string[] = [];
    if (detail?.media && Array.isArray(detail.media)) {
      for (const m of detail.media) {
        if (m && m.imagePath) {
          images.push(m.imagePath);
          if (images.length >= 20) break;
        }
      }
    } else if (r.media && Array.isArray(r.media)) {
      images = r.media.slice(0, 20);
    } else if (existing?.images) {
      images = existing.images;
    }

    // Coordinates: pull from detail location, existing, or fallback geocode
    let latitude: number | null = existing?.latitude ?? null;
    let longitude: number | null = existing?.longitude ?? null;

    if (detail?.location?.coordinates && Array.isArray(detail.location.coordinates) && detail.location.coordinates.length >= 2) {
      latitude = detail.location.coordinates[0];
      longitude = detail.location.coordinates[1];
    }

    if ((latitude == null || longitude == null) && firstAddress && city && state) {
      const geocoded = await geocodeAddressFallback(firstAddress, city, state, zip || "");
      if (geocoded) {
        latitude = geocoded.lat;
        longitude = geocoded.lng;
      }
    }

    const isLand = (propertyType || "").toLowerCase() === "land";
    const missingFields = detectMissingFields(
      { first_address: firstAddress, city, zip, price, description, latitude, longitude, images, bedrooms, bathrooms },
      isLand,
    );

    const upsertPayload: Partial<MetaListingRow> = {
      id: r.id,
      listing_number: listingNumber,
      first_address: firstAddress,
      city,
      state,
      zip,
      price,
      old_price: oldPrice,
      bedrooms,
      bathrooms,
      sqft,
      lot_acres: lotAcres,
      property_type: propertyType,
      status,
      label,
      images,
      description,
      latitude,
      longitude,
      missing_fields: missingFields,
      last_seen_at: nowIso,
      updated_at: nowIso,
    };

    // If it is new, ensure excluded defaults to false
    if (isNew) {
      upsertPayload.excluded = false;
    }

    const { error: upsertErr } = await supabaseClient
      .from("meta_listings")
      .upsert(upsertPayload, { onConflict: "id" });

    if (upsertErr) {
      errors.push(`Failed upsert for listing ${r.id}: ${upsertErr.message}`);
    } else {
      if (isNew) newCount++;
      else updatedCount++;
    }
  }

  // Step 3: Listings no longer returned in Ruuster get status='removed'
  let removedCount = 0;
  if (existingRows) {
    const toRemove = existingRows.filter((row: any) => !activeIds.has(row.id) && row.status !== "removed");
    if (toRemove.length > 0) {
      const removeIds = toRemove.map((row: any) => row.id);
      const { error: removeErr } = await supabaseClient
        .from("meta_listings")
        .update({ status: "removed", updated_at: nowIso })
        .in("id", removeIds);

      if (removeErr) {
        errors.push(`Failed to mark removed listings: ${removeErr.message}`);
      } else {
        removedCount = toRemove.length;
      }
    }
  }

  // Log run in meta_feed_runs
  await supabaseClient.from("meta_feed_runs").insert({
    run_time: nowIso,
    listing_count: records.length,
    errors: errors.length > 0 ? errors : [],
  });

  return {
    success: errors.length === 0,
    message: `Sync complete. ${records.length} active listings processed (${newCount} new, ${updatedCount} updated, ${removedCount} removed).`,
    totalFetched: records.length,
    newCount,
    updatedCount,
    removedCount,
    errors,
    durationMs: Date.now() - startTime,
  };
}

// Generate the Meta Home Listings XML from active, non-excluded listings
export function generateMetaListingsXml(listings: MetaListingRow[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<listings>\n  <title>Matt Smith Real Estate Group Meta Listings</title>\n  <link rel="self" href="https://mattsmithrealestategroup.com"/>\n`;

  for (const item of listings) {
    const listingNumber = item.listing_number || "";
    const name = `${item.first_address || ""}, ${item.city || ""}, ${item.state || ""} ${item.zip || ""}`
      .replace(/,\s*,/g, ",")
      .trim();
    const isLand = (item.property_type || "").toLowerCase() === "land";
    const propertyType = isLand ? "land" : "house";
    const priceStr = `${item.price || 0} USD`;
    const propertyUrl = `https://mattsmithrealestategroup.com/featured-listings/?propertyId=${item.id}`;

    xml += `  <listing>\n`;
    xml += `    <home_listing_id>${escapeXml(listingNumber)}</home_listing_id>\n`;
    xml += `    <name>${escapeXml(name)}</name>\n`;
    xml += `    <availability>for_sale</availability>\n`;
    xml += `    <listing_type>for_sale_by_agent</listing_type>\n`;
    xml += `    <description>${escapeXml(item.description || "")}</description>\n`;
    xml += `    <address format="simple">\n`;
    xml += `      <component name="addr1">${escapeXml(item.first_address || "")}</component>\n`;
    xml += `      <component name="city">${escapeXml(item.city || "")}</component>\n`;
    xml += `      <component name="region">${escapeXml(item.state || "")}</component>\n`;
    xml += `      <component name="postal_code">${escapeXml(item.zip || "")}</component>\n`;
    xml += `      <component name="country">United States</component>\n`;
    xml += `    </address>\n`;
    xml += `    <neighborhood>${escapeXml(item.city || "")}</neighborhood>\n`;

    if (item.latitude != null && item.longitude != null) {
      xml += `    <latitude>${item.latitude}</latitude>\n`;
      xml += `    <longitude>${item.longitude}</longitude>\n`;
    }

    xml += `    <price>${priceStr}</price>\n`;
    xml += `    <url>${escapeXml(propertyUrl)}</url>\n`;
    xml += `    <property_type>${propertyType}</property_type>\n`;

    if (!isLand) {
      if (item.bedrooms != null) {
        xml += `    <num_beds>${item.bedrooms}</num_beds>\n`;
      }
      if (item.bathrooms != null) {
        xml += `    <num_baths>${item.bathrooms}</num_baths>\n`;
      }
      if (item.sqft != null && item.sqft > 0) {
        xml += `    <area_size>${item.sqft}</area_size>\n`;
        xml += `    <area_unit>sq_ft</area_unit>\n`;
      }
    }

    if (Array.isArray(item.images)) {
      for (const imgUrl of item.images.slice(0, 20)) {
        if (imgUrl) {
          xml += `    <image>\n      <url>${escapeXml(imgUrl)}</url>\n    </image>\n`;
        }
      }
    }

    xml += `  </listing>\n`;
  }

  xml += `</listings>\n`;
  return xml;
}
