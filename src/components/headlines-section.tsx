import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, ArrowDown, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  HEADLINE_KIND_CLASS,
  HEADLINE_KIND_LABEL,
  QuickHeadlineButton,
  type HeadlineKind,
} from "@/components/quick-headline-button";
import { displayName, type Member } from "@/lib/eos";

const sb = supabase as any;

type Headline = {
  id: string;
  title: string;
  description: string | null;
  kind: HeadlineKind;
  submitted_by: string;
  meeting_id: string | null;
  reviewed_at: string | null;
  converted_issue_id: string | null;
  created_at: string;
};

export function HeadlinesSection({
  meetingId,
  canEdit,
  isAdmin,
  members,
  userId,
}: {
  meetingId: string;
  canEdit: boolean;
  isAdmin: boolean;
  members: Member[];
  userId: string | null;
}) {
  const qc = useQueryClient();

  const { data: headlines = [] } = useQuery({
    queryKey: ["headlines"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("headlines")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Headline[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["headlines"] });
    qc.invalidateQueries({ queryKey: ["issues"] });
    qc.invalidateQueries({ queryKey: ["issues", meetingId] });
    qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] });
  };

  const markReviewed = useMutation({
    mutationFn: async (h: Headline) => {
      // If headline is an issue, make sure it is open and attached to this L10
      // before marking reviewed so IDS can show it immediately.
      if (h.kind === "issue") {
        if (!userId) throw new Error("Not signed in");
        if (h.converted_issue_id) {
          const { error: e1 } = await sb
            .from("issues")
            .update({
              title: h.title,
              description: h.description,
              submitted_by: userId,
              status: "open",
              meeting_id: meetingId,
            })
            .eq("id", h.converted_issue_id);
          if (e1) throw e1;
          const { error: e2 } = await sb
            .from("headlines")
            .update({ reviewed_at: new Date().toISOString(), meeting_id: meetingId })
            .eq("id", h.id);
          if (e2) throw e2;
          return { droppedToIds: true };
        }
        const { data: ins, error: e1 } = await sb
          .from("issues")
          .insert({
            title: h.title,
            description: h.description,
            submitted_by: userId,
            status: "open",
            meeting_id: meetingId,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        const { error: e2 } = await sb
          .from("headlines")
          .update({
            reviewed_at: new Date().toISOString(),
            meeting_id: meetingId,
            converted_issue_id: ins.id,
          })
          .eq("id", h.id);
        if (e2) throw e2;
        return { droppedToIds: true };
      }
      // If the headline is no longer an issue but still has a linked pending
      // issue row, drop it from the Issues list — reviewing as a
      // cascade/announcement means it's been handled, not IDS'd.
      if (h.converted_issue_id) {
        const { error: delErr } = await sb
          .from("issues")
          .delete()
          .eq("id", h.converted_issue_id);
        if (delErr) throw delErr;
      }
      const { error } = await sb
        .from("headlines")
        .update({
          reviewed_at: new Date().toISOString(),
          meeting_id: meetingId,
          // clear the link if we just removed the issue
          ...(h.converted_issue_id ? { converted_issue_id: null } : {}),
        })
        .eq("id", h.id);
      if (error) throw error;
      return { droppedToIds: false };
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(res?.droppedToIds ? "Dropped into IDS" : "Headline reviewed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async (h: Headline) => {
      const { error } = await sb
        .from("headlines")
        .update({ reviewed_at: null })
        .eq("id", h.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Headline re-opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToIssue = useMutation({
    mutationFn: async (h: Headline) => {
      if (!userId) throw new Error("Not signed in");
      if (h.converted_issue_id) throw new Error("Already an issue");
      const { data: ins, error: e1 } = await sb
        .from("issues")
        .insert({
          title: h.title,
          description: h.description,
          submitted_by: userId,
          status: "open",
          meeting_id: meetingId,
        })
        .select("id")
        .single();
      if (e1) throw e1;
      const { error: e2 } = await sb
        .from("headlines")
        .update({
          kind: "issue",
          converted_issue_id: ins.id,
          reviewed_at: new Date().toISOString(),
          meeting_id: meetingId,
        })
        .eq("id", h.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Dropped into IDS");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setKind = useMutation({
    mutationFn: async ({ h, kind }: { h: Headline; kind: HeadlineKind }) => {
      if (kind === "issue") {
        if (!userId) throw new Error("Not signed in");
        if (h.converted_issue_id) {
          const { error: issueErr } = await sb
            .from("issues")
            .update({
              title: h.title,
              description: h.description,
              status: "open",
              meeting_id: meetingId,
            })
            .eq("id", h.converted_issue_id);
          if (issueErr) throw issueErr;
          const { error } = await sb
            .from("headlines")
            .update({ kind, meeting_id: meetingId })
            .eq("id", h.id);
          if (error) throw error;
          return;
        }
        const { data: ins, error: issueErr } = await sb
          .from("issues")
          .insert({
            title: h.title,
            description: h.description,
            submitted_by: userId,
            status: "open",
            meeting_id: meetingId,
          })
          .select("id")
          .single();
        if (issueErr) throw issueErr;
        const { error } = await sb
          .from("headlines")
          .update({ kind, converted_issue_id: ins.id, meeting_id: meetingId })
          .eq("id", h.id);
        if (error) throw error;
        return;
      }
      // Reclassifying away from "issue" while a linked pending issue exists:
      // remove the issue row so it doesn't linger in the Issues list.
      const removingIssueLink = !!h.converted_issue_id;
      if (removingIssueLink) {
        const { error: delErr } = await sb
          .from("issues")
          .delete()
          .eq("id", h.converted_issue_id);
        if (delErr) throw delErr;
      }
      const { error } = await sb
        .from("headlines")
        .update(
          removingIssueLink
            ? { kind, converted_issue_id: null }
            : { kind },
        )
        .eq("id", h.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });


  const del = useMutation({
    mutationFn: async (h: Headline) => {
      const { error } = await sb.from("headlines").delete().eq("id", h.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Headline removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = headlines.filter((h) => !h.reviewed_at);
  const reviewed = headlines.filter((h) => !!h.reviewed_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Review each headline: <span className="text-gold">announcements</span> and{" "}
          <span className="text-gold">cascades</span> are noted; confirm{" "}
          <span className="text-destructive">issues</span> drop into IDS below.
        </div>
        {canEdit && <QuickHeadlineButton labelClassName="inline" />}
      </div>

      {active.length === 0 && (
        <div className="text-sm text-muted-foreground italic border border-dashed border-border rounded p-4 text-center">
          No headlines to review.
        </div>
      )}

      <div className="space-y-2">
        {active.map((h) => {
          const submitter = members.find((m) => m.id === h.submitted_by);
          const alreadyIssue = !!h.converted_issue_id;
          return (
            <div
              key={h.id}
              className="border border-border rounded-lg p-3 bg-card flex items-start gap-3"
            >
              <Megaphone className="h-4 w-4 text-gold mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium">{h.title}</div>
                  <span
                    className={cn(
                      "text-[10px] uppercase px-1.5 py-0.5 rounded border",
                      HEADLINE_KIND_CLASS[h.kind],
                    )}
                  >
                    {HEADLINE_KIND_LABEL[h.kind]}
                  </span>
                  {alreadyIssue && (
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border bg-destructive/15 text-destructive border-destructive/30">
                      In Issues
                    </span>
                  )}
                </div>
                {h.description && (
                  <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                    {h.description}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">
                  from {displayName(submitter)} · {format(new Date(h.created_at), "MMM d, yyyy")}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <Select
                    value={h.kind}
                    onValueChange={(v) => setKind.mutate({ h, kind: v as HeadlineKind })}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="cascade">Cascade</SelectItem>
                      <SelectItem value="issue">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {canEdit && !alreadyIssue && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => convertToIssue.mutate(h)}
                    disabled={convertToIssue.isPending}
                    title="Move into the Issues list for IDS"
                  >
                    <ArrowDown className="h-3.5 w-3.5 mr-1" /> To Issues
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => markReviewed.mutate(h)}
                    disabled={markReviewed.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Reviewed
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => del.mutate(h)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {reviewed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Reviewed ({reviewed.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {reviewed.slice(0, 25).map((h) => (
              <div
                key={h.id}
                className="border border-border/60 rounded p-2 bg-muted/20 flex items-center gap-2"
              >
                <span
                  className={cn(
                    "text-[10px] uppercase px-1.5 py-0.5 rounded border",
                    HEADLINE_KIND_CLASS[h.kind],
                  )}
                >
                  {HEADLINE_KIND_LABEL[h.kind]}
                </span>
                <span className="text-xs flex-1 truncate">{h.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(h.reviewed_at!), "MMM d")}
                </span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => reopen.mutate(h)}
                  >
                    Re-open
                  </Button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
