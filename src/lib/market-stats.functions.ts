import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKET = "toolbox";
const STORAGE_BACKUP_PATH = "settings/market-stats.json";

export interface MarketStatMetric {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
}

export interface MarketSocialGraphic {
  id: string;
  title: string;
  format?: string; // e.g. "Instagram Post (1:1)", "Story (9:16)", "Facebook (16:9)"
  imageUrl: string;
  caption?: string;
}

export interface MarketStatsReport {
  id: string;
  month: string; // e.g. "2026-09" or "September 2026"
  title: string; // e.g. "September 2026 MLS Market Stats"
  area: string; // e.g. "Central Missouri MLS"
  summaryNotes?: string;
  pdfUrl?: string | null;
  pdfName?: string | null;
  pdfSize?: number | null;
  metrics: {
    medianSalePrice?: string;
    medianPriceChange?: string;
    avgDaysOnMarket?: string;
    domChange?: string;
    activeInventory?: string;
    inventoryChange?: string;
    closedSales?: string;
    closedSalesChange?: string;
    listToSaleRatio?: string;
    monthsSupply?: string;
    customHighlights?: MarketStatMetric[];
  };
  graphics: MarketSocialGraphic[];
  createdAt: string;
  updatedAt?: string;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const SEED_MARKET_STATS: MarketStatsReport[] = [
  {
    id: "report-lake-ozarks-2026-09",
    month: "September 2026",
    title: "September 2026 Monthly Statistics — Lake of the Ozarks",
    area: "Lake of the Ozarks & Bagnell Dam Boards of REALTORS®",
    summaryNotes:
      "Lake of the Ozarks recorded $120.3M in total sales volume across 267 closed transactions in September. Residential detached/villas reached a median sell price of $357,000 ($576,113 average), while Condos commanded $304,000 median with a 96.68% list-to-sell ratio. Total new listings increased +22.4% with 634 new properties coming to market.",
    pdfUrl: null,
    pdfName: "Lake_of_the_Ozarks_Monthly_Statistics_Report_September_2026.pdf",
    pdfSize: 3450000,
    metrics: {
      medianSalePrice: "$357,000",
      medianPriceChange: "+4.2% YTD",
      avgDaysOnMarket: "46 Days",
      domChange: "-4.9% YoY",
      activeInventory: "634 New",
      inventoryChange: "+22.4% YoY",
      closedSales: "267 Closed",
      closedSalesChange: "$120.3M Vol",
      listToSaleRatio: "95.79%",
      monthsSupply: "Lake Area",
      customHighlights: [
        { label: "Residential Median", value: "$357,000", change: "Avg: $576,113", isPositive: true },
        { label: "Condo/Timeshare Median", value: "$304,000", change: "70 Sold · $24.3M", isPositive: true },
        { label: "Total YTD Sold Volume", value: "$1.11 Billion", change: "+14.9% YoY", isPositive: true },
      ],
    },
    graphics: [
      {
        id: "g-loz-1",
        title: "Lake of the Ozarks Market Update (1:1 Square)",
        format: "Square 1:1",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        caption: "🌊 LAKE OF THE OZARKS SEPTEMBER 2026 MARKET UPDATE 🚤\n\nThe Lake real estate market had an incredible September with over $120.2M in closed volume!\n\n🏡 Residential Median: $357,000 (Avg $576,113)\n🏢 Condo Median: $304,000 (96.7% List-to-Sell)\n📦 New Listings Added: 634 properties (+22.4% YoY)\n⏱ Residential Avg DOM: 46 Days\n\nLooking to buy or sell waterfront, condos, or acreage at the Lake? DM our team today!\n\n#LakeOfTheOzarks #LOZRealEstate #MattSmithRealEstateGroup #LakeHome #WaterfrontLiving",
      },
      {
        id: "g-loz-2",
        title: "LOZ Story Highlight (9:16)",
        format: "Story 9:16",
        imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1080&q=80",
        caption: "Swipe up or DM for your Lake property's instant valuation! 📊✨ $120.3M sold in September alone. #LOZ #LakeLife",
      },
    ],
    createdAt: "2026-10-06T10:00:00.000Z",
    updatedAt: "2026-10-06T10:00:00.000Z",
  },
  {
    id: "report-phelps-2026-09",
    month: "September 2026",
    title: "September 2026 Local Market Update — Phelps County, MO",
    area: "Phelps County, MO (MARIS MLS)",
    summaryNotes:
      "Closed sales surged +28.1% in Phelps County with 41 closed homes in September. Median sales price rose +6.0% to $229,000 with sellers receiving 96.7% of list price. Active inventory stands at 200 homes for sale with a balanced 5.0 months supply of inventory.",
    pdfUrl: null,
    pdfName: "Phelps_County_Local_Market_Update_September_2026.pdf",
    pdfSize: 1850000,
    metrics: {
      medianSalePrice: "$229,000",
      medianPriceChange: "+6.0% YoY",
      avgDaysOnMarket: "64 Days",
      domChange: "+8.5% YoY",
      activeInventory: "200 Homes",
      inventoryChange: "+3.1% YoY",
      closedSales: "41 Closed",
      closedSalesChange: "+28.1% YoY",
      listToSaleRatio: "96.7%",
      monthsSupply: "5.0 Mos",
      customHighlights: [
        { label: "Closed Sales Surge", value: "41 Closed", change: "+28.1% YoY", isPositive: true },
        { label: "Average Sales Price", value: "$240,187", change: "YTD $274,108", isPositive: true },
        { label: "YTD Closed Units", value: "391 Homes", change: "+11.4% YoY", isPositive: true },
      ],
    },
    graphics: [
      {
        id: "g-phelps-1",
        title: "Phelps County Market Update (1:1 Square)",
        format: "Square 1:1",
        imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
        caption: "🏡 PHELPS COUNTY SEPTEMBER 2026 MARKET UPDATE 📈\n\nClosed home sales surged +28.1% across Phelps County!\n\n✨ Median Sold Price: $229,000 (+6.0% YoY)\n⏱ Avg Days on Market: 64 Days\n📦 Available Inventory: 200 Homes (5.0 Mos Supply)\n🎯 List-to-Sale Ratio: 96.7%\n\nCurious what your Rolla/Phelps County home is worth in today's market? Send us a DM!\n\n#PhelpsCounty #RollaMO #MattSmithRealEstateGroup #MarketStats #MissouriRealEstate",
      },
      {
        id: "g-phelps-2",
        title: "Phelps County Story (9:16)",
        format: "Story 9:16",
        imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1080&q=80",
        caption: "Closed sales UP +28.1% in Phelps County! 🏡📈 DM us for neighborhood breakdown. #RollaMO #RealEstate",
      },
    ],
    createdAt: "2026-10-05T10:00:00.000Z",
    updatedAt: "2026-10-05T10:00:00.000Z",
  },
  {
    id: "report-pulaski-2026-09",
    month: "September 2026",
    title: "September 2026 Local Market Update — Pulaski County, MO",
    area: "Pulaski County, MO (MARIS MLS)",
    summaryNotes:
      "Pulaski County posted a double-digit price gain in September with median sales price jumping +11.7% to $263,500 and average sales price climbing +10.1% to $250,328. Sellers captured a stellar 98.2% of list price with 54 closed sales and 80 new listings.",
    pdfUrl: null,
    pdfName: "Pulaski_County_Local_Market_Update_September_2026.pdf",
    pdfSize: 1920000,
    metrics: {
      medianSalePrice: "$263,500",
      medianPriceChange: "+11.7% YoY",
      avgDaysOnMarket: "48 Days",
      domChange: "+4.3% YoY",
      activeInventory: "218 Homes",
      inventoryChange: "+14.1% YoY",
      closedSales: "54 Closed",
      closedSalesChange: "-5.3% YoY",
      listToSaleRatio: "98.2%",
      monthsSupply: "4.0 Mos",
      customHighlights: [
        { label: "Median Price Gain", value: "$263,500", change: "+11.7% YoY", isPositive: true },
        { label: "New Listings Added", value: "80 Listings", change: "+5.3% YoY", isPositive: true },
        { label: "List-to-Sale Ratio", value: "98.2%", change: "Near Full Asking", isPositive: true },
      ],
    },
    graphics: [
      {
        id: "g-pulaski-1",
        title: "Pulaski County Market Update (1:1 Square)",
        format: "Square 1:1",
        imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
        caption: "🏡 PULASKI COUNTY SEPTEMBER 2026 MARKET UPDATE 📈\n\nHome prices in Pulaski County saw strong double-digit growth in September!\n\n✨ Median Sold Price: $263,500 (+11.7% YoY)\n⏱ Avg Days on Market: 48 Days\n📦 Available Inventory: 218 Homes (4.0 Mos Supply)\n🎯 List-to-Sale Ratio: 98.2%\n\nThinking about buying near Fort Leonard Wood, Waynesville, or St. Robert? DM our team!\n\n#PulaskiCounty #FortLeonardWood #WaynesvilleMO #StRobertMO #MattSmithRealEstateGroup #MarketStats",
      },
      {
        id: "g-pulaski-2",
        title: "Pulaski County Story (9:16)",
        format: "Story 9:16",
        imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1080&q=80",
        caption: "Prices UP +11.7% in Pulaski County! 📊✨ DM us for Fort Leonard Wood area stats! #FLW #WaynesvilleMO",
      },
    ],
    createdAt: "2026-10-05T09:00:00.000Z",
    updatedAt: "2026-10-05T09:00:00.000Z",
  },
];


export const getPublicMarketStatsReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketStatsReport[]> => {
    try {
      const sb = await admin();

      // 1. Try DB table first
      const { data: dbRows, error: dbError } = await sb
        .from("toolbox_market_stats")
        .select("*")
        .order("created_at", { ascending: false });

      if (!dbError && Array.isArray(dbRows) && dbRows.length > 0) {
        return dbRows.map((r: any) => ({
          id: r.id,
          month: r.month,
          title: r.title,
          area: r.area || "MLS Market Area",
          summaryNotes: r.summary_notes || r.description,
          pdfUrl: r.pdf_url,
          pdfName: r.pdf_name,
          pdfSize: r.pdf_size,
          metrics: typeof r.metrics === "object" && r.metrics ? r.metrics : {},
          graphics: Array.isArray(r.graphics) ? r.graphics : [],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }

      // 2. Fallback to Storage JSON
      const { data: storageFile, error: storageErr } = await sb
        .storage
        .from(BUCKET)
        .download(STORAGE_BACKUP_PATH);

      if (!storageErr && storageFile) {
        const text = await storageFile.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      return SEED_MARKET_STATS;
    } catch {
      return SEED_MARKET_STATS;
    }
  },
);

const reportValidator = (d: {
  id?: string;
  month: string;
  title: string;
  area?: string;
  summaryNotes?: string;
  pdfUrl?: string | null;
  pdfName?: string | null;
  pdfSize?: number | null;
  metrics: {
    medianSalePrice?: string;
    medianPriceChange?: string;
    avgDaysOnMarket?: string;
    domChange?: string;
    activeInventory?: string;
    inventoryChange?: string;
    closedSales?: string;
    closedSalesChange?: string;
    listToSaleRatio?: string;
    monthsSupply?: string;
    customHighlights?: Array<{
      label: string;
      value: string;
      change?: string;
      isPositive?: boolean;
    }>;
  };
  graphics: Array<{
    id: string;
    title: string;
    format?: string;
    imageUrl: string;
    caption?: string;
  }>;
}) =>
  z
    .object({
      id: z.string().optional(),
      month: z.string(),
      title: z.string(),
      area: z.string().optional(),
      summaryNotes: z.string().optional(),
      pdfUrl: z.string().nullable().optional(),
      pdfName: z.string().nullable().optional(),
      pdfSize: z.number().nullable().optional(),
      metrics: z.object({
        medianSalePrice: z.string().optional(),
        medianPriceChange: z.string().optional(),
        avgDaysOnMarket: z.string().optional(),
        domChange: z.string().optional(),
        activeInventory: z.string().optional(),
        inventoryChange: z.string().optional(),
        closedSales: z.string().optional(),
        closedSalesChange: z.string().optional(),
        listToSaleRatio: z.string().optional(),
        monthsSupply: z.string().optional(),
        customHighlights: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
              change: z.string().optional(),
              isPositive: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
      graphics: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          format: z.string().optional(),
          imageUrl: z.string(),
          caption: z.string().optional(),
        }),
      ),
    })
    .parse(d);

export const saveMarketStatsReport = createServerFn({ method: "POST" })
  .validator(reportValidator)
  .handler(async ({ data }) => {
    const sb = await admin();
    const id = data.id || `report-${Date.now()}`;
    const now = new Date().toISOString();

    const reportObj: MarketStatsReport = {
      id,
      month: data.month,
      title: data.title,
      area: data.area || "MLS Market Area",
      summaryNotes: data.summaryNotes || "",
      pdfUrl: data.pdfUrl || null,
      pdfName: data.pdfName || null,
      pdfSize: data.pdfSize || null,
      metrics: data.metrics || {},
      graphics: data.graphics || [],
      createdAt: now,
      updatedAt: now,
    };

    // 1. Fetch current list from storage to maintain full list
    let allReports: MarketStatsReport[] = [];
    try {
      const { data: file } = await sb.storage.from(BUCKET).download(STORAGE_BACKUP_PATH);
      if (file) {
        const parsed = JSON.parse(await file.text());
        if (Array.isArray(parsed)) allReports = parsed;
      }
    } catch {}

    if (allReports.length === 0) {
      allReports = [...SEED_MARKET_STATS];
    }

    const existingIndex = allReports.findIndex((r) => r.id === id);
    if (existingIndex >= 0) {
      reportObj.createdAt = allReports[existingIndex].createdAt || now;
      allReports[existingIndex] = reportObj;
    } else {
      allReports.unshift(reportObj);
    }

    // Save to storage JSON backup
    const jsonBuf = Buffer.from(JSON.stringify(allReports, null, 2));
    await sb.storage.from(BUCKET).upload(STORAGE_BACKUP_PATH, jsonBuf, {
      upsert: true,
      contentType: "application/json",
    });

    // 2. Try DB upsert if table exists
    try {
      await sb.from("toolbox_market_stats").upsert({
        id,
        month: data.month,
        title: data.title,
        area: data.area || "MLS Market Area",
        summary_notes: data.summaryNotes || "",
        pdf_url: data.pdfUrl || null,
        pdf_name: data.pdfName || null,
        pdf_size: data.pdfSize || null,
        metrics: data.metrics,
        graphics: data.graphics,
        updated_at: now,
      });
    } catch {}

    return { success: true, report: reportObj };
  });

export const deleteMarketStatsReport = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();

    // 1. Delete from storage JSON
    try {
      const { data: file } = await sb.storage.from(BUCKET).download(STORAGE_BACKUP_PATH);
      if (file) {
        let allReports: MarketStatsReport[] = JSON.parse(await file.text());
        if (Array.isArray(allReports)) {
          allReports = allReports.filter((r) => r.id !== data.id);
          const jsonBuf = Buffer.from(JSON.stringify(allReports, null, 2));
          await sb.storage.from(BUCKET).upload(STORAGE_BACKUP_PATH, jsonBuf, {
            upsert: true,
            contentType: "application/json",
          });
        }
      }
    } catch {}

    // 2. Delete from DB table if exists
    try {
      await sb.from("toolbox_market_stats").delete().eq("id", data.id);
    } catch {}

    return { success: true };
  });
