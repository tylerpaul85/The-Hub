import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

export type HeadlineKind = "announcement" | "cascade" | "issue";

export const HEADLINE_KIND_LABEL: Record<HeadlineKind, string> = {
  announcement: "Announcement",
  cascade: "Cascade",
  issue: "Issue",
};

export const HEADLINE_KIND_CLASS: Record<HeadlineKind, string> = {
  announcement: "bg-navy/40 text-gold border-gold/40",
  cascade: "bg-gold/15 text-gold border-gold/40",
  issue: "bg-destructive/15 text-destructive border-destructive/30",
};

type Props = {
  variant?: "outline" | "default";
  size?: "sm" | "default";
  labelClassName?: string;
};

export function QuickHeadlineButton({ variant = "outline", size = "sm", labelClassName }: Props = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<HeadlineKind>("announcement");

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!title.trim()) throw new Error("Title required");
      let issueId: string | null = null;
      if (kind === "issue") {
        const { data: ins, error: e1 } = await sb
          .from("issues")
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            submitted_by: user.id,
            status: "pending",
          })
          .select("id")
          .single();
        if (e1) throw e1;
        issueId = ins.id;
      }
      const { error } = await sb.from("headlines").insert({
        title: title.trim(),
        description: description.trim() || null,
        kind,
        submitted_by: user.id,
        converted_issue_id: issueId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(kind === "issue" ? "Headline added · pending issue review" : "Headline added");
      setTitle("");
      setDescription("");
      setKind("announcement");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["headlines"] });
      qc.invalidateQueries({ queryKey: ["issues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} className="gap-1.5">
        <Megaphone className="h-3.5 w-3.5" />
        <span className={labelClassName ?? "hidden sm:inline"}>Add Headline</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a headline</DialogTitle>
            <DialogDescription>
              Headlines are reviewed at the top of L10. Pick a type — announcements and cascades are
              noted and moved on from; issues drop into the Issues list for IDS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={kind} onValueChange={(v) => setKind(v as HeadlineKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement — share with the team</SelectItem>
                  <SelectItem value="cascade">Cascade — info to pass down/across</SelectItem>
                  <SelectItem value="issue">Issue — needs IDS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Headline</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="One sentence — the headline"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Details (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Adding..." : "Add Headline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
