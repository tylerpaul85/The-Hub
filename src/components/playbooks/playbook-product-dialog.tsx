import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BookOpen,
  Save,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  createAdminProduct,
  updateAdminProduct,
  type PlaybookProduct,
} from "@/lib/playbooks.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PRESET_COVERS = [
  { name: "Listing Agent", url: "/covers/listing-agent-playbook.jpg" },
  { name: "Leadership", url: "/covers/msreg-leadership-playbook.jpg" },
  { name: "Operations", url: "/covers/operations-playbook.jpg" },
  { name: "Welcome to MSREG", url: "/covers/welcome-to-msreg.jpg" },
  { name: "Lake Certification", url: "/covers/lake-agent-certification.jpg" },
  { name: "Listing Certification", url: "/covers/listing-agent-certification.jpg" },
  { name: "New Agent Bootcamp", url: "/covers/new-agent-bootcamp.jpg" },
  { name: "5-Day Bootcamp", url: "/covers/five-day-bootcamp.jpg" },
];

interface PlaybookProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: PlaybookProduct | null;
  onSaved: () => void;
}

export function PlaybookProductDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: PlaybookProductDialogProps) {
  const createProductFn = useServerFn(createAdminProduct);
  const updateProductFn = useServerFn(updateAdminProduct);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("/covers/listing-agent-playbook.jpg");
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setCoverUrl(product.cover_image_url || "/covers/listing-agent-playbook.jpg");
      setStatus(product.status || "published");
    } else {
      setName("");
      setDescription("");
      setCoverUrl("/covers/listing-agent-playbook.jpg");
      setStatus("published");
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a playbook / course name");
      return;
    }

    setIsSaving(true);
    try {
      if (product) {
        await updateProductFn({
          data: {
            id: product.id,
            name: name.trim(),
            description: description.trim() || undefined,
            cover_image_url: coverUrl.trim() || undefined,
            status,
          },
        });
        toast.success(`Updated "${name.trim()}"`);
      } else {
        await createProductFn({
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            cover_image_url: coverUrl.trim() || undefined,
            status,
          },
        });
        toast.success(`Created "${name.trim()}"`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save playbook product");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-surface-1 border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {product ? "Edit Playbook Product" : "Create New Playbook / Course"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Set up a high-level playbook product matching GoHighLevel LMS structure.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cover Preview */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border bg-surface-2 shadow-xs">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Product Cover"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/covers/listing-agent-playbook.jpg";
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs">
                <ImageIcon className="h-8 w-8 mb-1 opacity-50" />
                <span>No cover image selected</span>
              </div>
            )}
            <div className="absolute top-2 right-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                  status === "published"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                }`}
              >
                {status === "published" ? "Published" : "Draft"}
              </span>
            </div>
          </div>

          {/* Preset covers picker */}
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">
              Choose Preset Cover Image (16:9)
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setCoverUrl(preset.url)}
                  className={`relative rounded-lg overflow-hidden border transition-all cursor-pointer aspect-video ${
                    coverUrl === preset.url
                      ? "border-gold ring-2 ring-gold/40 shadow-sm"
                      : "border-border opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/80 text-[9px] text-white py-0.5 px-1 truncate block text-center">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Product Title *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Buyer Specialist Playbook"
              className="bg-surface-2 border-border text-sm font-semibold"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Description / Summary</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Comprehensive step-by-step training, scripts, and SOPs for agents..."
              rows={2}
              className="bg-surface-2 border-border text-xs"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="published">Published (Visible to Assigned Agents)</option>
              <option value="draft">Draft (Admin Only)</option>
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-border"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs bg-gold text-navy hover:bg-gold/90 font-bold cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            {product ? "Update Product" : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
