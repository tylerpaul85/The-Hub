import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shuffle, Megaphone, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import type { Issue } from "@/lib/eos";

const sb = supabase as any;

type Kind = "announcement" | "cascade";

/**
 * Reclassify an issue as an announcement or cascade.
 * - If a headline created this issue (linked via converted_issue_id), update that
 *   headline's kind, mark reviewed, and clear the issue link.
 * - Otherwise insert a fresh reviewed headline carrying the issue's title/body.
 * - Then delete the issue so it leaves the active Issues list.
 */
async function reclassifyIssueToHeadline(args: {
  issue: Issue;
  kind: Kind;
  meetingId?: string | null;
}) {
  const { issue, kind, meetingId } = args;
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await sb
    .from("headlines")
    .select("id, meeting_id")
    .eq("converted_issue_id", issue.id)
    .maybeSingle();
  if (lookupErr) throw lookupErr;

  if (existing) {
    const { error } = await sb
      .from("headlines")
      .update({
        kind,
        reviewed_at: now,
        converted_issue_id: null,
        meeting_id: meetingId ?? existing.meeting_id ?? null,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("headlines").insert({
      title: issue.title,
      description: issue.description,
      kind,
      submitted_by: issue.submitted_by,
      reviewed_at: now,
      meeting_id: meetingId ?? null,
    });
    if (error) throw error;
  }

  const { error: delErr } = await sb.from("issues").delete().eq("id", issue.id);
  if (delErr) throw delErr;
}

export function ReclassifyIssueMenu({
  issue,
  meetingId,
  size = "sm",
  iconOnly = false,
  onDone,
}: {
  issue: Issue;
  meetingId?: string | null;
  size?: "sm" | "icon";
  iconOnly?: boolean;
  onDone?: () => void;
}) {
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: (kind: Kind) => reclassifyIssueToHeadline({ issue, kind, meetingId }),
    onSuccess: (_d, kind) => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["headlines"] });
      if (meetingId) {
        qc.invalidateQueries({ queryKey: ["issues", meetingId] });
        qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] });
      }
      toast.success(
        kind === "cascade"
          ? "Reclassified as Cascade · removed from Issues"
          : "Reclassified as Announcement · removed from Issues",
      );
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-gold hover:text-gold"
            title="Reclassify — not really an issue"
            disabled={m.isPending}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size={size === "icon" ? "icon" : "sm"}
            variant="outline"
            className="h-8 border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
            disabled={m.isPending}
          >
            <Shuffle className="h-3.5 w-3.5 mr-1" /> Reclassify
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Not really an issue?
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => m.mutate("announcement")} disabled={m.isPending}>
          <Megaphone className="h-4 w-4 mr-2 text-gold" />
          Mark as Announcement
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => m.mutate("cascade")} disabled={m.isPending}>
          <ArrowDownToLine className="h-4 w-4 mr-2 text-gold" />
          Mark as Cascade
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
