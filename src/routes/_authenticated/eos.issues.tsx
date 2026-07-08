import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CircleAlert, Trash2, CheckCircle2, Search, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { displayName, type Issue, type Member } from "@/lib/eos";
import { QuickHeadlineButton } from "@/components/quick-headline-button";
import { ReclassifyIssueMenu } from "@/components/reclassify-issue-menu";

export const Route = createFileRoute("/_authenticated/eos/issues")({
  component: IssuesPage,
  head: () => ({ meta: [{ title: "Issues — EOS — MSREG" }] }),
});

const sb = supabase as any;

function IssuesPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "open" | "resolved" | "all">("pending");
  const [query, setQuery] = useState("");
  const [confirmDel, setConfirmDel] = useState<Issue | null>(null);

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await sb.from("issues").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Issue[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_team_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });


  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("issues").update({ status: "solved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Issue resolved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("issues").update({ status: "open", outcome_note: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Reopened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      setConfirmDel(null);
      toast.success("Issue deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmPending = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("issues").update({ status: "open" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Confirmed · moved to active Issues");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissPending = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Dismissed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((i) => {
      if (tab === "pending" && i.status !== "pending") return false;
      if (tab === "open" && i.status !== "open") return false;
      if (tab === "resolved" && (i.status === "open" || i.status === "pending")) return false;
      if (tab === "all" && i.status === "pending") return false;
      if (q && !(i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [issues, tab, query]);

  const counts = useMemo(() => ({
    pending: issues.filter((i) => i.status === "pending").length,
    open: issues.filter((i) => i.status === "open").length,
    resolved: issues.filter((i) => i.status !== "open" && i.status !== "pending").length,
    all: issues.filter((i) => i.status !== "pending").length,
  }), [issues]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CircleAlert className="h-7 w-7 text-gold" /> Issues
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Central list of all team issues. Resolve or delete from here or inside any L10 meeting.</p>
        </div>
        <QuickHeadlineButton size="default" variant="default" labelClassName="inline" />

      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search issues..." className="pl-8" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            New <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/40">{counts.pending}</span>
          </TabsTrigger>
          <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({counts.resolved})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>

        {tab === "pending" && (
          <div className="mt-3 text-xs text-muted-foreground border-l-2 border-gold/60 pl-3">
            Headlines flagged as issues land here for review. Confirm to send to the active Issues list, or dismiss if it doesn't need solving.
          </div>
        )}

        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground italic border border-dashed border-border rounded p-6 text-center">
              {tab === "pending" ? "No pending issues to review." : "No issues to show."}
            </div>
          )}
          {filtered.map((i) => {
            const submitter = members.find((m) => m.id === i.submitted_by);
            const isPending = i.status === "pending";
            return (
              <div key={i.id} className={`border rounded-lg p-3 flex items-start gap-3 bg-card ${isPending ? "border-gold/40" : "border-border"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-medium">{i.title}</div>
                    {i.status !== "open" && (
                      <span className={
                        i.status === "solved"
                          ? "text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : i.status === "converted"
                          ? "text-[10px] uppercase px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30"
                          : i.status === "pending"
                          ? "text-[10px] uppercase px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/40"
                          : "text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                      }>{i.status === "pending" ? "New" : i.status}</span>
                    )}
                  </div>
                  {i.description && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{i.description}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    from {displayName(submitter) ?? "—"} · {format(new Date(i.created_at), "MMM d, yyyy")}
                  </div>
                  {i.outcome_note && (
                    <div className="text-xs mt-2 bg-muted/40 border border-border rounded p-2">
                      <span className="uppercase text-[10px] text-muted-foreground mr-1">Outcome:</span>{i.outcome_note}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isPending && (
                    <>
                      <Button size="sm" variant="default" className="h-8 bg-gold text-navy hover:bg-gold/90" onClick={() => confirmPending.mutate(i.id)} disabled={confirmPending.isPending}>
                        <ArrowDown className="h-3.5 w-3.5 mr-1" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => dismissPending.mutate(i.id)} disabled={dismissPending.isPending}>
                        <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                      </Button>
                    </>
                  )}
                  {i.status === "open" && (
                    <>
                      <ReclassifyIssueMenu issue={i} />
                      <Button size="sm" variant="outline" className="h-8" onClick={() => resolve.mutate(i.id)} disabled={resolve.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Resolve
                      </Button>
                    </>
                  )}
                  {i.status !== "open" && i.status !== "pending" && isAdmin && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => reopen.mutate(i.id)} disabled={reopen.isPending}>
                      Reopen
                    </Button>
                  )}
                  {isAdmin && !isPending && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDel(i)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>


      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this issue?</DialogTitle>
            <DialogDescription>
              "{confirmDel?.title}" will be permanently removed. Use this for duplicates or mistakes. To keep a record, mark it Resolved instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDel && del.mutate(confirmDel.id)} disabled={del.isPending}>
              Yes, delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
