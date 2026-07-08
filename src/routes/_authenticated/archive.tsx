import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Upload, Search, X, Download, Link as LinkIcon, ExternalLink, Pencil, Trash2, FileText, Image as ImageIcon, Film, Plus, CalendarPlus } from "lucide-react";
import { toCsv, downloadCsv, todayStamp } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ARCHIVE_CONTENT_TYPES, ARCHIVE_PLATFORMS, ARCHIVE_SORTS,
  formatBytes, isImage, isPdf,
  type ArchiveItem, type ArchiveSort,
} from "@/lib/archive";
import { BRANDS, BRAND_STYLES, PLATFORM_CHIP, type Brand } from "@/lib/content";

export const Route = createFileRoute("/_authenticated/archive")({
  component: ArchivePage,
  head: () => ({ meta: [{ title: "Content Archive — Marketing Department" }] }),
});

interface Member { id: string; email: string; first_name: string | null; last_name: string | null; }
const memberName = (m: Member) =>
  [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || m.email;

const BUCKET = "content-archive";
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}

function ArchivePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [brand, setBrand] = useState<"all" | Brand>("all");
  const [agent, setAgent] = useState<string>("all");
  const [campaign, setCampaign] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<ArchiveSort>("newest");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["archive"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_archive").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ArchiveItem[];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });
  const memberMap = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);


  const agents = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (i.agent_name) s.add(i.agent_name); });
    return Array.from(s).sort();
  }, [items]);

  const campaigns = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (i.campaign_tag) s.add(i.campaign_tag); });
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let res = items.filter((i) => {
      if (q) {
        const hay = [i.title, i.notes, i.campaign_tag, i.agent_name, i.listing_address].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (contentType !== "all" && i.content_type !== contentType) return false;
      if (platform !== "all" && !i.platforms.includes(platform)) return false;
      if (brand !== "all" && (i.brand ?? "PP") !== brand) return false;
      if (agent !== "all" && i.agent_name !== agent) return false;
      if (campaign !== "all" && i.campaign_tag !== campaign) return false;
      if (dateFrom && i.date_created < dateFrom) return false;
      if (dateTo && i.date_created > dateTo) return false;
      return true;
    });
    res = [...res];
    if (sort === "newest") res.sort((a, b) => (a.date_created < b.date_created ? 1 : -1));
    else if (sort === "oldest") res.sort((a, b) => (a.date_created > b.date_created ? 1 : -1));
    else if (sort === "type") res.sort((a, b) => a.content_type.localeCompare(b.content_type));
    else if (sort === "agent") res.sort((a, b) => (a.agent_name ?? "").localeCompare(b.agent_name ?? ""));
    return res;
  }, [items, search, contentType, platform, brand, agent, campaign, dateFrom, dateTo, sort]);

  const totalBytes = useMemo(() => items.reduce((s, i) => s + (i.file_size ?? 0), 0), [items]);

  const clearFilters = () => {
    setSearch(""); setContentType("all"); setPlatform("all"); setBrand("all"); setAgent("all"); setCampaign("all"); setDateFrom(""); setDateTo("");
  };

  const hasFilters = search || contentType !== "all" || platform !== "all" || brand !== "all" || agent !== "all" || campaign !== "all" || dateFrom || dateTo;

  const handleExport = () => {
    const headers = [
      "Title", "Content Type", "Platforms", "Agent", "Linked Listing", "Date Created",
      "Campaign Tag", "Notes", "File URL", "Drive URL", "File Size", "Uploaded By", "Created Date",
    ];
    const rows = filtered.map((i) => {
      const uploader = i.uploaded_by ? memberMap.get(i.uploaded_by) : null;
      return [
        i.title,
        i.content_type,
        (i.platforms ?? []).join("; "),
        i.agent_name ?? "",
        i.listing_address ?? "",
        i.date_created ?? "",
        i.campaign_tag ?? "",
        i.notes ?? "",
        i.file_url ?? "",
        i.drive_url ?? "",
        i.file_size != null ? String(i.file_size) : "",
        uploader ? memberName(uploader) : (i.uploaded_by ?? ""),
        i.created_at ? format(new Date(i.created_at), "yyyy-MM-dd HH:mm") : "",
      ];
    });
    downloadCsv(`MSREG-Content-Archive-${todayStamp()}.csv`, toCsv(headers, rows));
    toast.success(`Exported ${rows.length} archive item${rows.length === 1 ? "" : "s"}`);
  };


  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Content Archive</h1>
          <p className="text-sm text-muted-foreground mt-1">Searchable library of every finished asset.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-xs text-muted-foreground">
            Storage used: <span className="font-medium text-foreground">{formatBytes(totalBytes)}</span> across {items.length} files
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button onClick={() => setUploadOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="h-4 w-4 mr-1.5" /> Upload
          </Button>
        </div>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title, notes, campaign, agent, listing…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <FilterSelect value={contentType} onChange={setContentType} placeholder="All types" options={ARCHIVE_CONTENT_TYPES} />
          <FilterSelect value={platform} onChange={setPlatform} placeholder="All platforms" options={ARCHIVE_PLATFORMS} />
          <FilterSelect value={brand} onChange={(v) => setBrand(v as "all" | Brand)} placeholder="All brands" options={BRANDS} />
          <FilterSelect value={agent} onChange={setAgent} placeholder="All agents" options={agents} />
          <FilterSelect value={campaign} onChange={setCampaign} placeholder="All campaigns" options={campaigns} />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto h-9" aria-label="From date" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto h-9" aria-label="To date" />
          <div className="flex-1" />
          <Select value={sort} onValueChange={(v) => setSort(v as ArchiveSort)}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ARCHIVE_SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-3.5 w-3.5 mr-1" />Clear</Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`}
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center text-muted-foreground">
          {hasFilters ? "No assets match your filters." : "No assets yet. Upload your first piece to get started."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => <ArchiveCard key={item.id} item={item} onClick={() => setDetailId(item.id)} />)}
        </div>
      )}

      {uploadOpen && <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} userId={user?.id ?? null} onDone={() => qc.invalidateQueries({ queryKey: ["archive"] })} />}
      {detailId && <DetailDialog id={detailId} open={true} onOpenChange={(o) => !o && setDetailId(null)} />}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[140px] h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ArchiveCard({ item, onClick }: { item: ArchiveItem; onClick: () => void }) {
  const { data: thumb } = useQuery({
    queryKey: ["archive-thumb", item.id, item.file_path],
    queryFn: async () => (item.file_path && isImage(item.file_type) ? signedUrl(item.file_path) : null),
    enabled: !!item.file_path && isImage(item.file_type),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <button onClick={onClick} className="group text-left bg-card border border-border rounded-lg overflow-hidden hover:border-gold/60 transition-colors">
      <div className="aspect-square bg-muted/40 relative overflow-hidden flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
        ) : item.drive_url ? (
          <Film className="h-10 w-10 text-muted-foreground" />
        ) : isPdf(item.file_type) ? (
          <FileText className="h-10 w-10 text-muted-foreground" />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        )}
        <Badge className="absolute top-2 left-2 bg-background/90 text-foreground border border-border">{item.content_type}</Badge>
        <span className={cn("absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded border", BRAND_STYLES[(item.brand ?? "PP") as Brand])}>
          {item.brand ?? "PP"}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="font-medium text-sm line-clamp-2">{item.title}</div>
        {item.platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.platforms.slice(0, 3).map((p) => <Badge key={p} variant="outline" className={cn("text-[10px] px-1.5 py-0", PLATFORM_CHIP[p])}>{p}</Badge>)}
            {item.platforms.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{item.platforms.length - 3}</Badge>}
          </div>
        )}
        <div className="text-xs text-muted-foreground flex justify-between items-center">
          <span className="truncate">{item.agent_name ?? "—"}</span>
          <span>{format(new Date(item.date_created), "MMM d, yyyy")}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">{item.drive_url ? "Google Drive" : formatBytes(item.file_size)}</div>
      </div>
    </button>
  );
}

function UploadDialog({ open, onOpenChange, userId, onDone, edit }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string | null; onDone: () => void; edit?: ArchiveItem }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const isEdit = !!edit;

  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const initialAgent = edit?.agent_name ?? "";
  const matchedMember = members.find((m) => memberName(m) === initialAgent);

  const [form, setForm] = useState<{
    title: string; content_type: string; platforms: string[]; brand: Brand;
    agent_mode: "member" | "freeform"; agent_member_id: string; agent_freeform: string;
    listing_address: string; date_created: string; campaign_tag: string; notes: string; drive_url: string;
  }>({
    title: edit?.title ?? "",
    content_type: edit?.content_type ?? "Social Graphic",
    platforms: edit?.platforms ?? [],
    brand: (edit?.brand ?? "PP") as Brand,
    agent_mode: matchedMember || !initialAgent ? "member" : "freeform",
    agent_member_id: matchedMember?.id ?? "",
    agent_freeform: matchedMember ? "" : initialAgent,
    listing_address: edit?.listing_address ?? "",
    date_created: edit?.date_created ?? format(new Date(), "yyyy-MM-dd"),
    campaign_tag: edit?.campaign_tag ?? "",
    notes: edit?.notes ?? "",
    drive_url: edit?.drive_url ?? "",
  });

  const isVideo = form.content_type === "Video";

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!form.title.trim()) throw new Error("Title is required");
      if (isVideo && !form.drive_url.trim()) throw new Error("Google Drive URL required for videos");
      if (!isVideo && !file && !isEdit) throw new Error("Please select a file");

      let file_path = edit?.file_path ?? null;
      let file_url = edit?.file_url ?? null;
      let file_type = edit?.file_type ?? null;
      let file_size = edit?.file_size ?? null;

      if (!isVideo && file) {
        const ALLOWED = new Set([
          "image/jpeg", "image/png", "image/webp",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]);
        if (file.size > 25 * 1024 * 1024) throw new Error("File is over 25MB.");
        if (file.type && !ALLOWED.has(file.type)) throw new Error("File type not allowed. Use JPG, PNG, WEBP, PDF, or DOC/DOCX.");
        if (!/\.(jpe?g|png|webp|pdf|docx?)$/i.test(file.name)) throw new Error("File extension not allowed.");
        setUploading(true);
        try {
          const d = new Date(form.date_created || Date.now());
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
          const path = `${yyyy}/${mm}/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
          if (upErr) throw upErr;
          file_path = path;
          file_type = file.type;
          file_size = file.size;
          // 1-hour signed URL for previews; refreshed on demand elsewhere.
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
          file_url = signed?.signedUrl ?? null;
        } finally { setUploading(false); }
      }

      const agentName = form.agent_mode === "member"
        ? (members.find((m) => m.id === form.agent_member_id) ? memberName(members.find((m) => m.id === form.agent_member_id)!) : null)
        : (form.agent_freeform.trim() || null);

      const payload = {
        title: form.title.trim(),
        content_type: form.content_type,
        platforms: form.platforms,
        brand: form.brand,
        agent_name: agentName,
        listing_address: form.listing_address.trim() || null,
        date_created: form.date_created,
        campaign_tag: form.campaign_tag.trim() || null,
        notes: form.notes.trim() || null,
        drive_url: isVideo ? form.drive_url.trim() : null,
        file_path: isVideo ? null : file_path,
        file_url: isVideo ? null : file_url,
        file_type: isVideo ? null : file_type,
        file_size: isVideo ? null : file_size,
      };

      if (isEdit) {
        const { error } = await supabase.from("content_archive").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_archive").insert({ ...payload, uploaded_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "Updated" : "Uploaded"); onDone(); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit asset" : "Upload to archive"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div>
            <Label>Content type</Label>
            <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{ARCHIVE_CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {isVideo ? (
            <div>
              <Label>Google Drive URL *</Label>
              <Input className="mt-1.5" value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })} placeholder="https://drive.google.com/..." />
              <p className="text-xs text-muted-foreground mt-1">Videos are linked from Drive — not stored here.</p>
            </div>
          ) : (
            <div>
              <Label>File {!isEdit && "*"}</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose file
                </Button>
                <div className="text-xs text-muted-foreground truncate">
                  {file ? `${file.name} (${formatBytes(file.size)})` : isEdit ? "Keep existing file" : "JPG, PNG, WEBP, PDF, DOC, XLS, PPT"}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} required />
          </div>

          <div>
            <Label>Platforms</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ARCHIVE_PLATFORMS.map((p) => (
                <label key={p} className={cn(
                  "flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm cursor-pointer",
                  form.platforms.includes(p) ? PLATFORM_CHIP[p] : "border-border hover:bg-accent/40",
                )}>
                  <Checkbox checked={form.platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Brand</Label>
            <div className="mt-2 flex gap-2">
              {BRANDS.map((b) => (
                <button type="button" key={b}
                  onClick={() => setForm({ ...form, brand: b })}
                  className={cn(
                    "px-3 py-1.5 border rounded-md text-sm font-semibold transition-colors",
                    form.brand === b ? BRAND_STYLES[b] : "border-border text-muted-foreground hover:bg-accent/40",
                  )}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Agent</Label>
              <div className="flex gap-1 mt-1.5 mb-2">
                <Button type="button" size="sm" variant={form.agent_mode === "member" ? "default" : "outline"} onClick={() => setForm({ ...form, agent_mode: "member" })}>Team member</Button>
                <Button type="button" size="sm" variant={form.agent_mode === "freeform" ? "default" : "outline"} onClick={() => setForm({ ...form, agent_mode: "freeform" })}>Other</Button>
              </div>
              {form.agent_mode === "member" ? (
                <Select value={form.agent_member_id} onValueChange={(v) => setForm({ ...form, agent_member_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{memberName(m)}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={form.agent_freeform} onChange={(e) => setForm({ ...form, agent_freeform: e.target.value })} placeholder="Agent name" />
              )}
            </div>
            <div>
              <Label htmlFor="listing">Listing address</Label>
              <Input id="listing" className="mt-1.5" value={form.listing_address} onChange={(e) => setForm({ ...form, listing_address: e.target.value })} placeholder="123 Main St" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date created</Label>
              <Input id="date" type="date" className="mt-1.5" value={form.date_created} onChange={(e) => setForm({ ...form, date_created: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="campaign">Campaign / project</Label>
              <Input id="campaign" className="mt-1.5" value={form.campaign_tag} onChange={(e) => setForm({ ...form, campaign_tag: e.target.value })} placeholder="Spring Open House" />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" className="mt-1.5" rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || uploading} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {uploading ? "Uploading…" : mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: item } = useQuery({
    queryKey: ["archive-item", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_archive").select("*").eq("id", id).single();
      if (error) throw error;
      return data as ArchiveItem;
    },
  });

  const { data: previewUrl } = useQuery({
    queryKey: ["archive-preview", id, item?.file_path],
    queryFn: async () => (item?.file_path ? signedUrl(item.file_path) : null),
    enabled: !!item?.file_path,
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!item) return;
      if (item.file_path) await supabase.storage.from(BUCKET).remove([item.file_path]);
      const { error } = await supabase.from("content_archive").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["archive"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const copyLink = async () => {
    if (item?.drive_url) { await navigator.clipboard.writeText(item.drive_url); toast.success("Drive link copied"); return; }
    if (item?.file_path) {
      const url = await signedUrl(item.file_path);
      await navigator.clipboard.writeText(url);
      toast.success("Signed link copied (24h)");
    }
  };

  if (editing && item) {
    return <UploadDialog open={true} onOpenChange={(o) => { if (!o) setEditing(false); }} userId={user?.id ?? null} onDone={() => { qc.invalidateQueries({ queryKey: ["archive"] }); qc.invalidateQueries({ queryKey: ["archive-item", id] }); }} edit={item} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!item ? <div className="p-8 text-center text-muted-foreground">Loading…</div> : (
          <>
            <DialogHeader><DialogTitle>{item.title}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center min-h-[260px] max-h-[480px]">
                {item.drive_url ? (
                  <div className="p-10 text-center space-y-3">
                    <Film className="h-12 w-12 text-muted-foreground mx-auto" />
                    <Button asChild><a href={item.drive_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1.5" />Open in Google Drive</a></Button>
                  </div>
                ) : isImage(item.file_type) && previewUrl ? (
                  <img src={previewUrl} alt={item.title} className="max-h-[480px] w-auto object-contain" />
                ) : isPdf(item.file_type) && previewUrl ? (
                  <iframe src={previewUrl} title={item.title} className="w-full h-[480px]" />
                ) : (
                  <div className="p-10 text-center"><FileText className="h-12 w-12 text-muted-foreground mx-auto" /><div className="text-sm text-muted-foreground mt-2">{item.file_type ?? "File"}</div></div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Meta label="Content type">{item.content_type}</Meta>
                <Meta label="Date created">{format(new Date(item.date_created), "MMM d, yyyy")}</Meta>
                <Meta label="Agent">{item.agent_name ?? "—"}</Meta>
                <Meta label="Listing">{item.listing_address ?? "—"}</Meta>
                <Meta label="Campaign">{item.campaign_tag ?? "—"}</Meta>
                <Meta label="Size">{item.drive_url ? "Google Drive" : formatBytes(item.file_size)}</Meta>
                <Meta label="Platforms" full>
                  {item.platforms.length ? (
                    <div className="flex flex-wrap gap-1">{item.platforms.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}</div>
                  ) : "—"}
                </Meta>
                {item.notes && <Meta label="Notes" full><div className="whitespace-pre-wrap">{item.notes}</div></Meta>}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {item.drive_url ? (
                  <Button asChild><a href={item.drive_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1.5" />Open Drive</a></Button>
                ) : previewUrl ? (
                  <Button asChild><a href={previewUrl} download={item.title}><Download className="h-4 w-4 mr-1.5" />Download</a></Button>
                ) : null}
                <Button variant="outline" onClick={copyLink}><LinkIcon className="h-4 w-4 mr-1.5" />Copy link</Button>
                <Button variant="outline" asChild>
                  <Link
                    to="/calendar"
                    search={{
                      prefillTitle: item.title,
                      prefillThumb: !item.drive_url && previewUrl ? previewUrl : undefined,
                      prefillPlatforms: item.platforms.join(","),
                      prefillNotes: item.notes ?? undefined,
                    }}
                  >
                    <CalendarPlus className="h-4 w-4 mr-1.5" />Add to Calendar
                  </Link>
                </Button>
                {(user?.id === item.uploaded_by) && (
                  <>
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
                    <Button variant="outline" className="text-destructive" onClick={() => { if (confirm("Delete this asset?")) del.mutate(); }}>
                      <Trash2 className="h-4 w-4 mr-1.5" />Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn(full && "col-span-2")}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
