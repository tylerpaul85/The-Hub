import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORMS, PLATFORM_CHIP, BRANDS, BRAND_STYLES, type Brand } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialDate?: Date | null;
  initial?: {
    title?: string;
    platforms?: string[];
    brand?: Brand;
    [key: string]: unknown;
  };
}

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function ContentItemForm({ open, onOpenChange, initialDate, initial }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const PLATFORM_VALUES = PLATFORMS as readonly string[];

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    platforms: (initial?.platforms ?? []).filter((p) => PLATFORM_VALUES.includes(p)),
    scheduled_at: toLocalInput(initialDate ?? new Date()),
    brand: (initial?.brand ?? "PP") as Brand,
    notes: "",
    blog_content: "",
    blog_doc_link: "",
    youtube_thumbnail_url: "",
    youtube_video_title: "",
    email_subject_line: "",
    email_body: "",
    meta_media_link: "",
    meta_graphic_link: "",
    meta_video_link: "",
    meta_copy: "",
  });

  const hasPlatform = (p: string) => form.platforms.includes(p);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title.trim(),
        platforms: form.platforms,
        status: "draft",
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        priority: "normal",
        notes: form.notes || null,
        brand: form.brand,
        created_by: user?.id ?? null,
        blog_content: form.blog_content || null,
        blog_doc_link: form.blog_doc_link || null,
        youtube_thumbnail_url: form.youtube_thumbnail_url || null,
        youtube_video_title: form.youtube_video_title || null,
        email_subject_line: form.email_subject_line || null,
        email_body: form.email_body || null,
        meta_media_link: form.meta_media_link || null,
        meta_graphic_link: form.meta_graphic_link || null,
        meta_video_link: form.meta_video_link || null,
        meta_copy: form.meta_copy || null,
      };
      const { error } = await (supabase as any).from("content_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      toast.success("Content created");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Content Item</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} className="mt-1.5" placeholder="Content title" />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={2000} className="mt-1.5" placeholder="Internal notes…" />
          </div>

          <div>
            <Label>Brand</Label>
            <div className="mt-2 flex flex-wrap gap-2">
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

          <div>
            <Label>Platforms</Label>
            <div className="mt-2 flex flex-wrap gap-3">
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

          {hasPlatform("Blog") && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-emerald-300">Blog details</div>
              <div>
                <Label className="text-xs">Blog content (for review)</Label>
                <Textarea value={form.blog_content} onChange={(e) => setForm({ ...form, blog_content: e.target.value })} rows={4} className="mt-1.5" placeholder="Paste blog body here…" />
              </div>
              <div>
                <Label className="text-xs">Doc link</Label>
                <Input type="url" value={form.blog_doc_link} onChange={(e) => setForm({ ...form, blog_doc_link: e.target.value })} placeholder="https://docs.google.com/…" className="mt-1.5" />
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
              </div>
            </div>
          )}

          {hasPlatform("Mailchimp") && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-amber-300">Email (Mailchimp) details</div>
              <div>
                <Label className="text-xs">Subject line</Label>
                <Input value={form.email_subject_line} onChange={(e) => setForm({ ...form, email_subject_line: e.target.value })} className="mt-1.5" placeholder="Email subject" />
              </div>
              <div>
                <Label className="text-xs">Email body</Label>
                <Textarea value={form.email_body} onChange={(e) => setForm({ ...form, email_body: e.target.value })} rows={6} className="mt-1.5" placeholder="Email body content…" />
              </div>
            </div>
          )}

          {hasPlatform("Meta") && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
              <div className="text-xs font-semibold text-blue-300">Meta (Facebook/Instagram) details</div>
              <div>
                <Label className="text-xs">Graphic link</Label>
                <Input type="url" value={form.meta_graphic_link} onChange={(e) => setForm({ ...form, meta_graphic_link: e.target.value })} placeholder="https://… (image / graphic)" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Video link</Label>
                <Input type="url" value={form.meta_video_link} onChange={(e) => setForm({ ...form, meta_video_link: e.target.value })} placeholder="https://… (video)" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Copy</Label>
                <Textarea value={form.meta_copy} onChange={(e) => setForm({ ...form, meta_copy: e.target.value })} rows={4} className="mt-1.5" placeholder="Post copy…" />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="scheduled_at">Scheduled *</Label>
            <Input id="scheduled_at" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required className="mt-1.5" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {mutation.isPending ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
          {initialDate && (
            <p className="text-xs text-muted-foreground text-center">Slot: {format(initialDate, "EEE MMM d, h:mm a")}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
