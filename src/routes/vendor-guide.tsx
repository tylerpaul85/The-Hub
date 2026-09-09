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
    <div className="relative min-h-screen bg-background flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Card className="w-full max-w-sm p-6 space-y-6 border border-gold/20 bg-card shadow-2xl">
        <div className="flex flex-col items-center text-center gap-3">
          <img src={logo} alt="MSREG" className="h-20 w-auto" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Local Vendor Guide</h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80 mt-1">
              Matt Smith Real Estate Group
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Team access code
            </label>
            <Input
              autoFocus
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter access code"
              className="text-center text-base h-11 focus-visible:ring-gold"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gold text-navy hover:bg-gold/90 font-semibold h-11 transition-all"
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/agents"
              className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-gold/50 transition-colors"
              title="Back to Agent Hub"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm sm:text-base truncate flex items-center gap-1.5">
                <Store className="h-4 w-4 text-gold shrink-0" />
                Trusted Vendor Guide
              </h1>
              <div className="text-[10px] uppercase tracking-[0.15em] text-gold/80 truncate">
                MSREG Local Home Services Directory
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={openPdfDialog}
              variant="outline"
              size="sm"
              className="text-xs h-9 border-gold/40 text-gold hover:bg-gold/10 hidden sm:flex items-center gap-1.5"
            >
              <FileDown className="h-4 w-4" /> Print / Export PDF
            </Button>
            <Button
              onClick={openRecommendDialog}
              size="sm"
              className="text-xs h-9 bg-gold text-navy hover:bg-gold/90 font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Recommend Vendor
            </Button>
            <Button variant="ghost" size="sm" onClick={onLock} className="text-xs h-9">
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
            className="w-full text-xs h-9 border-gold/40 text-gold hover:bg-gold/10 flex items-center justify-center gap-1.5"
          >
            <FileDown className="h-4 w-4" /> Print / Export PDF for Appointment
          </Button>
        </div>

        {/* Region Selector Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-2 rounded-xl border border-border">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {VENDOR_REGIONS.map((r) => (
              <Button
                key={r.key}
                variant={selectedRegion === r.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedRegion(r.key)}
                className={cn(
                  "text-xs font-semibold rounded-lg h-9 px-4 whitespace-nowrap",
                  selectedRegion === r.key
                    ? "bg-gold text-navy hover:bg-gold/90 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
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
                "text-xs font-semibold rounded-lg h-9 px-4 whitespace-nowrap",
                selectedRegion === "all"
                  ? "bg-gold text-navy hover:bg-gold/90 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All Regions
            </Button>
          </div>

          <div className="text-xs text-muted-foreground px-2">
            Showing <strong>{filtered.length}</strong> verified vendor{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor name, service, contact, phone, or notes..."
              className="pl-9 h-11 text-sm bg-card"
            />
          </div>

          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-11 text-xs bg-card">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
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
          <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
            <p className="text-sm">Loading trusted vendors…</p>
          </div>
        ) : isError ? (
          <Card className="p-8 text-center border-dashed">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm font-medium">Could not load vendor directory.</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
              Try Again
            </Button>
          </Card>
        ) : groupedByCategory.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground border-dashed">
            <Store className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-base text-foreground">No vendors found</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Try adjusting your search terms, changing the region, or selecting "All Categories".
            </p>
            <Button
              onClick={openRecommendDialog}
              size="sm"
              className="mt-4 bg-gold text-navy hover:bg-gold/90 font-semibold text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Recommend a Vendor
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedByCategory.map(({ category, vendors: catVendors }) => (
              <section key={category.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-gold/15 text-gold flex items-center justify-center font-bold text-xs">
                      <Wrench className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {category.name}
                    </h2>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground ml-1">
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
        <DialogContent className="max-w-lg bg-card border-gold/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-gold" />
              Recommend a Trusted Vendor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Know an awesome contractor or service provider? Submit their details and our Ops team will review and add them to the team directory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Region *</label>
                <Select value={recRegion} onValueChange={setRecRegion}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_REGIONS.map((r) => (
                      <SelectItem key={r.key} value={r.key} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Category *</label>
                <Select value={recCategoryId} onValueChange={setRecCategoryId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
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
              <label className="text-xs font-medium text-muted-foreground">Vendor / Company Name *</label>
              <Input
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                placeholder="e.g. Apex Roofing & Gutters"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Primary Contact Person</label>
                <Input
                  value={recContact}
                  onChange={(e) => setRecContact(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Phone Number *</label>
                <Input
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  placeholder="e.g. 573-555-1234"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  placeholder="contact@apexroofing.com"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Website</label>
                <Input
                  value={recWebsite}
                  onChange={(e) => setRecWebsite(e.target.value)}
                  placeholder="https://apexroofing.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Specialties / Pricing / Notes</label>
              <Input
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                placeholder="e.g. 24/7 emergency service, specialized in metal roofs"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-gold fill-gold" />
                What core values do they represent? *
              </label>
              <div className="flex flex-wrap gap-1.5 pb-0.5">
                {[
                  "Extreme Ownership",
                  "Client-First Service",
                  "Excellence & Quality",
                  "Integrity & Honesty",
                  "Clear Communication",
                  "Reliability & Punctuality",
                  "Problem Solver",
                ].map((val) => {
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
                        "text-[11px] px-2 py-0.5 rounded-md border transition-all",
                        isSelected
                          ? "bg-gold text-navy font-semibold border-gold shadow-sm"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-gold/50"
                      )}
                    >
                      + {val}
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={recCoreValues}
                onChange={(e) => setRecCoreValues(e.target.value)}
                placeholder="Select values above or describe how they embody our core values (e.g. Extreme Ownership, Client-First, Integrity)..."
                className="text-xs h-14"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Why do you recommend them? *
              </label>
              <Textarea
                value={recReason}
                onChange={(e) => setRecReason(e.target.value)}
                placeholder="e.g. Used them for 3 client transactions, always on time, very fair pricing."
                className="text-xs h-14"
              />
            </div>

            <div className="border-t border-border pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Your Name *</label>
                <Input
                  value={recAgentName}
                  onChange={(e) => setRecAgentName(e.target.value)}
                  placeholder="Agent Name"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Your Email *</label>
                <Input
                  type="email"
                  value={recAgentEmail}
                  onChange={(e) => setRecAgentEmail(e.target.value)}
                  placeholder="agent@mattsmithrealestategroup.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRecommendOpen(false)}
              className="text-xs"
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
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold"
            >
              {requestMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Submit Recommendation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag / Report Vendor Modal */}
      <Dialog open={!!flagVendor} onOpenChange={(open) => !open && setFlagVendor(null)}>
        <DialogContent className="max-w-md bg-card border-rose-500/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-400" />
              Report / Request Removal: {flagVendor?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Let the Ops team know if a vendor is no longer in business, unresponsive, or provided poor service.
            </DialogDescription>
          </DialogHeader>

          {flagVendor && (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 border border-border">
                <div className="font-semibold text-white">{flagVendor.name}</div>
                <div className="text-muted-foreground">{getRegionShortLabel(flagVendor.region)} • {flagVendor.phone}</div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Action Type</label>
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
                <label className="text-xs font-medium text-muted-foreground">
                  Reason / What happened? *
                </label>
                <Textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="e.g. Phone number is disconnected, client had a negative experience with quality..."
                  className="text-xs h-20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Your Name *</label>
                  <Input
                    value={flagAgentName}
                    onChange={(e) => setFlagAgentName(e.target.value)}
                    placeholder="Agent Name"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Your Email *</label>
                  <Input
                    type="email"
                    value={flagAgentEmail}
                    onChange={(e) => setFlagAgentEmail(e.target.value)}
                    placeholder="agent@mattsmithrealestategroup.com"
                    className="h-9 text-xs"
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
              className="text-xs"
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
              className={cn("text-xs font-semibold", flagType === "remove" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white")}
            >
              {requestMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Flag className="h-3.5 w-3.5 mr-1" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Print Export Dialog */}
      <Dialog open={isExportPdfOpen} onOpenChange={setIsExportPdfOpen}>
        <DialogContent className="max-w-md bg-card border-gold/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <FileDown className="h-5 w-5 text-gold" />
              Print / Export Vendor Guide PDF
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate a high-quality, printable PDF handout with MSREG branding to bring to listing appointments or give to clients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Region</label>
              <Select value={pdfRegion} onValueChange={setPdfRegion}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <label className="text-xs font-medium text-muted-foreground">Category Scope</label>
              <Select value={pdfCategory} onValueChange={setPdfCategory}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Full Directory (All Categories)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-semibold text-gold">Agent Branding (Optional Footer)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Your Name</label>
                  <Input
                    value={pdfAgentName}
                    onChange={(e) => setPdfAgentName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Your Cell Phone</label>
                  <Input
                    value={pdfAgentPhone}
                    onChange={(e) => setPdfAgentPhone(e.target.value)}
                    placeholder="e.g. 573-555-1234"
                    className="h-8 text-xs mt-0.5"
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
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold"
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
    <Card className="p-4 bg-card border-border hover:border-gold/40 transition-all duration-200 flex flex-col justify-between shadow-sm relative group">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-white leading-snug truncate">
                {vendor.name}
              </h3>
              {vendor.is_preferred && (
                <Badge className="bg-gold/15 text-gold border-gold/30 text-[10px] py-0 px-1.5 font-semibold flex items-center gap-0.5">
                  <Star className="h-2.5 w-2.5 fill-current" /> Preferred
                </Badge>
              )}
            </div>

            {vendor.primary_contact && (
              <div className="text-xs text-gold/90 font-medium flex items-center gap-1 mt-0.5">
                <User className="h-3 w-3" /> {vendor.primary_contact}
              </div>
            )}
          </div>

          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0 border-border bg-muted/40">
            {getRegionShortLabel(vendor.region)}
          </Badge>
        </div>

        {/* Contact Links */}
        <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-gold shrink-0" />
            <a
              href={`tel:${vendor.phone}`}
              className="text-foreground hover:text-gold hover:underline font-mono text-xs"
            >
              {phoneFormatted}
            </a>
          </div>

          {vendor.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-gold shrink-0" />
              <a
                href={`mailto:${vendor.email}`}
                className="text-muted-foreground hover:text-gold hover:underline truncate text-xs"
              >
                {vendor.email}
              </a>
            </div>
          )}

          {vendor.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-gold shrink-0" />
              <a
                href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-gold hover:underline truncate text-xs flex items-center gap-1"
              >
                <span className="truncate">{vendor.website.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="h-2.5 w-2.5 opacity-70 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Specialty Notes */}
        {vendor.specialty_notes && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/60 text-[11px] leading-relaxed">
            {vendor.specialty_notes}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate text-muted-foreground/60">{vendor.category?.name}</span>
        <button
          onClick={onFlag}
          className="text-muted-foreground hover:text-rose-400 flex items-center gap-1 transition-colors text-[10px]"
          title="Report an issue with this vendor"
        >
          <Flag className="h-3 w-3" /> Report
        </button>
      </div>
    </Card>
  );
}
