import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Store,
  Search,
  Phone,
  Mail,
  Globe,
  User,
  Star,
  FileDown,
  Plus,
  Flag,
  ArrowLeft,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Wrench,
  ShieldCheck,
  Building,
  HelpCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logo from "@/assets/msreg-logo.png";
import {
  listPublicVendors,
  submitPublicVendorRequest,
  verifyToolboxCode,
} from "@/lib/toolbox-public.functions";
import type { Vendor, VendorCategory } from "@/lib/vendors";
import {
  VENDOR_REGIONS,
  MSREG_CORE_VALUES,
  getRegionShortLabel,
  formatPhoneNumber,
  filterVendors,
} from "@/lib/vendors";
import { generateVendorGuidePdf } from "@/lib/vendors-pdf";

export const Route = createFileRoute("/vendor-guide")({
  ssr: false,
  component: PublicVendorsPage,
  head: () => ({
    meta: [
      { title: "Local Vendor Guide — MSREG Hub" },
      { name: "description", content: "Trusted home services and local vendor resource directory." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STORAGE_KEY = "msreg-toolbox-token";
const AGENT_NAME_KEY = "msreg-agent-name";
const AGENT_EMAIL_KEY = "msreg-agent-email";
const AGENT_PHONE_KEY = "msreg-agent-phone";

function PublicVendorsPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) setToken(t);
    } catch {}
  }, []);

  if (!token) {
    return (
      <Gate
        onUnlock={(t) => {
          try {
            localStorage.setItem(STORAGE_KEY, t);
          } catch {}
          setToken(t);
        }}
      />
    );
  }

  return (
    <VendorsDirectory
      token={token}
      onLock={() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setToken(null);
      }}
    />
  );
}

/* -------- Access Gate -------- */
function Gate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyCode = useServerFn(verifyToolboxCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const result = await verifyCode({ data: { code: code.trim() } });
      onUnlock(result.token);
    } catch (err: any) {
      toast.error(err?.message || "Could not verify code");
    }
    setBusy(false);
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-[var(--accent)]/10 rounded-full blur-3xl" />
      </div>

      <Card className="relative w-full max-w-sm p-7 space-y-6 border border-[var(--border)] bg-[var(--surface-1)] shadow-2xl rounded-2xl">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center p-2 shadow-inner">
            <img src={logo} alt="MSREG" className="h-full w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Local Vendor Guide</h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] font-semibold mt-1">
              Matt Smith Real Estate Group
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[var(--accent)]" /> Team Access Code
            </label>
            <Input
              autoFocus
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter access code"
              className="text-center font-mono tracking-widest text-base h-11 bg-[var(--surface-2)] border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] text-[var(--text-primary)]"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-semibold h-11 transition-all shadow-md active:scale-[0.99]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock Vendor Guide"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* -------- Main Vendors Directory -------- */
function VendorsDirectory({ token, onLock }: { token: string; onLock: () => void }) {
  const qc = useQueryClient();
  const fetchVendors = useServerFn(listPublicVendors);
  const submitRequest = useServerFn(submitPublicVendorRequest);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>("st_robert_rolla");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isRecommendOpen, setIsRecommendOpen] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [flagVendor, setFlagVendor] = useState<Vendor | null>(null);

  // User details state (for request forms and PDF export)
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  useEffect(() => {
    try {
      setAgentName(localStorage.getItem(AGENT_NAME_KEY) || "");
      setAgentEmail(localStorage.getItem(AGENT_EMAIL_KEY) || "");
      setAgentPhone(localStorage.getItem(AGENT_PHONE_KEY) || "");
    } catch {}
  }, []);

  const saveAgentDetails = (name: string, email: string, phone?: string) => {
    try {
      localStorage.setItem(AGENT_NAME_KEY, name.trim());
      localStorage.setItem(AGENT_EMAIL_KEY, email.trim().toLowerCase());
      if (phone) localStorage.setItem(AGENT_PHONE_KEY, phone.trim());
    } catch {}
    setAgentName(name.trim());
    setAgentEmail(email.trim().toLowerCase());
    if (phone) setAgentPhone(phone.trim());
  };

  // Recommend Form State
  const [recRegion, setRecRegion] = useState("st_robert_rolla");
  const [recCategoryId, setRecCategoryId] = useState("");
  const [recName, setRecName] = useState("");
  const [recContact, setRecContact] = useState("");
  const [recPhone, setRecPhone] = useState("");
  const [recEmail, setRecEmail] = useState("");
  const [recWebsite, setRecWebsite] = useState("");
  const [recNotes, setRecNotes] = useState("");
  const [recReason, setRecReason] = useState("");
  const [recCoreValues, setRecCoreValues] = useState("");
  const [recAgentName, setRecAgentName] = useState("");
  const [recAgentEmail, setRecAgentEmail] = useState("");

  // Flag Form State
  const [flagType, setFlagType] = useState<"flag" | "remove">("flag");
  const [flagReason, setFlagReason] = useState("");
  const [flagAgentName, setFlagAgentName] = useState("");
  const [flagAgentEmail, setFlagAgentEmail] = useState("");

  // PDF Export State
  const [pdfRegion, setPdfRegion] = useState("all");
  const [pdfCategory, setPdfCategory] = useState("all");
  const [pdfAgentName, setPdfAgentName] = useState("");
  const [pdfAgentPhone, setPdfAgentPhone] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  // Queries
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-vendors", token],
    queryFn: () => fetchVendors({ data: { token } }),
  });

  const categories = (data?.categories ?? []) as VendorCategory[];
  const vendors = (data?.vendors ?? []) as Vendor[];

  // Filtered List
  const filtered = useMemo(() => {
    return filterVendors(vendors, searchQuery, selectedRegion, selectedCategory);
  }, [vendors, searchQuery, selectedRegion, selectedCategory]);

  // Group filtered vendors by category
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, { category: VendorCategory; vendors: Vendor[] }>();

    // Sort categories by sort_order
    const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    for (const cat of sortedCats) {
      const catVendors = filtered.filter((v) => v.category_id === cat.id);
      if (catVendors.length > 0) {
        map.set(cat.id, { category: cat, vendors: catVendors });
      }
    }

    return Array.from(map.values());
  }, [categories, filtered]);

  // Request Mutation
  const requestMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await submitRequest({
        data: {
          token,
          ...payload,
        },
      });
    },
    onSuccess: (_, vars) => {
      saveAgentDetails(vars.agentName, vars.agentEmail);
      toast.success("Thank you! Your suggestion has been sent to the Ops team for review.");
      setIsRecommendOpen(false);
      setFlagVendor(null);
      // Reset form fields
      setRecName("");
      setRecContact("");
      setRecPhone("");
      setRecEmail("");
      setRecWebsite("");
      setRecNotes("");
      setRecReason("");
      setFlagReason("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not submit request");
    },
  });

  const openRecommendDialog = () => {
    setRecRegion(selectedRegion === "all" ? "st_robert_rolla" : selectedRegion);
    setRecCategoryId(selectedCategory === "all" ? (categories[0]?.id || "") : selectedCategory);
    setRecAgentName(agentName || "");
    setRecAgentEmail(agentEmail || "");
    setIsRecommendOpen(true);
  };

  const openFlagDialog = (v: Vendor) => {
    setFlagVendor(v);
    setFlagType("flag");
    setFlagReason("");
    setFlagAgentName(agentName || "");
    setFlagAgentEmail(agentEmail || "");
  };

  const openPdfDialog = () => {
    setPdfRegion(selectedRegion);
    setPdfCategory(selectedCategory);
    setPdfAgentName(agentName || "");
    setPdfAgentPhone(agentPhone || "");
    setIsExportPdfOpen(true);
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      saveAgentDetails(pdfAgentName, agentEmail, pdfAgentPhone);
      await generateVendorGuidePdf({
        vendors,
        categories,
        regionFilter: pdfRegion,
        categoryFilter: pdfCategory,
        agentName: pdfAgentName,
        agentPhone: pdfAgentPhone,
      });
      setIsExportPdfOpen(false);
      toast.success("PDF Vendor Guide downloaded!");
    } catch (e: any) {
      toast.error("Could not generate PDF");
    }
    setPdfBusy(false);
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text-primary)] overflow-x-hidden selection:bg-[var(--accent)]/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.14),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[650px] h-[420px] sm:h-[650px] pointer-events-none opacity-[0.03] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--surface-1)]/90 backdrop-blur-md border-b border-[var(--border)] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/agents"
              className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-colors"
              title="Back to Agent Hub"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base truncate flex items-center gap-1.5 text-[var(--text-primary)]">
                <Store className="h-4 w-4 text-[var(--accent)] shrink-0" />
                Trusted Vendor Guide
              </h1>
              <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--accent)] font-semibold truncate">
                MSREG Local Home Services Directory
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={openPdfDialog}
              variant="outline"
              size="sm"
              className="text-xs h-9 border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 hidden sm:flex items-center gap-1.5 font-medium"
            >
              <FileDown className="h-4 w-4" /> Print / Export PDF
            </Button>
            <Button
              onClick={openRecommendDialog}
              size="sm"
              className="text-xs h-9 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-semibold flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Recommend Vendor
            </Button>
            <Button variant="ghost" size="sm" onClick={onLock} className="text-xs h-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Lock
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-20 space-y-6">
        {/* Mobile PDF button */}
        <div className="sm:hidden">
          <Button
            onClick={openPdfDialog}
            variant="outline"
            size="sm"
            className="w-full text-xs h-9 border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 flex items-center justify-center gap-1.5 font-medium"
          >
            <FileDown className="h-4 w-4" /> Print / Export PDF for Appointment
          </Button>
        </div>

        {/* Region Selector Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--surface-1)] p-1.5 rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {VENDOR_REGIONS.map((r) => (
              <Button
                key={r.key}
                variant={selectedRegion === r.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedRegion(r.key)}
                className={cn(
                  "text-xs font-semibold rounded-lg h-8 px-3.5 whitespace-nowrap transition-all",
                  selectedRegion === r.key
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
                )}
              >
                {r.shortLabel}
              </Button>
            ))}
            <Button
              variant={selectedRegion === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedRegion("all")}
              className={cn(
                "text-xs font-semibold rounded-lg h-8 px-3.5 whitespace-nowrap transition-all",
                selectedRegion === "all"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
              )}
            >
              All Regions
            </Button>
          </div>

          <div className="text-xs text-[var(--text-muted)] px-2">
            Showing <strong>{filtered.length}</strong> verified vendor{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor name, service, contact, phone, or notes..."
              className="pl-9 h-11 text-sm bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-11 text-xs bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="max-h-72 bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)]">
                <SelectItem value="all">All Categories ({vendors.length})</SelectItem>
                {categories.map((c) => {
                  const count = vendors.filter(
                    (v) =>
                      v.category_id === c.id &&
                      (selectedRegion === "all" || v.region === selectedRegion),
                  ).length;
                  return (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Vendors Content */}
        {isLoading ? (
          <div className="py-20 text-center text-[var(--text-secondary)] flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
            <p className="text-sm font-medium">Loading trusted vendors…</p>
          </div>
        ) : isError ? (
          <Card className="p-8 text-center border-dashed border-[var(--border)] bg-[var(--surface-1)]">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Could not load vendor directory.</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3 border-[var(--border)] text-[var(--text-primary)]">
              Try Again
            </Button>
          </Card>
        ) : groupedByCategory.length === 0 ? (
          <Card className="p-12 text-center text-sm border-dashed border-[var(--border)] bg-[var(--surface-1)]">
            <Store className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-base text-[var(--text-primary)]">No vendors found</p>
            <p className="text-xs mt-1 text-[var(--text-secondary)]">
              Try adjusting your search terms, changing the region, or selecting "All Categories".
            </p>
            <Button
              onClick={openRecommendDialog}
              size="sm"
              className="mt-4 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-semibold text-xs shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Recommend a Vendor
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedByCategory.map(({ category, vendors: catVendors }) => (
              <section key={category.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-bold text-xs">
                      <Wrench className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                      {category.name}
                    </h2>
                    <Badge variant="outline" className="text-[10px] text-[var(--text-muted)] border-[var(--border)] ml-1">
                      {catVendors.length}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catVendors.map((vendor) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      onFlag={() => openFlagDialog(vendor)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Recommend / Add Vendor Modal */}
      <Dialog open={isRecommendOpen} onOpenChange={setIsRecommendOpen}>
        <DialogContent className="max-w-lg bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Plus className="h-5 w-5 text-[var(--accent)]" />
              Recommend a Trusted Vendor
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              Know an awesome contractor or service provider? Submit their details and our Ops team will review and add them to the team directory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Region *</label>
                <Select value={recRegion} onValueChange={setRecRegion}>
                  <SelectTrigger className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)]">
                    {VENDOR_REGIONS.map((r) => (
                      <SelectItem key={r.key} value={r.key} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Category *</label>
                <Select value={recCategoryId} onValueChange={setRecCategoryId}>
                  <SelectTrigger className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)]">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Vendor / Company Name *</label>
              <Input
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                placeholder="e.g. Apex Roofing & Gutters"
                className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Primary Contact Person</label>
                <Input
                  value={recContact}
                  onChange={(e) => setRecContact(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Phone Number *</label>
                <Input
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  placeholder="e.g. 573-555-1234"
                  className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Email</label>
                <Input
                  type="email"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  placeholder="contact@apexroofing.com"
                  className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Website</label>
                <Input
                  value={recWebsite}
                  onChange={(e) => setRecWebsite(e.target.value)}
                  placeholder="https://apexroofing.com"
                  className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Specialties / Pricing / Notes</label>
              <Input
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                placeholder="e.g. 24/7 emergency service, specialized in metal roofs"
                className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-[var(--accent)] fill-current" />
                What core values do they represent? *
              </label>
              <div className="flex flex-wrap gap-1.5 pb-0.5">
                {MSREG_CORE_VALUES.map((val) => {
                  const isSelected = recCoreValues.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          const parts = recCoreValues.split(", ").filter((x) => x.trim() && x.trim() !== val);
                          setRecCoreValues(parts.join(", "));
                        } else {
                          const parts = recCoreValues ? recCoreValues.split(", ").filter(Boolean) : [];
                          parts.push(val);
                          setRecCoreValues(parts.join(", "));
                        }
                      }}
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer font-medium",
                        isSelected
                          ? "bg-[var(--accent)] text-white font-semibold border-[var(--accent)] shadow-sm"
                          : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50"
                      )}
                    >
                      {isSelected ? "✓ " : "+ "}{val}
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={recCoreValues}
                onChange={(e) => setRecCoreValues(e.target.value)}
                placeholder="Click the core value chips above or add specific notes on how they embody these values..."
                className="text-xs h-14 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Why do you recommend them? *
              </label>
              <Textarea
                value={recReason}
                onChange={(e) => setRecReason(e.target.value)}
                placeholder="e.g. Used them for 3 client transactions, always on time, very fair pricing."
                className="text-xs h-14 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <div className="border-t border-[var(--border)] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Your Name *</label>
                <Input
                  value={recAgentName}
                  onChange={(e) => setRecAgentName(e.target.value)}
                  placeholder="Agent Name"
                  className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Your Email *</label>
                <Input
                  type="email"
                  value={recAgentEmail}
                  onChange={(e) => setRecAgentEmail(e.target.value)}
                  placeholder="agent@mattsmithrealestategroup.com"
                  className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRecommendOpen(false)}
              className="text-xs border-[var(--border)] text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!recName.trim()) return toast.error("Please enter a vendor name");
                if (!recPhone.trim()) return toast.error("Please enter a phone number");
                if (!recCoreValues.trim()) return toast.error("Please answer what core values this vendor represents");
                if (!recReason.trim()) return toast.error("Please state why you recommend them");
                if (!recAgentName.trim() || !recAgentEmail.trim()) {
                  return toast.error("Please enter your name and email");
                }

                requestMutation.mutate({
                  requestType: "add",
                  vendorName: recName.trim(),
                  region: recRegion,
                  categoryId: recCategoryId || null,
                  primaryContact: recContact.trim() || null,
                  phone: recPhone.trim(),
                  email: recEmail.trim() || null,
                  website: recWebsite.trim() || null,
                  specialtyNotes: recNotes.trim() || null,
                  coreValues: recCoreValues.trim(),
                  reason: recReason.trim(),
                  agentName: recAgentName.trim(),
                  agentEmail: recAgentEmail.trim().toLowerCase(),
                });
              }}
              disabled={requestMutation.isPending}
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-xs font-semibold shadow-sm"
            >
              {requestMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Submit Recommendation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag / Report Vendor Modal */}
      <Dialog open={!!flagVendor} onOpenChange={(open) => !open && setFlagVendor(null)}>
        <DialogContent className="max-w-md bg-[var(--surface-1)] border-rose-500/30 text-[var(--text-primary)] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-400" />
              Report / Request Removal: {flagVendor?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              Let the Ops team know if a vendor is no longer in business, unresponsive, or provided poor service.
            </DialogDescription>
          </DialogHeader>

          {flagVendor && (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-[var(--surface-2)] rounded-lg text-xs space-y-1 border border-[var(--border)]">
                <div className="font-semibold text-[var(--text-primary)]">{flagVendor.name}</div>
                <div className="text-[var(--text-secondary)]">{getRegionShortLabel(flagVendor.region)} • {flagVendor.phone}</div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={flagType === "flag" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setFlagType("flag")}
                    className={cn("text-xs h-8", flagType === "flag" && "border-amber-500/50 bg-amber-500/15 text-amber-300")}
                  >
                    Flag Feedback
                  </Button>
                  <Button
                    type="button"
                    variant={flagType === "remove" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setFlagType("remove")}
                    className={cn("text-xs h-8", flagType === "remove" && "border-rose-500/50 bg-rose-500/15 text-rose-300")}
                  >
                    Request Removal
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Reason / What happened? *
                </label>
                <Textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="e.g. Phone number is disconnected, client had a negative experience with quality..."
                  className="text-xs h-20 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Your Name *</label>
                  <Input
                    value={flagAgentName}
                    onChange={(e) => setFlagAgentName(e.target.value)}
                    placeholder="Agent Name"
                    className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Your Email *</label>
                  <Input
                    type="email"
                    value={flagAgentEmail}
                    onChange={(e) => setFlagAgentEmail(e.target.value)}
                    placeholder="agent@mattsmithrealestategroup.com"
                    className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlagVendor(null)}
              className="text-xs border-[var(--border)] text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!flagReason.trim()) return toast.error("Please explain your reason");
                if (!flagAgentName.trim() || !flagAgentEmail.trim()) {
                  return toast.error("Please enter your name and email");
                }

                requestMutation.mutate({
                  requestType: flagType,
                  vendorId: flagVendor!.id,
                  vendorName: flagVendor!.name,
                  region: flagVendor!.region,
                  categoryId: flagVendor!.category_id,
                  reason: flagReason.trim(),
                  agentName: flagAgentName.trim(),
                  agentEmail: flagAgentEmail.trim().toLowerCase(),
                });
              }}
              disabled={requestMutation.isPending}
              className={cn("text-xs font-semibold shadow-sm", flagType === "remove" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white")}
            >
              {requestMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Flag className="h-3.5 w-3.5 mr-1" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Print Export Dialog */}
      <Dialog open={isExportPdfOpen} onOpenChange={setIsExportPdfOpen}>
        <DialogContent className="max-w-md bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileDown className="h-5 w-5 text-[var(--accent)]" />
              Print / Export Vendor Guide PDF
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              Generate a high-quality, printable PDF handout with MSREG branding to bring to listing appointments or give to clients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Region</label>
              <Select value={pdfRegion} onValueChange={setPdfRegion}>
                <SelectTrigger className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)]">
                  <SelectItem value="all">All Service Areas</SelectItem>
                  {VENDOR_REGIONS.map((r) => (
                    <SelectItem key={r.key} value={r.key} className="text-xs">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Category Scope</label>
              <Select value={pdfCategory} onValueChange={setPdfCategory}>
                <SelectTrigger className="h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)]">
                  <SelectItem value="all">Full Directory (All Categories)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <div className="text-xs font-bold text-[var(--accent)]">Agent Branding (Optional Footer)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] font-medium">Your Name</label>
                  <Input
                    value={pdfAgentName}
                    onChange={(e) => setPdfAgentName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="h-8 text-xs mt-0.5 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] font-medium">Your Cell Phone</label>
                  <Input
                    value={pdfAgentPhone}
                    onChange={(e) => setPdfAgentPhone(e.target.value)}
                    placeholder="e.g. 573-555-1234"
                    className="h-8 text-xs mt-0.5 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportPdfOpen(false)}
              className="text-xs border-[var(--border)] text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-xs font-semibold shadow-sm"
            >
              {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
              Generate & Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Vendor Card Component -------- */
function VendorCard({ vendor, onFlag }: { vendor: Vendor; onFlag: () => void }) {
  const phoneFormatted = formatPhoneNumber(vendor.phone);

  return (
    <div className="group relative flex flex-col justify-between p-4.5 sm:p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)]/95 hover:bg-[var(--surface-1)] hover:border-[var(--accent)]/50 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(196,90,44,0.22)] hover:-translate-y-1 active:scale-[0.985] transition-all duration-300 ring-1 ring-inset ring-white/[0.06] overflow-hidden">
      {/* Top subtle ambient glow highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-[var(--accent)]/50 to-transparent transition-all duration-300" />

      <div className="space-y-3">
        {/* Top Header: Squircle Dock + Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-[var(--surface-2)]/95 border border-white/[0.08] flex items-center justify-center text-[var(--accent)] group-hover:scale-105 group-hover:bg-[var(--accent)]/15 group-hover:border-[var(--accent)]/30 transition-all duration-300 shadow-inner shrink-0">
              <Wrench className="h-4.5 w-4.5 sm:h-5 sm:w-5 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug truncate">
                  {vendor.name}
                </h3>
              </div>
              {vendor.primary_contact && (
                <div className="text-xs text-[var(--accent)] font-medium flex items-center gap-1 mt-0.5 truncate">
                  <User className="h-3 w-3 shrink-0" /> {vendor.primary_contact}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {vendor.is_preferred && (
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30 text-[10px] py-0.5 px-2 font-semibold flex items-center gap-1 shadow-2xs">
                <Star className="h-3 w-3 fill-current" /> Preferred
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] text-[var(--text-secondary)] border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5">
              {getRegionShortLabel(vendor.region)}
            </Badge>
          </div>
        </div>

        {/* Contact Action Pills Grid */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <a
            href={`tel:${vendor.phone}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] hover:border-[var(--accent)]/40 border border-[var(--border)] text-xs font-mono font-medium text-[var(--text-primary)] transition-all shadow-2xs"
            title="Call vendor"
          >
            <Phone className="h-3 w-3 text-[var(--accent)] shrink-0" />
            <span>{phoneFormatted}</span>
          </a>

          {vendor.email && (
            <a
              href={`mailto:${vendor.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] hover:border-[var(--accent)]/40 border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] transition-all shadow-2xs truncate max-w-[190px]"
              title={`Email ${vendor.email}`}
            >
              <Mail className="h-3 w-3 text-[var(--accent)] shrink-0" />
              <span className="truncate">{vendor.email}</span>
            </a>
          )}

          {vendor.website && (
            <a
              href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] hover:border-[var(--accent)]/40 border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] transition-all shadow-2xs"
              title="Visit website"
            >
              <Globe className="h-3 w-3 text-[var(--accent)] shrink-0" />
              <ExternalLink className="h-2.5 w-2.5 opacity-70 shrink-0" />
            </a>
          )}
        </div>

        {/* Specialty Notes */}
        {vendor.specialty_notes && (
          <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-2)]/60 p-2.5 rounded-xl border border-[var(--border)] text-[11px] leading-relaxed">
            {vendor.specialty_notes}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="pt-3 mt-3 border-t border-[var(--border)]/70 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span className="truncate text-[var(--text-secondary)] font-medium">{vendor.category?.name}</span>
        <button
          onClick={onFlag}
          className="text-[var(--text-muted)] hover:text-rose-400 flex items-center gap-1 transition-colors text-[10px] font-medium"
          title="Report an issue with this vendor"
        >
          <Flag className="h-3 w-3" /> Report
        </button>
      </div>
    </div>
  );
}
