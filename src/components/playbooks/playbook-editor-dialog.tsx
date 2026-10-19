import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  X,
  Save,
  Eye,
  Edit3,
  Upload,
  Film,
  Sparkles,
  Layers,
  Tag,
  Users,
  Check,
  AlertCircle,
  Link as LinkIcon,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertAdminPlaybook,
  type PlaybookRecord,
  type PlaybookGroup,
} from "@/lib/playbooks.functions";
import { PlaybookContentRenderer } from "./playbook-content-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PlaybookEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: PlaybookRecord | null;
  groups: PlaybookGroup[];
  onSaved: () => void;
  currentUser?: string;
  defaultProduct?: string;
  defaultCategory?: string;
}

const CATEGORIES = [
  "Listings",
  "Buyers",
  "Objections",
  "Operations",
  "Lead Generation",
  "Closing & Escrow",
  "Client Care",
  "General",
];

export function PlaybookEditorDialog({
  open,
  onOpenChange,
  playbook,
  groups,
  onSaved,
  currentUser = "Admin",
  defaultProduct,
  defaultCategory,
}: PlaybookEditorDialogProps) {
  const upsertFn = useServerFn(upsertAdminPlaybook);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [owner, setOwner] = useState("Matt Smith");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [changeSummary, setChangeSummary] = useState("");

  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Video embed prompt state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (playbook) {
      setTitle(playbook.title || "");
      setCategory(playbook.category || "General");
      setSummary(playbook.summary || "");
      setContent(playbook.content || "");
      setTagsInput(playbook.tags?.join(", ") || "");
      setOwner(playbook.owner || "Matt Smith");
      setStatus(playbook.status || "draft");
      setSelectedGroupIds(playbook.assigned_group_ids || []);
      setChangeSummary("");
    } else {
      setTitle("");
      setCategory(defaultCategory || "General");
      setSummary("");
      setContent(
        `# Overview\n\nProvide the core objective and background of this playbook.\n\n## Step-by-Step Instructions\n\n1. First action step\n2. Second action step\n\n## Scripts & Key Talking Points\n\n*"Our team's standard is to deliver an exceptional experience..."*\n`
      );
      setTagsInput(defaultProduct ? `${defaultProduct.split(" ")[0]}, SOP` : "");
      setOwner("Matt Smith");
      setStatus("draft");
      setSelectedGroupIds(groups.map((g) => g.id).slice(0, 1));
      setChangeSummary("");
    }
  }, [playbook, groups, open, defaultCategory, defaultProduct]);

  // Insert markdown text at cursor position in textarea
  const insertTextAtCursor = (insertion: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + "\n\n" + insertion);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const prev = content;
    const next = prev.substring(0, start) + insertion + prev.substring(end);
    setContent(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
  };

  // Upload image/file to playbooks bucket
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${Date.now()}_${sanitizedName}`;

      const { data, error } = await supabase.storage.from("playbooks").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("playbooks").getPublicUrl(path);

      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
      const isImg = file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);

      if (isImg) {
        insertTextAtCursor(`\n\n![${file.name}](${publicUrl})\n\n`);
      } else if (isVideo) {
        insertTextAtCursor(`\n\n[video: ${publicUrl}]\n\n`);
      } else {
        insertTextAtCursor(`\n\n[Download ${file.name}](${publicUrl})\n\n`);
      }

      toast.success("File uploaded and added to content!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Insert Video Embed
  const handleInsertVideo = () => {
    if (!videoUrl.trim()) return;
    insertTextAtCursor(`\n\n[video: ${videoUrl.trim()}]\n\n`);
    setVideoUrl("");
    setVideoModalOpen(false);
    toast.success("Video embed inserted!");
  };

  // Save handler
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a playbook title");
      return;
    }
    if (!content.trim()) {
      toast.error("Please provide playbook content");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSaving(true);
    try {
      await upsertFn({
        data: {
          id: playbook?.id,
          title: title.trim(),
          category,
          product: playbook?.product || defaultProduct,
          subcategory: category,
          summary: summary.trim() || null,
          content,
          tags,
          owner: owner.trim() || "Matt Smith",
          status,
          assigned_group_ids: selectedGroupIds,
          change_summary: changeSummary.trim() || null,
          created_by: currentUser,
        },
      });

      toast.success(playbook ? "Playbook updated!" : "Playbook created!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save playbook");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGroup = (gid: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] h-[92vh] max-h-[92vh] p-0 flex flex-col bg-surface-1 border border-border shadow-2xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
                <Edit3 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {playbook ? "Edit Playbook" : "Create New Playbook"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Draft standard operating procedures, embed videos, and assign agent group access.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs border-border hover:bg-surface-2 h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs bg-gold text-navy hover:bg-gold/90 font-bold h-9 px-4 shadow-sm cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {isSaving ? "Saving..." : playbook ? "Save Changes" : "Create Playbook"}
              </Button>
            </div>
          </div>

          {/* Form & Workspace */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Row Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-2/40 p-4 rounded-xl border border-border/70">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground">Playbook Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Listing Presentation & Pricing Consultation SOP"
                  className="bg-surface-1 border-border font-semibold text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Category *</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-surface-1 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {category && !CATEGORIES.includes(category) && (
                    <option value={category}>{category}</option>
                  )}
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-xs font-semibold text-muted-foreground">Executive Summary</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="One or two sentences explaining when and how agents should execute this playbook"
                  className="bg-surface-1 border-border text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Owner / Creator</Label>
                <Input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. Matt Smith"
                  className="bg-surface-1 border-border text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Publish Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-border bg-surface-1 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent font-medium"
                >
                  <option value="draft">Draft (Hidden from Agents)</option>
                  <option value="published">Published (Visible to Assigned Groups)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Tags (comma-separated)</Label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. Listings, Scripts, In-Home"
                  className="bg-surface-1 border-border text-xs"
                />
              </div>
            </div>

            {/* Access Group Multi-Select */}
            <div className="bg-surface-2/40 p-4 rounded-xl border border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-accent" /> Assigned Access Groups
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Select which agent groups can view and must acknowledge this playbook
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {groups.map((g) => {
                  const isSelected = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-accent text-white border-accent shadow-xs"
                          : "bg-surface-1 text-muted-foreground border-border hover:border-accent/40"
                      }`}
                    >
                      {isSelected ? <Check className="h-3 w-3" /> : null}
                      <span>{g.name}</span>
                    </button>
                  );
                })}
                {groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No groups created yet. Default applies to all agents.</p>
                ) : null}
              </div>
            </div>

            {/* Markdown Content Editor & Live Preview */}
            <div className="space-y-2">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-surface-2 border border-border">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-foreground px-2">Playbook Markdown</span>
                  <div className="h-4 w-px bg-border mx-1" />

                  {/* Format buttons */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("## New Section\n")}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    H2
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("### Sub-heading\n")}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    H3
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("**bold text**")}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-bold"
                  >
                    B
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("- [ ] Checklist item\n")}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Checklist
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("> *Key script quote*\n")}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Quote
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Video Embed Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoModalOpen(true)}
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border bg-surface-1"
                  >
                    <Film className="h-3 w-3 mr-1 text-accent" /> Embed Video
                  </Button>

                  {/* File Upload Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border bg-surface-1"
                  >
                    {isUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-3 w-3 mr-1 text-gold" />
                    )}
                    Upload Media
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,video/*,application/pdf"
                  />

                  <div className="h-4 w-px bg-border mx-1" />

                  {/* View Mode Switcher */}
                  <div className="flex items-center rounded-lg bg-surface-1 p-0.5 border border-border">
                    <button
                      type="button"
                      onClick={() => setViewMode("edit")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        viewMode === "edit" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("split")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors hidden sm:block ${
                        viewMode === "split" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("preview")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        viewMode === "preview" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor Workspace Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[400px]">
                {/* Editor Textarea */}
                {(viewMode === "edit" || viewMode === "split") && (
                  <div className={`space-y-1 ${viewMode === "edit" ? "col-span-full" : ""}`}>
                    <Textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="# Enter your markdown here..."
                      className="min-h-[420px] h-full font-mono text-xs leading-relaxed bg-surface-1 border-border p-4 rounded-xl resize-y"
                    />
                  </div>
                )}

                {/* Live Preview Container */}
                {(viewMode === "preview" || viewMode === "split") && (
                  <div
                    className={`rounded-xl border border-border/80 bg-surface-1 p-5 overflow-y-auto max-h-[550px] shadow-inner ${
                      viewMode === "preview" ? "col-span-full" : ""
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border/60 pb-2 mb-4 flex items-center justify-between">
                      <span>Live Render Preview</span>
                      <span className="text-[10px] text-accent">Real-time Markdown &amp; Video</span>
                    </div>
                    <PlaybookContentRenderer content={content} />
                  </div>
                )}
              </div>
            </div>

            {/* Version Change Summary */}
            {playbook ? (
              <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/70 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Version History Note (Optional)
                </Label>
                <Input
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Briefly describe what changed in this version (e.g. Updated commission objection script)..."
                  className="bg-surface-1 border-border text-xs"
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Embed Helper Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-md bg-surface-1 border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Film className="h-4 w-4 text-accent" /> Embed Video
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Paste a URL from <strong>YouTube</strong>, <strong>Vimeo</strong>, <strong>Loom</strong>, or a direct link to an uploaded video file from our storage bucket.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Video URL</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or Loom / Vimeo"
                className="bg-surface-2 border-border text-xs"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVideoModalOpen(false)}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleInsertVideo}
                className="text-xs bg-accent text-white hover:bg-accent/90"
              >
                Insert Video Embed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
