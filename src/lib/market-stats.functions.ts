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

// Fallback seed reports so agent page looks stunning immediately even before first staff upload
export const SEED_MARKET_STATS: MarketStatsReport[] = [
  {
    id: "report-2026-09",
    month: "September 2026",
    title: "September 2026 MLS Market Stats",
    area: "Central Missouri MLS & Regional Area",
    summaryNotes:
      "Buyer demand remained steady through September with median sold prices up +4.2% month-over-month. Active inventory is experiencing a healthy autumn bump, giving buyers more selection while average days on market remains tight at 28 days.",
    pdfUrl: null,
    pdfName: "September_2026_MLS_Executive_Summary.pdf",
    pdfSize: 2450000,
    metrics: {
      medianSalePrice: "$248,500",
      medianPriceChange: "+4.2% MoM",
      avgDaysOnMarket: "28 Days",
      domChange: "-3 Days MoM",
      activeInventory: "348",
      inventoryChange: "+6.1% MoM",
      closedSales: "142",
      closedSalesChange: "+2.8% MoM",
      listToSaleRatio: "98.6%",
      monthsSupply: "2.4 Mos",
      customHighlights: [
        { label: "New Listings Added", value: "168", change: "+8.4%", isPositive: true },
        { label: "Avg Price / SqFt", value: "$158.40", change: "+3.1%", isPositive: true },
        { label: "Pending Contracts", value: "135", change: "+1.5%", isPositive: true },
      ],
    },
    graphics: [
      {
        id: "g-1",
        title: "Instagram / Facebook Post (1:1)",
        format: "Square 1:1",
        imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
        caption: "🏡 SEPTEMBER 2026 MARKET UPDATE 📈\n\nThe local real estate market continues to show strong momentum! Here's what you need to know:\n\n✨ Median Sale Price: $248,500 (+4.2% MoM)\n⏱ Avg Days on Market: 28 Days\n📦 Active Listings: 348 available homes\n🎯 List-to-Sale Ratio: 98.6%\n\nThinking about making a move before year end? DM us or call today for a custom home valuation!\n\n#MattSmithRealEstateGroup #MarketStats #RealEstateMarket #HomePrices #CentralMORealEstate",
      },
      {
        id: "g-2",
        title: "Instagram / TikTok Story (9:16)",
        format: "Story 9:16",
        imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1080&q=80",
        caption: "Swipe up or DM for your neighborhood's detailed MLS breakdown! 📊✨ #MarketUpdate #RealEstateNews",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
