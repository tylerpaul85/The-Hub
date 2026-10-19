import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  Zap,
  Globe,
  Key,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Film,
  Download,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { triggerGhlAutoImport, type PlaybookProduct } from "@/lib/playbooks.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface GhlAutoImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function GhlAutoImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: GhlAutoImportDialogProps) {
  const triggerImportFn = useServerFn(triggerGhlAutoImport);

  const [activeTab, setActiveTab] = useState<"instant" | "api" | "scraper" | "folder">("instant");
  const [isRunning, setIsRunning] = useState(false);
  const [importReport, setImportReport] = useState<any | null>(null);

  // Form states
  const [locationId, setLocationId] = useState("MSREG-HQ");
  const [apiKey, setApiKey] = useState("");
  const [portalUrl, setPortalUrl] = useState("https://app.gohighlevel.com/v2/location/msreg/memberships/courses");
  const [sessionCookie, setSessionCookie] = useState("");
  const [exportDir, setExportDir] = useState("./export");
  const [useAi, setUseAi] = useState(true);

  // 8 Official products preview for Instant Sync tab
  const officialProducts = [
    { title: "Listing Agent Playbook", cover: "/covers/listing-agent-playbook.jpg" },
    { title: "MSREG Leadership Playbook", cover: "/covers/msreg-leadership-playbook.jpg" },
    { title: "The Operations Playbook - MSREG Way", cover: "/covers/operations-playbook.jpg" },
    { title: "Welcome to Matt Smith Real Estate Group", cover: "/covers/welcome-to-msreg.jpg" },
    { title: "2026 Lake Agent Certification", cover: "/covers/lake-agent-certification.jpg" },
    { title: "Listing Agent Certification", cover: "/covers/listing-agent-certification.jpg" },
    { title: "New Agent Bootcamp", cover: "/covers/new-agent-bootcamp.jpg" },
    { title: "MSREG 5-Day Agent Bootcamp", cover: "/covers/five-day-bootcamp.jpg" },
  ];

  const handleRunSync = async (mode: "seed_all_8" | "ghl_api" | "ghl_scrape" | "local_export") => {
    try {
      setIsRunning(true);
      setImportReport(null);

      const result = await triggerImportFn({
        data: {
          mode,
          locationId: locationId.trim(),
          apiKey: apiKey.trim(),
          portalUrl: portalUrl.trim(),
          sessionCookie: sessionCookie.trim(),
          exportDir: exportDir.trim(),
        },
      });

      setImportReport(result);
      toast.success("GoHighLevel Playbook Import & Sync completed!");
      onImportComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete GHL import");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-surface-1 border-border p-6 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>GoHighLevel Playbook Auto-Importer & Scraper</span>
                <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30 font-bold">
                  GHL Sync
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Automatically pull and synchronize all 8 playbooks, sections, and video tracks directly into the Hub.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Report View after execution */}
        {importReport ? (
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">GHL Synchronization Complete</h4>
                  <p className="text-xs text-muted-foreground">
                    All courses and modules have been normalized and saved into the database.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportReport(null)}
                className="text-xs h-8 rounded-xl border-border bg-surface-1 cursor-pointer"
              >
                Run Another Sync
              </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Total Scanned
                </span>
                <p className="text-xl font-bold text-foreground mt-0.5">{importReport.totalScanned}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Products Created
                </span>
                <p className="text-xl font-bold text-gold mt-0.5">{importReport.totalCreated}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Lessons Updated
                </span>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">{importReport.totalUpdated}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  GHL Videos Flagged
                </span>
                <p className="text-xl font-bold text-blue-400 mt-0.5">
                  {importReport.totalGhlVideosNeedingMigration}
                </p>
              </div>
            </div>

            {/* GHL Hosted Videos List */}
            {importReport.ghlVideosList && importReport.ghlVideosList.length > 0 && (
              <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2">
                <h5 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5" />
                  <span>GHL-Hosted Videos Requiring Migration ({importReport.ghlVideosList.length})</span>
                </h5>
                <p className="text-[11px] text-muted-foreground">
                  These videos are currently streaming from LeadConnector/GHL CDN. We recommend moving them to YouTube (unlisted), Vimeo, or Loom.
                </p>
                <div className="space-y-1.5 pt-1">
                  {importReport.ghlVideosList.map((v: any, idx: number) => (
                    <div
                      key={idx}
                      className="text-xs p-2 rounded-lg bg-surface-2/80 border border-border/60 flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-foreground">{v.title}</span>
                        <span className="text-muted-foreground text-[11px] ml-1.5">({v.product})</span>
                      </div>
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 shrink-0"
                      >
                        <span>View</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl px-5 h-8 cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="flex-1 flex flex-col overflow-hidden pt-2"
          >
            <TabsList className="grid grid-cols-4 bg-surface-2 p-1 rounded-xl border border-border/80">
              <TabsTrigger value="instant" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-surface-1 cursor-pointer">
                ⚡ 1-Click Sync
              </TabsTrigger>
              <TabsTrigger value="api" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-surface-1 cursor-pointer">
                🔌 GHL API
              </TabsTrigger>
              <TabsTrigger value="scraper" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-surface-1 cursor-pointer">
                🕷️ Auto-Scraper
              </TabsTrigger>
              <TabsTrigger value="folder" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-surface-1 cursor-pointer">
                📁 Local Folder
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Instant 1-Click Sync (Recommended) */}
            <TabsContent value="instant" className="space-y-4 pt-3 flex-1 overflow-y-auto">
              <div className="p-3.5 rounded-xl border border-gold/30 bg-gold/5 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gold">Synchronize All 8 Official MSREG Playbooks</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Instantly syncs the exact 8 courses shown on your GoHighLevel dashboard into your Playbooks system, complete with cover art, section hierarchies, and verified curriculum.
                  </p>
                </div>
              </div>

              {/* 8 Products Grid Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {officialProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border/80 bg-surface-2/60 overflow-hidden shadow-sm"
                  >
                    <div className="aspect-video w-full bg-surface-2 overflow-hidden">
                      <img src={p.cover} alt={p.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-bold text-foreground line-clamp-1">{p.title}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/60">
                <span className="text-xs text-muted-foreground">
                  Ready to sync all 8 playbooks and sections
                </span>

                <Button
                  onClick={() => handleRunSync("seed_all_8")}
                  disabled={isRunning}
                  className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl px-5 h-9 shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Syncing All 8 Courses...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      <span>Sync All 8 Playbooks Now</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: GHL API Auto-Grabber */}
            <TabsContent value="api" className="space-y-4 pt-3 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Direct GoHighLevel API Connection</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your Location ID and GoHighLevel API Key to auto-grab all courses, categories, and lessons directly via the GHL Memberships API.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">GHL Location ID</label>
                  <Input
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    placeholder="e.g. MSREG-HQ or your GHL Location ID"
                    className="bg-surface-2 border-border text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    GoHighLevel API Key / V2 Access Token
                  </label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter Bearer Token or API Key"
                    className="bg-surface-2 border-border text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <input
                    type="checkbox"
                    id="api-use-ai"
                    checked={useAi}
                    onChange={(e) => setUseAi(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="api-use-ai" className="cursor-pointer">
                    Normalize lessons through Claude 3.7 Sonnet into official 5-part Playbook format
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-border/60">
                <Button
                  onClick={() => handleRunSync("ghl_api")}
                  disabled={isRunning}
                  className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl px-5 h-9 shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Contacting GHL API...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      <span>Connect & Auto-Grab All Playbooks</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 3: Web Scraper / Session Grabber */}
            <TabsContent value="scraper" className="space-y-4 pt-3 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Live Web Scraper & Course Crawler</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scrapes the course portal directly using your portal URL and optional session cookie.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Course Portal URL
                  </label>
                  <Input
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    placeholder="https://app.gohighlevel.com/v2/location/.../memberships/courses"
                    className="bg-surface-2 border-border text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Session Authorization Header / Cookie (Optional)
                  </label>
                  <Input
                    type="password"
                    value={sessionCookie}
                    onChange={(e) => setSessionCookie(e.target.value)}
                    placeholder="Optional authorization cookie or token"
                    className="bg-surface-2 border-border text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-border/60">
                <Button
                  onClick={() => handleRunSync("ghl_scrape")}
                  disabled={isRunning}
                  className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl px-5 h-9 shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scraping GHL Courses...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      <span>Run Course Auto-Scraper</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 4: Server Export Folder Scanner */}
            <TabsContent value="folder" className="space-y-4 pt-3 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Server Export Folder Scanner</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Executes the import engine on the local server directory (<code className="text-gold">./export</code>).
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Export Directory Path</label>
                  <Input
                    value={exportDir}
                    onChange={(e) => setExportDir(e.target.value)}
                    placeholder="./export"
                    className="bg-surface-2 border-border text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-border/60">
                <Button
                  onClick={() => handleRunSync("local_export")}
                  disabled={isRunning}
                  className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl px-5 h-9 shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scanning Folder...</span>
                    </>
                  ) : (
                    <>
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>Run Local Folder Import</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
