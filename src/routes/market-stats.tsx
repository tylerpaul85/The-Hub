import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  FileText,
  Share2,
  TrendingUp,
  Calendar,
  Building,
  Clock,
  Home,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  BarChart2,
  Eye,
  Percent,
  Search,
  Maximize2,
  X,
  FileSpreadsheet,
  Waves,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  getPublicMarketStatsReports,
  type MarketStatsReport,
  type MarketSocialGraphic,
} from "@/lib/market-stats.functions";

export const Route = createFileRoute("/market-stats")({
  component: MarketStatsPage,
  head: () => ({
    meta: [
      { title: "MLS Market Stats & Social Kits — MSREG Agent Hub" },
      {
        name: "description",
        content:
          "Monthly MLS market statistics, executive summaries, downloadable PDF reports, and ready-to-post social media graphic kits for agents across Lake of the Ozarks, Phelps County, and Pulaski County.",
      },
    ],
  }),
});

// Detailed breakdown data for multi-page Lake of the Ozarks MLS report
const LOZ_CATEGORY_DATA = [
  {
    category: "Residential / Villa / Townhome",
    badge: "Primary Homes",
    medianPrice: "$357,000",
    avgPrice: "$576,113",
    soldCount: "157",
    volume: "$90,449,805",
    newListings: "315",
    dom: "46 Days",
    listToSell: "95.79%",
    highlight: "Avg price up +3.11% YoY ($576k)",
  },
  {
    category: "Condo / Timeshare",
    badge: "Waterfront & Complexes",
    medianPrice: "$304,000",
    avgPrice: "$347,454",
    soldCount: "70",
    volume: "$24,321,750",
    newListings: "116",
    dom: "78 Days",
    listToSell: "96.68%",
    highlight: "Strong 96.7% list-to-sell capture",
  },
  {
    category: "Lots & Land / Acreage",
    badge: "Development & Lots",
    medianPrice: "$42,500",
    avgPrice: "$86,019",
    soldCount: "33",
    volume: "$2,838,622",
    newListings: "164",
    dom: "141 Days",
    listToSell: "89.81%",
    highlight: "+59.2% surge in new land listings",
  },
  {
    category: "Commercial / Business",
    badge: "Commercial",
    medianPrice: "$225,000",
    avgPrice: "$350,400",
    soldCount: "5",
    volume: "$1,752,000",
    newListings: "28",
    dom: "147 Days",
    listToSell: "80.83%",
    highlight: "$44.5M sold YTD in Commercial",
  },
  {
    category: "All Property Types Combined",
    badge: "Total Market",
    medianPrice: "$295,000",
    avgPrice: "$450,494",
    soldCount: "267",
    volume: "$120,281,927",
    newListings: "634",
    dom: "69 Days",
    listToSell: "94.92%",
    highlight: "$120.3M monthly volume ($1.11B YTD)",
  },
];

function MarketStatsPage() {
  const { user } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [previewGraphic, setPreviewGraphic] = useState<MarketSocialGraphic | null>(null);
  const [lozCategoryTab, setLozCategoryTab] = useState("all");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["public-market-stats-reports"],
    queryFn: () => getPublicMarketStatsReports(),
    staleTime: 60_000,
  });

  // Set default selected report to latest (first in list)
  const activeReport: MarketStatsReport | null = useMemo(() => {
    if (!reports || reports.length === 0) return null;
    if (selectedReportId) {
      const found = reports.find((r) => r.id === selectedReportId);
      if (found) return found;
    }
    return reports[0];
  }, [reports, selectedReportId]);

  const isLakeOfOzarks = Boolean(
    activeReport?.area?.toLowerCase().includes("lake of the ozarks") ||
      activeReport?.title?.toLowerCase().includes("lake of the ozarks") ||
      activeReport?.id?.includes("lake-ozarks"),
  );

  const copyCaption = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Caption copied to clipboard! Ready to paste on Instagram or Facebook.");
  };

  const downloadFile = (url: string, filename: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "market-stats-asset";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloading ${filename || "asset"}…`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[320px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.18),transparent)] pointer-events-none -z-10" />

      {/* Top Floating Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/80 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/agents"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs group"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
              <span>Agent Hub</span>
            </Link>

            <div className="h-4 w-px bg-border/80 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2">
              <img src={logo} alt="MSREG" className="h-6 w-auto object-contain opacity-90" />
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Market Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <Link
                to="/_authenticated/toolbox"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 text-xs font-medium transition-colors"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Manage MLS Stats</span>
              </Link>
            )}

            {activeReport?.pdfUrl ? (
              <Button
                size="sm"
                onClick={() =>
                  downloadFile(activeReport.pdfUrl!, activeReport.pdfName || `${activeReport.month}_MLS_Report.pdf`)
                }
                className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold h-8 shadow-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download PDF
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="border-gold/40 text-gold hover:bg-gold/10 text-xs h-8"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Print Market Sheet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-8">
        {/* Market Region Switcher Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gold" />
              Select Market Area / County Report:
            </span>
            <span className="text-[11px] text-muted-foreground">
              Official MLS Data as of October 2026
            </span>
          </div>

          {/* Regional Area Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {reports.map((r) => {
              const isSelected = r.id === activeReport?.id;
              const isLoz = r.area?.toLowerCase().includes("lake") || r.title?.toLowerCase().includes("lake");
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={cn(
                    "p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 shadow-xs relative overflow-hidden group",
                    isSelected
                      ? "bg-surface-1 border-gold ring-1 ring-gold shadow-[0_4px_20px_-4px_rgba(196,90,44,0.25)]"
                      : "bg-surface-2/60 border-border/70 hover:border-gold/40 hover:bg-surface-2",
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {isLoz ? "Lake of the Ozarks" : r.area?.replace(/\s*\(.*?\)/, "")}
                      </span>
                      {isLoz && (
                        <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[9px] px-1.5 py-0">
                          Multi-Page
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.month} · {r.metrics?.medianSalePrice || "Market Data"}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "h-7 w-7 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-gold text-navy font-bold" : "bg-surface-3 text-muted-foreground group-hover:text-gold",
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hero Section: Active Report Title */}
        <div className="space-y-2 pb-2 border-b border-border/60">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[11px] font-semibold text-gold tracking-wide uppercase">
            <Sparkles className="h-3 w-3" />
            <span>Official MLS Local Market Update</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground font-serif">
            {activeReport?.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Building className="h-3.5 w-3.5 text-gold" />
              {activeReport?.area}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {activeReport?.month}
            </span>
          </p>
        </div>

        {/* Executive Summary Callout */}
        {activeReport?.summaryNotes && (
          <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-surface-1/90 backdrop-blur-md p-5 sm:p-6 shadow-sm">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold/30 via-gold to-gold/30" />
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0 border border-gold/30 mt-0.5">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-1 flex-1">
                <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider text-[11px] text-gold">
                  Executive Market Highlights &amp; Agent Talking Points
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {activeReport.summaryNotes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Primary Visual Metric Bento Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-gold" />
              <span>Key Market Indicators at a Glance</span>
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {activeReport?.month} MLS Data
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Median Sale Price */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-xs space-y-2 relative overflow-hidden group hover:border-gold/50 transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Median Sale Price</span>
                <Home className="h-4 w-4 text-gold group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
                {activeReport?.metrics.medianSalePrice}
              </div>
              {activeReport?.metrics.medianPriceChange && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <TrendingUp className="h-3 w-3" />
                  <span>{activeReport.metrics.medianPriceChange}</span>
                </div>
              )}
            </div>

            {/* Metric 2: Avg Days on Market */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-xs space-y-2 relative overflow-hidden group hover:border-gold/50 transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Avg Days on Market</span>
                <Clock className="h-4 w-4 text-gold group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
                {activeReport?.metrics.avgDaysOnMarket}
              </div>
              {activeReport?.metrics.domChange && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span>{activeReport.metrics.domChange}</span>
                </div>
              )}
            </div>

            {/* Metric 3: Active Listings / Inventory */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-xs space-y-2 relative overflow-hidden group hover:border-gold/50 transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Active / New Listings</span>
                <Layers className="h-4 w-4 text-gold group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
                {activeReport?.metrics.activeInventory}
              </div>
              {activeReport?.metrics.inventoryChange && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">
                  <span>{activeReport.metrics.inventoryChange}</span>
                </div>
              )}
            </div>

            {/* Metric 4: Closed Sales / Volume */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-xs space-y-2 relative overflow-hidden group hover:border-gold/50 transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Closed Volume / Units</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
                {activeReport?.metrics.closedSales}
              </div>
              {activeReport?.metrics.closedSalesChange && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span>{activeReport.metrics.closedSalesChange}</span>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Stats Row: List-to-Sale & Supply Ratio & Custom Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
                  List-to-Sale Price Ratio
                </span>
                <div className="text-base sm:text-lg font-bold text-foreground">
                  {activeReport?.metrics.listToSaleRatio || "96.7%"}
                </div>
              </div>
              <Percent className="h-5 w-5 text-gold/60" />
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Months of Supply
                </span>
                <div className="text-base sm:text-lg font-bold text-foreground">
                  {activeReport?.metrics.monthsSupply || "5.0 Months"}
                </div>
              </div>
              <Clock className="h-5 w-5 text-gold/60" />
            </div>

            {/* Custom highlight item if available */}
            {activeReport?.metrics.customHighlights && activeReport.metrics.customHighlights.length > 0 ? (
              <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider truncate">
                    {activeReport.metrics.customHighlights[0].label}
                  </span>
                  <div className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <span>{activeReport.metrics.customHighlights[0].value}</span>
                    {activeReport.metrics.customHighlights[0].change && (
                      <span className="text-xs font-semibold text-emerald-400">
                        {activeReport.metrics.customHighlights[0].change}
                      </span>
                    )}
                  </div>
                </div>
                <TrendingUp className="h-5 w-5 text-gold/60" />
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
                    Market Momentum
                  </span>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    Strong Local Demand
                  </div>
                </div>
                <Sparkles className="h-5 w-5 text-gold/60" />
              </div>
            )}
          </div>
        </section>

        {/* Specialized Breakdown Table for Lake of the Ozarks (Multi-Page Report) */}
        {isLakeOfOzarks && (
          <section className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Waves className="h-4.5 w-4.5 text-cyan-400" />
                  <span>Lake of the Ozarks Category Breakdown</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Detailed MLS property breakdown across Residential Homes, Condos/Timeshares, Acreage/Lots, and Commercial.
                </p>
              </div>
              <Badge variant="outline" className="text-xs border-cyan-400/40 text-cyan-300 self-start sm:self-auto">
                Bagnell Dam &amp; LOZ Boards
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {LOZ_CATEGORY_DATA.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 shadow-xs",
                    idx === 4
                      ? "bg-surface-1 border-gold/50 md:col-span-2 lg:col-span-3"
                      : "bg-surface-1/90 border-border/80 hover:border-gold/40",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground">{item.category}</h3>
                      <Badge className="bg-surface-2 text-muted-foreground text-[10px] border border-border">
                        {item.badge}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-lg bg-surface-2/80">
                        <span className="text-[10px] text-muted-foreground block uppercase">Median Sell</span>
                        <strong className="text-sm font-bold text-foreground font-serif">{item.medianPrice}</strong>
                        <span className="text-[10px] text-muted-foreground block">Avg: {item.avgPrice}</span>
                      </div>

                      <div className="p-2 rounded-lg bg-surface-2/80">
                        <span className="text-[10px] text-muted-foreground block uppercase">Sold Units &amp; Vol</span>
                        <strong className="text-sm font-bold text-foreground">{item.soldCount} Sold</strong>
                        <span className="text-[10px] text-emerald-400 block font-medium">{item.volume}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                    <span>DOM: <strong className="text-foreground">{item.dom}</strong></span>
                    <span>List-to-Sell: <strong className="text-foreground">{item.listToSell}</strong></span>
                    <span className="text-gold font-medium">{item.highlight}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ready-to-Post Social Media Graphics Section */}
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Share2 className="h-4.5 w-4.5 text-gold" />
                <span>Ready-to-Post Social Media Graphics</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Download high-res graphic assets tailored for {activeReport?.area} and copy captions ready for Instagram &amp; Facebook.
              </p>
            </div>
            <Badge variant="outline" className="text-xs border-gold/40 text-gold self-start sm:self-auto">
              {activeReport?.graphics.length || 0} Assets Available
            </Badge>
          </div>

          {activeReport?.graphics && activeReport.graphics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {activeReport.graphics.map((graphic, idx) => (
                <div
                  key={graphic.id || idx}
                  className="rounded-2xl border border-border/80 bg-surface-1/90 overflow-hidden shadow-sm hover:border-gold/50 transition-all duration-300 flex flex-col group"
                >
                  {/* Graphic Preview Container */}
                  <div className="relative bg-muted/60 aspect-[4/3] sm:aspect-video overflow-hidden flex items-center justify-center">
                    <img
                      src={graphic.imageUrl}
                      alt={graphic.title}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    />

                    {/* Format Badge */}
                    <Badge className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white border-white/15 text-[11px] font-semibold">
                      {graphic.format || "Social Graphic"}
                    </Badge>

                    {/* Quick View Button */}
                    <button
                      type="button"
                      onClick={() => setPreviewGraphic(graphic)}
                      className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gold hover:text-navy"
                      title="Enlarge Graphic"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Graphic Content & Copy Controls */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-gold transition-colors">
                        {graphic.title}
                      </h3>

                      {graphic.caption && (
                        <div className="mt-2 text-xs text-muted-foreground/90 bg-surface-2/80 rounded-xl p-3 border border-border/70 line-clamp-3 relative font-sans leading-relaxed whitespace-pre-wrap">
                          {graphic.caption}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        onClick={() =>
                          downloadFile(
                            graphic.imageUrl,
                            `${activeReport.month}_${graphic.title.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`,
                          )
                        }
                        className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold flex-1 h-8 shadow-2xs"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download Image
                      </Button>

                      {graphic.caption && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyCaption(graphic.caption!)}
                          className="border-border hover:bg-surface-2 text-xs font-medium h-8"
                          title="Copy Caption Text"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5 text-gold" />
                          Copy Caption
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface-1/40 p-8 text-center text-muted-foreground space-y-2">
              <Share2 className="h-8 w-8 mx-auto opacity-40 text-gold" />
              <p className="text-sm font-medium">No social media graphics uploaded yet for this area.</p>
              <p className="text-xs text-muted-foreground/70">
                Staff can upload tailored graphics in the Staff Backend.
              </p>
            </div>
          )}
        </section>

        {/* Full PDF Report Document Section */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-gold" />
              <span>Full MLS Report Document (PDF)</span>
            </h2>
            {activeReport?.pdfUrl && (
              <a
                href={activeReport.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-gold hover:underline flex items-center gap-1"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface-1/90 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  {activeReport?.pdfName || `${activeReport?.title} PDF`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isLakeOfOzarks
                    ? "4-Page Comprehensive MLS Report covering Residential Detached, Condos, Land, Commercial, and Full Board Summary."
                    : "Official MLS Local Market Update with historical rolling 12-month median price calculations."}
                </p>
                {activeReport?.pdfSize && (
                  <span className="text-[11px] text-muted-foreground/70 block">
                    File size: {(activeReport.pdfSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              {activeReport?.pdfUrl ? (
                <>
                  <a
                    href={activeReport.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-border/80 text-xs font-medium text-foreground hover:bg-surface-2 transition-colors flex-1 sm:flex-initial"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>View PDF</span>
                  </a>

                  <Button
                    onClick={() =>
                      downloadFile(
                        activeReport.pdfUrl!,
                        activeReport.pdfName || `${activeReport.month}_MLS_Report.pdf`,
                      )
                    }
                    className="bg-gold text-navy hover:bg-gold/90 text-xs font-bold px-4 py-2 rounded-xl flex-1 sm:flex-initial shadow-xs"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    <span>Download PDF</span>
                  </Button>
                </>
              ) : (
                <div className="text-xs text-muted-foreground bg-surface-2/60 px-3.5 py-2 rounded-xl border border-border/60">
                  <span>Official PDF Ready in Backend</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-4 text-center text-xs text-muted-foreground space-y-2 border-t border-border/50">
          <div className="flex items-center justify-center gap-3">
            <Link to="/agents" className="hover:text-gold transition-colors font-medium">
              MSREG Agent Hub
            </Link>
            <span>·</span>
            <Link to="/vendor-guide" className="hover:text-gold transition-colors font-medium">
              Vendor Guide
            </Link>
            <span>·</span>
            <Link to="/seller-net-proceeds" className="hover:text-gold transition-colors font-medium">
              Net Calculator
            </Link>
          </div>
          <div>© Matt Smith Real Estate Group · MLS Market Intelligence</div>
        </footer>
      </main>

      {/* Modal: Fullscreen Graphic Lightbox */}
      {previewGraphic && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          onClick={() => setPreviewGraphic(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface-1 rounded-2xl overflow-hidden border border-border shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border/80 bg-surface-2/80">
              <div>
                <h3 className="text-sm font-bold text-foreground">{previewGraphic.title}</h3>
                <span className="text-xs text-muted-foreground">{previewGraphic.format || "Social Asset"}</span>
              </div>
              <button
                onClick={() => setPreviewGraphic(null)}
                className="h-8 w-8 rounded-full bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2 overflow-auto flex items-center justify-center bg-black/40">
              <img
                src={previewGraphic.imageUrl}
                alt={previewGraphic.title}
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>

            {previewGraphic.caption && (
              <div className="p-4 bg-surface-2/60 border-t border-border/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Post Caption &amp; Hashtags:</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyCaption(previewGraphic.caption!)}
                    className="h-7 text-xs text-gold hover:bg-gold/10"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Text
                  </Button>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
                  {previewGraphic.caption}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
