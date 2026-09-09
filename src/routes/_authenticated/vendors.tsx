import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Store,
  Plus,
  Search,
  Pencil,
  Trash2,
  FileDown,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Flag,
  Globe,
  Phone,
  Mail,
  User,
  Star,
  Layers,
  Wrench,
  Loader2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { Vendor, VendorCategory, VendorRequest } from "@/lib/vendors";
import {
  VENDOR_REGIONS,
  getRegionShortLabel,
  formatPhoneNumber,
  filterVendors,
  exportVendorsToCsv,
} from "@/lib/vendors";
import {
  listAdminVendors,
  saveVendor,
  deleteVendor,
  saveVendorCategory,
  deleteVendorCategory,
  bulkImportVendors,
  reviewVendorRequest,
} from "@/lib/vendors.functions";

export const Route = createFileRoute("/_authenticated/vendors")({
  component: AdminVendorsPage,
  head: () => ({
    meta: [{ title: "Vendor Directory Management — MSREG Marketing Hub" }],
  }),
});

export function AdminVendorsPage() {
  const { isAdmin, roles } = useAuth();
  const qc = useQueryClient();
  const canManage = isAdmin || roles.includes("marketing_coordinator" as any);

  // Server functions
  const fetchAdminVendors = useServerFn(listAdminVendors);
  const saveVendorFn = useServerFn(saveVendor);
  const deleteVendorFn = useServerFn(deleteVendor);
  const saveCatFn = useServerFn(saveVendorCategory);
  const deleteCatFn = useServerFn(deleteVendorCategory);
  const bulkImportFn = useServerFn(bulkImportVendors);
  const reviewRequestFn = useServerFn(reviewVendorRequest);

  // Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: () => fetchAdminVendors(),
  });

  const vendors = (data?.vendors ?? []) as Vendor[];
  const categories = (data?.categories ?? []) as VendorCategory[];
  const requests = (data?.requests ?? []) as VendorRequest[];

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "pending"),
    [requests],
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState("directory");

  // Directory Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Vendor Editor Modal State
  const [vendorEditorOpen, setVendorEditorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vName, setVName] = useState("");
  const [vCategory, setVCategory] = useState("");
  const [vRegion, setVRegion] = useState("st_robert_rolla");
  const [vContact, setVContact] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vWebsite, setVWebsite] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [vIsPreferred, setVIsPreferred] = useState(false);
  const [vStatus, setVStatus] = useState<"active" | "flagged" | "archived">("active");

  // Category Editor Modal State
  const [catEditorOpen, setCatEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VendorCategory | null>(null);
  const [cName, setCName] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cSort, setCSort] = useState(0);

  // Request Review Modal State
  const [reviewModalRequest, setReviewModalRequest] = useState<VendorRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Bulk Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    let list = filterVendors(vendors, searchQuery, selectedRegion, selectedCategory);
    if (selectedStatus !== "all") {
      list = list.filter((v) => v.status === selectedStatus);
    }
    return list;
  }, [vendors, searchQuery, selectedRegion, selectedCategory, selectedStatus]);

  // Mutations
  const vendorMutation = useMutation({
    mutationFn: async (payload: any) => saveVendorFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success(editingVendor ? "Vendor updated" : "Vendor created");
      setVendorEditorOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Could not save vendor"),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => deleteVendorFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success("Vendor deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Could not delete vendor"),
  });

  const categoryMutation = useMutation({
    mutationFn: async (payload: any) => saveCatFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success(editingCategory ? "Category updated" : "Category created");
      setCatEditorOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Could not save category"),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => deleteCatFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Could not delete category"),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, decision, reviewNotes }: any) =>
      reviewRequestFn({ data: { requestId, decision, reviewNotes } }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success(`Request ${vars.decision}`);
      setReviewModalRequest(null);
    },
    onError: (err: any) => toast.error(err?.message || "Could not review request"),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (rows: any[]) => bulkImportFn({ data: { vendors: rows } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success(`Successfully imported ${res.importedCount} vendors!`);
      setImportFile(null);
      setParsedImportRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => toast.error(err?.message || "Could not import vendors"),
  });

  const openVendorEditor = (v?: Vendor) => {
    if (v) {
      setEditingVendor(v);
      setVName(v.name);
      setVCategory(v.category_id);
      setVRegion(v.region);
      setVContact(v.primary_contact || "");
      setVPhone(v.phone);
      setVEmail(v.email || "");
      setVWebsite(v.website || "");
      setVNotes(v.specialty_notes || "");
      setVIsPreferred(v.is_preferred);
      setVStatus(v.status);
    } else {
      setEditingVendor(null);
      setVName("");
      setVCategory(categories[0]?.id || "");
      setVRegion("st_robert_rolla");
      setVContact("");
      setVPhone("");
      setVEmail("");
      setVWebsite("");
      setVNotes("");
      setVIsPreferred(false);
      setVStatus("active");
    }
    setVendorEditorOpen(true);
  };

  const openCategoryEditor = (c?: VendorCategory) => {
    if (c) {
      setEditingCategory(c);
      setCName(c.name);
      setCSlug(c.slug);
      setCSort(c.sort_order);
    } else {
      setEditingCategory(null);
      setCName("");
      setCSlug("");
      setCSort((categories.length + 1) * 10);
    }
    setCatEditorOpen(true);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const rows = parseCsvText(text);
        setParsedImportRows(rows);
        toast.info(`Parsed ${rows.length} rows from CSV`);
      } catch (err: any) {
        toast.error("Could not parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const parseCsvText = (csv: string): any[] => {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const parsed: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCsvLine(lines[i]);
      if (vals.length === 0 || !vals[0]) continue;

      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx] || "";
      });

      // Map to vendor structure
      const name = row["vendor name"] || row["name"] || row["vendor"] || vals[0];
      const category = row["category"] || row["service"] || row["type"] || "Other Home Services";
      const region = row["region"] || row["area"] || "st_robert_rolla";
      const contact = row["primary contact"] || row["contact"] || row["contact name"] || "";
      const phone = row["phone"] || row["phone number"] || row["cell"] || "";
      const email = row["email"] || "";
      const website = row["website"] || row["url"] || "";
      const notes = row["specialty / notes"] || row["notes"] || row["specialty"] || "";
      const isPreferred = (row["is preferred"] || row["preferred"] || "").toLowerCase().includes("y");

      if (name && phone) {
        parsed.push({
          name: name.trim(),
          category_name: category.trim(),
          region: region.trim(),
          primary_contact: contact.trim() || null,
          phone: phone.trim(),
          email: email.trim() || null,
          website: website.trim() || null,
          specialty_notes: notes.trim() || null,
          is_preferred: isPreferred,
        });
      }
    }
    return parsed;
  };

  const parseCsvLine = (line: string): string[] => {
    const res: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        res.push(cur);
        cur = "";
      } else {
        cur += char;
      }
    }
    res.push(cur);
    return res;
  };

  const downloadSampleCsv = () => {
    const headers = [
      "Region",
      "Category",
      "Vendor Name",
      "Primary Contact",
      "Phone",
      "Email",
      "Website",
      "Specialty / Notes",
      "Is Preferred",
    ];
    const sampleRows = [
      [
        "St. Robert / Rolla",
        "Home Inspectors",
        "Pillar To Post Home Inspections",
        "Dave Roberts",
        "573-555-0199",
        "dave.roberts@pillartopost.com",
        "https://pillartopost.com",
        "Thermal imaging, mold testing available",
        "Yes",
      ],
      [
        "Lake of the Ozarks",
        "HVAC Heating & Cooling",
        "Ozark Air Conditioning & Heating",
        "Sarah Jenkins",
        "573-555-0144",
        "info@ozarkair.com",
        "https://ozarkair.com",
        "24/7 Emergency dock and lake home service",
        "No",
      ],
    ];

    const csvContent = [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MSREG_Vendor_Import_Template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = exportVendorsToCsv(vendors, categories);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MSREG_Vendors_Full_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-gold" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Vendor Directory Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Maintain trusted vendors across St. Robert/Rolla & Lake of the Ozarks, manage categories, and review agent recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => openVendorEditor()}
            className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold h-9"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Vendor
          </Button>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="text-xs h-9 border-border"
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto h-11 grid grid-cols-4 bg-muted/60 p-1">
          <TabsTrigger value="directory" className="text-xs sm:text-sm">
            Directory ({vendors.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs sm:text-sm relative">
            Review Queue
            {pendingRequests.length > 0 && (
              <Badge className="ml-1.5 h-5 px-1.5 bg-rose-500 text-white font-bold text-[10px] rounded-full">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm">
            Categories ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs sm:text-sm">
            Bulk Import / CSV
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Directory Table */}
        <TabsContent value="directory" className="space-y-4 mt-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-card p-3 rounded-xl border border-border">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendor name, contact, phone, notes..."
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>

            <div>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {VENDOR_REGIONS.map((r) => (
                    <SelectItem key={r.key} value={r.key} className="text-xs">
                      {r.shortLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendors Table */}
          <Card className="overflow-hidden border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[240px]">Vendor / Company</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Contact & Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gold" />
                      Loading vendors…
                    </TableCell>
                  </TableRow>
                ) : filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No vendors match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((v) => (
                    <TableRow key={v.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {v.name}
                          {v.is_preferred && (
                            <Badge className="bg-gold/15 text-gold border-gold/30 text-[9px] py-0 px-1">
                              Preferred
                            </Badge>
                          )}
                        </div>
                        {v.specialty_notes && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {v.specialty_notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {v.category?.name || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {getRegionShortLabel(v.region)}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono text-foreground font-medium">
                          {formatPhoneNumber(v.phone)}
                        </div>
                        {v.primary_contact && (
                          <div className="text-[11px] text-muted-foreground">
                            {v.primary_contact}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize",
                            v.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : v.status === "flagged"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700",
                          )}
                        >
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openVendorEditor(v)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Delete vendor "${v.name}"?`)) {
                                deleteVendorMutation.mutate(v.id);
                              }
                            }}
                            className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 2: Review Queue */}
        <TabsContent value="requests" className="space-y-4 mt-6">
          {pendingRequests.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground border-dashed">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-base text-foreground">Review Queue is Clear</p>
              <p className="text-xs mt-1 text-muted-foreground">
                All agent vendor recommendations and removal requests have been reviewed.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingRequests.map((req) => {
                const targetCategory = categories.find((c) => c.id === req.category_id);

                return (
                  <Card key={req.id} className="p-5 border-border bg-card space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <Badge
                          className={cn(
                            "text-xs font-bold uppercase",
                            req.request_type === "add"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : req.request_type === "remove"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40",
                          )}
                        >
                          {req.request_type === "add"
                            ? "Recommend New Vendor"
                            : req.request_type === "remove"
                            ? "Removal Request"
                            : "Issue Report"}
                        </Badge>
                        <span className="font-bold text-base text-white">{req.vendor_name}</span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Submitted by: <strong className="text-white">{req.agent_name}</strong> ({req.agent_email})
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border">
                        <div className="font-semibold text-gold">Vendor Details Submitted:</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div>Region: <strong>{getRegionShortLabel(req.region || "")}</strong></div>
                          <div>Category: <strong>{targetCategory?.name || "Not specified"}</strong></div>
                          {req.primary_contact && <div>Contact: {req.primary_contact}</div>}
                          {req.phone && <div>Phone: <span className="font-mono">{req.phone}</span></div>}
                          {req.email && <div>Email: {req.email}</div>}
                          {req.website && <div>Website: {req.website}</div>}
                          {req.specialty_notes && <div>Notes: {req.specialty_notes}</div>}
                        </div>
                      </div>

                      <div className="space-y-2 bg-card p-3 rounded-lg border border-border flex flex-col justify-between">
                        <div>
                          <div className="font-semibold text-rose-400">Agent Reason / Feedback:</div>
                          <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                            "{req.reason}"
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-3">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              reviewMutation.mutate({
                                requestId: req.id,
                                decision: "rejected",
                              });
                            }}
                            disabled={reviewMutation.isPending}
                            className="text-xs h-8"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Deny Request
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              reviewMutation.mutate({
                                requestId: req.id,
                                decision: "approved",
                              });
                            }}
                            disabled={reviewMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {req.request_type === "add"
                              ? "Approve & Add to Directory"
                              : req.request_type === "remove"
                              ? "Approve Removal"
                              : "Acknowledge Flag"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Categories */}
        <TabsContent value="categories" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Categories group vendors across both regions and determine PDF layout ordering.
            </div>
            <Button
              onClick={() => openCategoryEditor()}
              size="sm"
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
            </Button>
          </div>

          <Card className="overflow-hidden border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Assigned Vendors</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => {
                  const assignedCount = vendors.filter((v) => v.category_id === cat.id).length;

                  return (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-xs">{cat.sort_order}</TableCell>
                      <TableCell className="font-semibold text-white">{cat.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {cat.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {assignedCount} vendor{assignedCount === 1 ? "" : "s"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCategoryEditor(cat)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={assignedCount > 0}
                            onClick={() => {
                              if (confirm(`Delete category "${cat.name}"?`)) {
                                deleteCategoryMutation.mutate(cat.id);
                              }
                            }}
                            className="h-8 w-8 text-rose-400 hover:text-rose-300 disabled:opacity-30"
                            title={assignedCount > 0 ? "Cannot delete category with assigned vendors" : "Delete category"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 4: Bulk CSV Import */}
        <TabsContent value="import" className="space-y-6 mt-6">
          <Card className="p-6 border-border bg-card space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-gold" />
                Bulk Import Vendors from CSV
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a structured CSV export from your Google Doc to seed or update the entire vendor directory.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gold file:text-navy hover:file:bg-gold/90 cursor-pointer"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSampleCsv}
                className="text-xs h-9 border-border"
              >
                <FileDown className="h-3.5 w-3.5 mr-1" /> Download CSV Template
              </Button>
            </div>

            {parsedImportRows.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-emerald-400">
                    Ready to import {parsedImportRows.length} vendor records
                  </div>
                  <Button
                    onClick={() => bulkImportMutation.mutate(parsedImportRows)}
                    disabled={bulkImportMutation.isPending}
                    className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold h-9"
                  >
                    {bulkImportMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    Confirm & Import {parsedImportRows.length} Vendors
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedImportRows.slice(0, 15).map((r, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-semibold text-white">{r.name}</TableCell>
                          <TableCell>{r.category_name}</TableCell>
                          <TableCell>{r.region}</TableCell>
                          <TableCell className="font-mono">{r.phone}</TableCell>
                          <TableCell>{r.primary_contact || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedImportRows.length > 15 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Showing first 15 rows of {parsedImportRows.length}...
                  </p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Vendor Edit/Create Dialog */}
      <Dialog open={vendorEditorOpen} onOpenChange={setVendorEditorOpen}>
        <DialogContent className="max-w-lg bg-card border-gold/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {editingVendor ? `Edit: ${editingVendor.name}` : "Add New Vendor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Region *</label>
                <Select value={vRegion} onValueChange={setVRegion}>
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
                <Select value={vCategory} onValueChange={setVCategory}>
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
              <label className="text-xs font-medium text-muted-foreground">Company / Vendor Name *</label>
              <Input
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="e.g. Apex Roofing"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Primary Contact Person</label>
                <Input
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                  placeholder="e.g. Dave Roberts"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Phone Number *</label>
                <Input
                  value={vPhone}
                  onChange={(e) => setVPhone(e.target.value)}
                  placeholder="573-555-1234"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Website</label>
                <Input
                  value={vWebsite}
                  onChange={(e) => setVWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Specialty / Notes</label>
              <Textarea
                value={vNotes}
                onChange={(e) => setVNotes(e.target.value)}
                placeholder="Specialties, hours, discounts, pricing notes..."
                className="text-xs h-16"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Directory Status</label>
                <Select value={vStatus} onValueChange={(val: any) => setVStatus(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Visible)</SelectItem>
                    <SelectItem value="flagged">Flagged (Issue reported)</SelectItem>
                    <SelectItem value="archived">Archived (Hidden)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border mt-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-white">Preferred Vendor</div>
                  <div className="text-[10px] text-muted-foreground">Display badge</div>
                </div>
                <Switch checked={vIsPreferred} onCheckedChange={setVIsPreferred} />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVendorEditorOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!vName.trim()) return toast.error("Please enter vendor name");
                if (!vPhone.trim()) return toast.error("Please enter phone number");
                if (!vCategory) return toast.error("Please select a category");

                vendorMutation.mutate({
                  id: editingVendor?.id,
                  name: vName.trim(),
                  category_id: vCategory,
                  region: vRegion,
                  primary_contact: vContact.trim() || null,
                  phone: vPhone.trim(),
                  email: vEmail.trim() || null,
                  website: vWebsite.trim() || null,
                  specialty_notes: vNotes.trim() || null,
                  is_preferred: vIsPreferred,
                  status: vStatus,
                });
              }}
              disabled={vendorMutation.isPending}
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold"
            >
              {vendorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {editingVendor ? "Save Changes" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Edit/Create Dialog */}
      <Dialog open={catEditorOpen} onOpenChange={setCatEditorOpen}>
        <DialogContent className="max-w-md bg-card border-gold/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {editingCategory ? `Edit: ${editingCategory.name}` : "Add Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Category Name *</label>
              <Input
                value={cName}
                onChange={(e) => {
                  setCName(e.target.value);
                  if (!editingCategory) {
                    setCSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                  }
                }}
                placeholder="e.g. Home Inspectors"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Slug (URL Key) *</label>
              <Input
                value={cSlug}
                onChange={(e) => setCSlug(e.target.value)}
                placeholder="e.g. home-inspectors"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sort Order (Lower = First)</label>
              <Input
                type="number"
                value={cSort}
                onChange={(e) => setCSort(parseInt(e.target.value, 10) || 0)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatEditorOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!cName.trim()) return toast.error("Category name required");
                categoryMutation.mutate({
                  id: editingCategory?.id,
                  name: cName.trim(),
                  slug: cSlug.trim() || cName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                  sort_order: cSort,
                });
              }}
              disabled={categoryMutation.isPending}
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold"
            >
              {categoryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {editingCategory ? "Update Category" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
