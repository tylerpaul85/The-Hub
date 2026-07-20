import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORMS, PLATFORM_CHIP, STATUSES, PRIORITIES, STATUS_LABEL, STATUS_CLASS, PRIORITY_LABEL, BRANDS, BRAND_STYLES, type Brand, type Status, type Priority, type ContentItem } from "@/lib/content";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, Trash2, Upload, History, Send, X, Check, Loader2, ExternalLink, Plus, ListChecks, Paperclip, FileText, Download } from "lucide-react";
import { makeStorageKey } from "@/lib/sanitize-filename";
import { cn } from "@/lib/utils";
import { ChatThread } from "@/components/chat-thread";
import { Linkify } from "@/lib/linkify";

interface Props {
  itemId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

type NoteAttachment = { name: string; url: string; type: string; size?: number };

type FormShape = {
  title: string; caption: string; platforms: string[]; status: Status;
  scheduled_at: string; link: string; priority: Priority; notes: string;
  image_urls: string[]; target_publish_date: string; brand: Brand;
  canva_link: string; description: string;
  blog_content: string; blog_doc_link: string;
  youtube_thumbnail_url: string; youtube_video_title: string;
  email_subject_line: string; email_body: string;
  meta_media_link: string; meta_graphic_link: string; meta_video_link: string; meta_copy: string;
  revision_note: string;
  note_attachments: NoteAttachment[];
};

const META_PLATFORMS = ["Meta", "Meta PP", "Meta LOZ"];

export function ContentItemDetail({ itemId, open, onOpenChange }: Props) {
  const { user, canEditContent, canDelete } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const noteFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const { data: item, isLoading } = useQuery({
    queryKey: ["content-item", itemId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("content_items").select("*").eq("id", itemId).single();
      if (error) throw error;
      return data as ContentItem;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["content-history", itemId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_history").select("id,field,old_value,new_value,user_id,created_at").eq("content_id", itemId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all-detail"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_team_members");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>;
    },
  });
  const nameOf = (id: string | null) => {
    const p = (profiles as any[]).find((x) => x.id === id);
    if (!p) return "Unknown user";
    const f = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    return f || p.email;
  };

  const emptyForm: FormShape = {
    title: "", caption: "", platforms: [], status: "draft", scheduled_at: "", link: "",
    priority: "normal", notes: "", image_urls: [], target_publish_date: "", brand: "PP",
    canva_link: "", description: "", blog_content: "", blog_doc_link: "",
    youtube_thumbnail_url: "", youtube_video_title: "", email_subject_line: "", email_body: "",
    meta_media_link: "", meta_graphic_link: "", meta_video_link: "", meta_copy: "", revision_note: "", note_attachments: [],
  };
  const [form, setForm] = useState<FormShape>(emptyForm);
  const lastSavedRef = useRef<string>("");
  const skipNextAutosaveRef = useRef<boolean>(true);
  const lastItemIdRef = useRef<string>("");

  useEffect(() => {
    if (!item) return;
    const isFocused = typeof document !== "undefined" && document.activeElement && (
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA"
    );
    const isNewItem = lastItemIdRef.current !== itemId;
    lastItemIdRef.current = itemId;

    if (isNewItem || !isFocused) {
      const next: FormShape = {
        title: item.title,
        caption: item.caption ?? "",
        platforms: item.platforms,
        status: item.status,
        scheduled_at: toLocalInput(new Date(item.scheduled_at)),
        link: item.link ?? "",
        priority: item.priority,
        notes: item.notes ?? "",
        image_urls: (item.image_urls && item.image_urls.length > 0) ? item.image_urls : (item.thumbnail_url ? [item.thumbnail_url] : []),
        target_publish_date: item.target_publish_date ?? "",
        brand: (item.brand ?? "PP") as Brand,
        canva_link: item.canva_link ?? "",
        description: item.description ?? "",
        blog_content: item.blog_content ?? "",
        blog_doc_link: item.blog_doc_link ?? "",
        youtube_thumbnail_url: item.youtube_thumbnail_url ?? "",
        youtube_video_title: item.youtube_video_title ?? "",
        email_subject_line: item.email_subject_line ?? "",
        email_body: (item as any).email_body ?? "",
        meta_media_link: item.meta_media_link ?? "",
        meta_graphic_link: (item as any).meta_graphic_link ?? "",
        meta_video_link: (item as any).meta_video_link ?? "",
        meta_copy: item.meta_copy ?? "",
        revision_note: item.revision_note ?? "",
        note_attachments: Array.isArray((item as any).note_attachments) ? (item as any).note_attachments : [],
      };
      setForm(next);
      lastSavedRef.current = JSON.stringify(next);
      skipNextAutosaveRef.current = true;
      setSaveState("idle");
    }
  }, [item, itemId]);

  const buildPayload = (f: FormShape) => ({
    title: f.title.trim(),
    caption: f.caption || null,
    platforms: f.platforms,
    status: f.status,
    scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
    link: f.link || null,
    priority: f.priority,
    notes: f.notes || null,
    thumbnail_url: f.image_urls[0] ?? null,
    image_urls: f.image_urls,
    target_publish_date: f.target_publish_date || null,
    brand: f.brand,
    canva_link: f.canva_link || null,
    description: f.description || null,
    blog_content: f.blog_content || null,
    blog_doc_link: f.blog_doc_link || null,
    youtube_thumbnail_url: f.youtube_thumbnail_url || null,
    youtube_video_title: f.youtube_video_title || null,
    email_subject_line: f.email_subject_line || null,
    email_body: f.email_body || null,
    meta_media_link: f.meta_media_link || null,
    meta_graphic_link: f.meta_graphic_link || null,
    meta_video_link: f.meta_video_link || null,
    meta_copy: f.meta_copy || null,
    revision_note: f.revision_note || null,
    note_attachments: f.note_attachments,
  });

  const autosave = async (f: FormShape) => {
    if (!canEditContent) return;
    if (!f.title.trim() || !f.scheduled_at) return;
    setSaveState("saving");
    const payload = buildPayload(f);
    const { error } = await (supabase as any).from("content_items").update(payload).eq("id", itemId);
    if (error) {
      setSaveState("idle");
      toast.error(error.message ?? "Auto-save failed");
      return;
    }
    lastSavedRef.current = JSON.stringify(f);
    setSaveState("saved");
    qc.invalidateQueries({ queryKey: ["content-item", itemId] });
    qc.invalidateQueries({ queryKey: ["content-items"] });
    qc.invalidateQueries({ queryKey: ["content-items-list"] });
    qc.invalidateQueries({ queryKey: ["content-history", itemId] });
    window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
  };

  // Debounced auto-save
  useEffect(() => {
    if (!item) return;
    if (skipNextAutosaveRef.current) { skipNextAutosaveRef.current = false; return; }
    const current = JSON.stringify(form);
    if (current === lastSavedRef.current) return;
    const t = window.setTimeout(() => { autosave(form); }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("content_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      onOpenChange(false);
    },
  });

  const handleUpload = async (files: FileList | File[]) => {
    if (!user) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of arr) {
        const path = makeStorageKey(user.id, file.name);
        const { error: upErr } = await supabase.storage.from("content-thumbnails").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await supabase.storage.from("content-thumbnails").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sErr) throw sErr;
        newUrls.push(signed.signedUrl);
      }
      setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...newUrls] }));
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, image_urls: f.image_urls.filter((_, i) => i !== idx) }));
  };

  const handleNoteUpload = async (files: FileList | File[]) => {
    if (!user) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploadingNote(true);
    try {
      const added: NoteAttachment[] = [];
      for (const file of arr) {
        const path = makeStorageKey(`${user.id}/notes`, file.name);
        const { error: upErr } = await supabase.storage.from("content-thumbnails").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await supabase.storage.from("content-thumbnails").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sErr) throw sErr;
        added.push({ name: file.name, url: signed.signedUrl, type: file.type || "application/octet-stream", size: file.size });
      }
      setForm((f) => ({ ...f, note_attachments: [...f.note_attachments, ...added] }));
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploadingNote(false);
    }
  };

  const removeNoteAttachment = (idx: number) => {
    setForm((f) => ({ ...f, note_attachments: f.note_attachments.filter((_, i) => i !== idx) }));
  };

  const togglePlatform = (p: string) => {
    if (!canEditContent) return;
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));
  };

  const handleStatusChange = (v: Status) => {
    if (v === "needs_revision" && form.status !== "needs_revision") {
      setRevisionNoteDraft(form.revision_note ?? "");
      setRevisionOpen(true);
      return;
    }
    setForm({ ...form, status: v });
  };

  const submitRevision = () => {
    if (!revisionNoteDraft.trim()) { toast.error("Revision note is required"); return; }
    setForm((f) => ({ ...f, status: "needs_revision", revision_note: revisionNoteDraft.trim() }));
    setRevisionOpen(false);
    toast.success("Marked Needs Revision — contributor notified");
  };

  const submitForReApproval = () => {
    setForm((f) => ({ ...f, status: "pending_re_approval" }));
    toast.success("Submitted for re-approval — admins notified");
  };

  const targetMissed = item?.target_publish_date
    && new Date(item.target_publish_date) < new Date(new Date().toDateString())
    && item.status !== "published";

  const isContributor = !!user && item?.created_by === user.id;

  const hasPlatform = (p: string) => form.platforms.includes(p);
  const showMeta = META_PLATFORMS.some(hasPlatform);

  if (isLoading || !item) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent><div className="p-6 text-muted-foreground">Loading…</div></DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-base">{canEditContent ? "Edit Content" : "Content Details"}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded border font-semibold", BRAND_STYLES[(item.brand ?? "PP") as Brand])}>
              {item.brand ?? "PP"}
            </span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded border", STATUS_CLASS[item.status])}>
              {STATUS_LABEL[item.status]}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground capitalize">
              {PRIORITY_LABEL[item.priority]}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground font-normal">
              {saveState === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
              {saveState === "saved" && (<><Check className="h-3 w-3 text-emerald-400" /> Saved</>)}
              {saveState === "idle" && canEditContent && <span className="opacity-60">Auto-save on</span>}
            </span>
          </DialogTitle>
        </DialogHeader>

        {item.status === "needs_revision" && form.revision_note && (
          <div className="rounded-md bg-destructive/15 border border-destructive/40 p-3">
            <div className="flex items-center gap-2 text-destructive text-sm font-semibold mb-1">
              <AlertTriangle className="h-4 w-4" /> Needs Revision
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap"><Linkify text={form.revision_note} /></div>
            {isContributor && (
              <Button size="sm" onClick={submitForReApproval}
                className="mt-3 bg-gold text-gold-foreground hover:bg-gold/90">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Submit for Re-Approval
              </Button>
            )}
          </div>
        )}

        {item.status === "pending_re_approval" && (
          <div className="rounded-md bg-[oklch(0.72_0.18_55)]/10 border border-[oklch(0.72_0.18_55)]/40 p-3 text-sm">
            <span className="font-semibold text-[oklch(0.82_0.18_55)]">Pending Re-Approval</span> — awaiting admin review.
          </div>
        )}

        {targetMissed && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" /> Target publish date ({item.target_publish_date}) has passed without Published status.
          </div>
        )}

        <fieldset disabled={!canEditContent} className="space-y-5 disabled:opacity-95">
          {/* ===== TOP: Title, Notes, Chat ===== */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1.5 text-lg font-semibold h-12 bg-background border-gold/30 focus-visible:border-gold"
              maxLength={200}
              placeholder="Content title"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              maxLength={2000}
              className="mt-1.5"
              placeholder="Internal notes for the team…"
            />
            {form.notes && (
              <div className="mt-1 text-[11px] text-muted-foreground"><Linkify text={form.notes} /></div>
            )}

            {/* Note attachments (photos + files) */}
            <div className="mt-3 space-y-2">
              {form.note_attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.note_attachments.map((a, i) => {
                    const isImg = a.type?.startsWith("image/");
                    return (
                      <div key={i} className="relative group">
                        {isImg ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}>
                            <img src={a.url} alt={a.name} className="h-20 w-20 object-cover rounded-md border border-gold/30" />
                          </a>
                        ) : (
                          <a href={a.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-gold/30 bg-card/50 text-xs hover:bg-accent/40 max-w-[220px]"
                            title={a.name}>
                            <FileText className="h-4 w-4 text-gold flex-shrink-0" />
                            <span className="truncate">{a.name}</span>
                            <Download className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </a>
                        )}
                        {canEditContent && (
                          <button type="button" onClick={() => removeNoteAttachment(i)}
                            className="absolute -top-1.5 -right-1.5 bg-black/80 hover:bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {canEditContent && (
                <>
                  <input ref={noteFileRef} type="file" multiple className="hidden"
                    onChange={(e) => { const fs = e.target.files; if (fs && fs.length) handleNoteUpload(fs); if (noteFileRef.current) noteFileRef.current.value = ""; }} />
                  <Button type="button" size="sm" variant="outline" disabled={uploadingNote} onClick={() => noteFileRef.current?.click()}>
                    <Paperclip className="h-3.5 w-3.5 mr-1.5" /> {uploadingNote ? "Uploading…" : "Attach photos or files"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <ChatThread parentId={itemId} kind="content" allowAttachments />

          {/* ===== MIDDLE: Tasks ===== */}

          <LinkedTasksPanel contentItemId={itemId} contentTitle={form.title} profiles={profiles as any[]} canEdit={!!canEditContent} />

          {/* ===== BELOW: Images, Caption, Platforms, Brand, Schedule, etc ===== */}
          <div className="pt-3 border-t border-border">
            <Label>Images</Label>
            <div className="mt-1.5 space-y-3">
              {form.image_urls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {form.image_urls.map((url, i) => (
                    <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
                      <img src={url} alt="" className="h-full w-full object-cover cursor-zoom-in" onClick={() => setLightbox(url)} />
                      {canEditContent && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-gold text-gold-foreground px-1.5 py-0.5 rounded">Cover</span>}
                    </div>
                  ))}
                </div>
              )}
              {form.image_urls.length === 0 && (
                <div className="text-xs text-muted-foreground">No images attached.</div>
              )}
              {canEditContent && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { const fs = e.target.files; if (fs && fs.length) handleUpload(fs); if (fileRef.current) fileRef.current.value = ""; }} />
                  <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> {uploading ? "Uploading…" : "Upload images"}
                  </Button>
                </>
              )}
            </div>
          </div>


          <div>
            <Label>Platforms</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <label key={p} className={cn(
                  "flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer text-sm",
                  form.platforms.includes(p) ? PLATFORM_CHIP[p] : "border-border hover:bg-accent/40",
                )}>
                  <Checkbox checked={form.platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>

          {/* Platform-specific fields */}
          {hasPlatform("Blog") && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">Blog details</div>
              <div>
                <Label className="text-xs">Blog content (for review)</Label>
                <Textarea value={form.blog_content} onChange={(e) => setForm({ ...form, blog_content: e.target.value })} rows={5} className="mt-1.5" placeholder="Paste blog body here…" />
              </div>
              <div>
                <Label className="text-xs">Doc link</Label>
                <Input type="url" value={form.blog_doc_link} onChange={(e) => setForm({ ...form, blog_doc_link: e.target.value })} placeholder="https://docs.google.com/…" className="mt-1.5" />
                {form.blog_doc_link && <a href={form.blog_doc_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline"><ExternalLink className="h-3 w-3" /> Open doc</a>}
              </div>
            </div>
          )}

          {hasPlatform("YouTube") && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-red-300">YouTube details</div>
              <div>
                <Label className="text-xs">Video title</Label>
                <Input value={form.youtube_video_title} onChange={(e) => setForm({ ...form, youtube_video_title: e.target.value })} className="mt-1.5" placeholder="YouTube video title" />
              </div>
              <div>
                <Label className="text-xs">Thumbnail link</Label>
                <Input type="url" value={form.youtube_thumbnail_url} onChange={(e) => setForm({ ...form, youtube_thumbnail_url: e.target.value })} placeholder="https://…" className="mt-1.5" />
                {form.youtube_thumbnail_url && <a href={form.youtube_thumbnail_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline"><ExternalLink className="h-3 w-3" /> Open thumbnail</a>}
              </div>
            </div>
          )}

          {hasPlatform("Mailchimp") && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-amber-300">Email (Mailchimp) details</div>
              <div>
                <Label className="text-xs">Subject line</Label>
                <Input value={form.email_subject_line} onChange={(e) => setForm({ ...form, email_subject_line: e.target.value })} className="mt-1.5" placeholder="Email subject" disabled={!canEditContent} />
              </div>
              <div>
                <Label className="text-xs">Email body</Label>
                <Textarea value={form.email_body} onChange={(e) => setForm({ ...form, email_body: e.target.value })} rows={8} className="mt-1.5" placeholder="Email body content…" disabled={!canEditContent} />
              </div>
            </div>
          )}

          {showMeta && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-blue-300">Meta (Facebook/Instagram) details</div>
              <div>
                <Label className="text-xs">Graphic link</Label>
                <Input type="url" value={form.meta_graphic_link} onChange={(e) => setForm({ ...form, meta_graphic_link: e.target.value })} placeholder="https://… (image / graphic)" className="mt-1.5" />
                {form.meta_graphic_link && <a href={form.meta_graphic_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline"><ExternalLink className="h-3 w-3" /> Open graphic</a>}
              </div>
              <div>
                <Label className="text-xs">Video link</Label>
                <Input type="url" value={form.meta_video_link} onChange={(e) => setForm({ ...form, meta_video_link: e.target.value })} placeholder="https://… (video)" className="mt-1.5" />
                {form.meta_video_link && <a href={form.meta_video_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline"><ExternalLink className="h-3 w-3" /> Open video</a>}
              </div>
              {form.meta_media_link && (
                <div>
                  <Label className="text-xs text-muted-foreground">Legacy media link</Label>
                  <Input type="url" value={form.meta_media_link} onChange={(e) => setForm({ ...form, meta_media_link: e.target.value })} placeholder="https://…" className="mt-1.5" />
                </div>
              )}
              <div>
                <Label className="text-xs">Copy</Label>
                <Textarea value={form.meta_copy} onChange={(e) => setForm({ ...form, meta_copy: e.target.value })} rows={4} className="mt-1.5" placeholder="Post copy…" />
              </div>
            </div>
          )}

          <div>
            <Label>Brand</Label>
            <div className="mt-2 flex gap-2">
              {BRANDS.map((b) => (
                <button type="button" key={b}
                  disabled={!canEditContent}
                  onClick={() => canEditContent && setForm({ ...form, brand: b })}
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => handleStatusChange(v as Status)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Scheduled Date & Time</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Target Publish Date</Label>
              <Input type="date" value={form.target_publish_date} onChange={(e) => setForm({ ...form, target_publish_date: e.target.value })} className="mt-1.5" />
            </div>
          </div>
        </fieldset>

        {(canEditContent || canDelete) && (
          <div className="flex justify-between items-center pt-2 border-t border-border">
            {canDelete ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this content item?")) del.mutate(); }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}

        {/* History */}
        <section className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Version History</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {history.length === 0 && <div className="text-xs text-muted-foreground">No changes recorded yet.</div>}
            {(history as any[]).map((h) => (
              <div key={h.id} className="text-xs flex items-start gap-2 py-1.5 border-b border-border/40">
                <span className="text-muted-foreground whitespace-nowrap">{format(new Date(h.created_at), "MMM d, h:mm a")}</span>
                <div className="flex-1">
                  <span className="font-medium text-gold capitalize">{h.field.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground"> changed by </span>
                  <span className="text-foreground">{nameOf(h.user_id)}</span>
                  <div className="text-muted-foreground truncate">
                    <span className="line-through">{h.old_value ?? "—"}</span>
                    <span className="mx-1">→</span>
                    <span className="text-foreground">{h.new_value ?? "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>

    <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Needs Revision
          </DialogTitle>
        </DialogHeader>
        <div>
          <Label>What changes need to be made?</Label>
          <Textarea
            className="mt-1.5"
            rows={5}
            value={revisionNoteDraft}
            onChange={(e) => setRevisionNoteDraft(e.target.value)}
            placeholder="Describe what the contributor should fix..."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setRevisionOpen(false)}>Cancel</Button>
          <Button onClick={submitRevision} disabled={!revisionNoteDraft.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Send Revision Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
      <DialogContent className="max-w-5xl p-2 bg-background/95 border-border">
        {lightbox && <img src={lightbox} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded" />}
      </DialogContent>
    </Dialog>
    </>
  );
}

// =====================================================
// Linked tasks panel (lives inside a content item)
// =====================================================
function LinkedTasksPanel({
  contentItemId, contentTitle, profiles, canEdit,
}: {
  contentItemId: string;
  contentTitle: string;
  profiles: Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>;
  canEdit: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskOwner, setTaskOwner] = useState<string>("");
  const [taskDue, setTaskDue] = useState<string>("");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high">("normal");
  const [taskDesc, setTaskDesc] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["content-linked-tasks", contentItemId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks").select("id,title,owner,due_date,status,priority")
        .eq("content_item_id", contentItemId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = profiles.find((x) => x.id === id);
    if (!p) return "Unknown";
    return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email;
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!taskTitle.trim()) throw new Error("Title is required");
      if (!user) throw new Error("Not signed in");
      const payload: any = {
        title: taskTitle.trim(),
        description: taskDesc.trim() || `From content: "${contentTitle}"`,
        owner: taskOwner || null,
        due_date: taskDue || null,
        priority: taskPriority,
        status: "todo",
        created_by: user.id,
        content_item_id: contentItemId,
      };
      const { error } = await (supabase as any).from("tasks").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      setTaskTitle(""); setTaskDesc(""); setTaskOwner(""); setTaskDue(""); setTaskPriority("normal");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["content-linked-tasks", contentItemId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create task"),
  });

  const statusClass = (s: string) =>
    s === "complete" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : s === "in_progress" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : s === "needs_review" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : s === "revision_needed" ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-muted text-muted-foreground border-border";

  return (
    <div className="rounded-md border border-border bg-card/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-gold" /> Linked Tasks</div>
        {canEdit && (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add task
          </Button>
        )}
      </div>
      {(tasks as any[]).length === 0 ? (
        <div className="text-xs text-muted-foreground">No tasks yet. Create one for a photographer, editor, or anyone else helping with this content.</div>
      ) : (
        <ul className="space-y-1.5">
          {(tasks as any[]).map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded border border-border/60 bg-background/40">
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{nameOf(t.owner)}</span>
              {t.due_date && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{format(new Date(t.due_date), "MMM d")}</span>}
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize", statusClass(t.status))}>{t.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-gold" /> New task for this content</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-1.5" placeholder="e.g. Drone footage of property" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={3} className="mt-1.5" placeholder="Optional details…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assign to</Label>
                <Select value={taskOwner || "unassigned"} onValueChange={(v) => setTaskOwner(v === "unassigned" ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as any)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !taskTitle.trim()} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {create.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
