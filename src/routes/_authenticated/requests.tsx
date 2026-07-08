import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Inbox, Check, X, FileText, ExternalLink, Copy } from "lucide-react";
import { QrCode } from "@/components/qr-code";
import { publicUrl } from "@/lib/public-url";

export const Route = createFileRoute("/_authenticated/requests")({
  component: RequestsInbox,
  head: () => ({ meta: [{ title: "Requests Inbox — MSREG" }] }),
});

const sb = supabase as any;

function PublicLinkBanner({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const url = publicUrl(path);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gold/20 bg-gold/5 px-4 py-3">
      <ExternalLink className="h-4 w-4 text-gold shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Public {label}</p>
        <p className="text-xs text-muted-foreground truncate">{url}</p>
      </div>
      <QrCode url={url} size={56} />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-gold hover:underline shrink-0"
      >
        Open
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1 text-xs font-medium text-gold hover:underline shrink-0"
      >
        <Copy className="h-3 w-3" />
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

type ClosingGift = {
  closing_date?: string | null;
  office_location?: string | null;
  office_location_other?: string | null;
  shirt_count?: number | null;
  shirt_sizes?: string[] | null;
} | null;

type Req = {
  id: string;
  agent_name: string;
  agent_email: string;
  request_types: string[];
  scope: "personal" | "listing";
  property_address: string | null;
  deadline: string | null;
  description: string;
  priority: "low" | "normal" | "high";
  copy_notes: string | null;
  file_urls: string[];
  status: "pending" | "approved" | "declined";
  decline_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  closing_gift: ClosingGift;
  closing_gift_completed_at: string | null;
  closing_gift_completed_by: string | null;
};

const priorityColor: Record<string, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  normal: "bg-muted text-foreground border-border",
  low: "bg-muted/50 text-muted-foreground border-border",
};

function RequestsInbox() {
  const { isAdmin, user, roles } = useAuth();
  const isClientCare = roles?.includes("client_care");
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "declined" | "completed_gifts">("pending");
  const [selected, setSelected] = useState<Req | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<"task" | "content" | "video">("task");
  const [taskOwner, setTaskOwner] = useState<string>("none");
  const [taskDueDate, setTaskDueDate] = useState<string>("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_team_members");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: requests = [], isLoading } = useQuery<Req[]>({
    queryKey: ["marketing-requests"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("marketing_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Req[];
    },
  });

  const filtered = requests.filter((r) => {
    if (filter === "completed_gifts") return !!r.closing_gift_completed_at;
    // Active views exclude completed closing gifts
    if (r.closing_gift_completed_at) return false;
    if (filter === "all") return true;
    return r.status === filter;
  });

  const completeGift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from("marketing_requests")
        .update({
          closing_gift_completed_at: new Date().toISOString(),
          closing_gift_completed_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Closing gift marked completed");
      qc.invalidateQueries({ queryKey: ["marketing-requests"] });
      qc.invalidateQueries({ queryKey: ["client-care-closing-gifts"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopenGift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from("marketing_requests")
        .update({ closing_gift_completed_at: null, closing_gift_completed_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reopened");
      qc.invalidateQueries({ queryKey: ["marketing-requests"] });
      qc.invalidateQueries({ queryKey: ["client-care-closing-gifts"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await sb
        .from("marketing_requests")
        .update({ status: "declined", decline_note: note, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request declined");
      qc.invalidateQueries({ queryKey: ["marketing-requests"] });
      setDeclineOpen(false);
      setSelected(null);
      setDeclineNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async ({ req, target, owner, dueDate }: { req: Req; target: "task" | "content" | "video"; owner: string | null; dueDate: string | null }) => {
      let converted_content_id: string | null = null;
      let converted_video_id: string | null = null;
      let converted_task_id: string | null = null;
      const title = `[Request] ${req.request_types.join(", ")} — ${req.agent_name}`;
      const cg = req.closing_gift;
      const closingGiftBlock = cg
        ? `\n\nClosing Gift Package:\n- Closing date: ${cg.closing_date ?? "—"}\n- Office: ${cg.office_location ?? "—"}\n- Shirts (${cg.shirt_count ?? 0}): ${(cg.shirt_sizes ?? []).join(", ") || "—"}`
        : "";
      const notes = [
        req.description,
        req.copy_notes ? `\n\nCopy/messaging:\n${req.copy_notes}` : "",
        req.property_address ? `\n\nProperty: ${req.property_address}` : "",
        closingGiftBlock,
        `\n\nFrom: ${req.agent_name} <${req.agent_email}>`,
      ].join("");
      if (target === "task") {
        const { data, error } = await sb.from("tasks").insert({
          title,
          owner,
          due_date: dueDate || req.deadline || null,
          priority: req.priority,
          description: notes,
          originating_request_id: req.id,
          agent_name: req.agent_name,
          agent_email: req.agent_email,
          attached_request_files: req.file_urls,
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        converted_task_id = data.id;
      } else if (target === "content") {
        const { data, error } = await sb.from("content_items").insert({
          title,
          status: "draft",
          platforms: [],
          scheduled_at: req.deadline ? new Date(req.deadline).toISOString() : new Date().toISOString(),
          target_publish_date: req.deadline ?? null,
          priority: req.priority,
          notes,
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        converted_content_id = data.id;
      } else {
        const { data, error } = await sb.from("videos").insert({
          title,
          stage: "ideation",
          priority: req.priority,
          estimated_publish_date: req.deadline ?? null,
          campaign_tag: req.request_types.join(", "),
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        converted_video_id = data.id;
      }
      const { error: upErr } = await sb.from("marketing_requests")
        .update({
          status: "approved",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          converted_content_id,
          converted_video_id,
          converted_task_id,
        })
        .eq("id", req.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Request approved and converted");
      qc.invalidateQueries({ queryKey: ["marketing-requests"] });
      setApproveOpen(false);
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openFile = async (key: string) => {
    const { data, error } = await supabase.storage
      .from("marketing-request-uploads")
      .createSignedUrl(key, 600);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PublicLinkBanner path="/request" label="Marketing Request" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-gold" />
          <h1 className="text-xl font-semibold">Marketing Requests</h1>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="completed_gifts">Completed gifts</SelectItem>
            <SelectItem value="all">All (active)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-lg">
          No requests in this view.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-gold/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.agent_name}</span>
                    <span className="text-xs text-muted-foreground">{r.agent_email}</span>
                    <Badge variant="outline" className={priorityColor[r.priority]}>{r.priority}</Badge>
                    {r.status !== "pending" && (
                      <Badge variant={r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
                    )}
                    {r.closing_gift_completed_at && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
                        Gift completed
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 truncate">
                    {r.request_types.join(", ")} · {r.scope === "listing" ? r.property_address : "Personal branding"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.created_at), "MMM d, p")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.agent_name}'s request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  {selected.request_types.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  <Badge variant="outline" className={priorityColor[selected.priority]}>{selected.priority} priority</Badge>
                </div>
                <Field label="Email"><a href={`mailto:${selected.agent_email}`} className="text-gold underline">{selected.agent_email}</a></Field>
                <Field label="Scope">{selected.scope === "listing" ? "Listing / transaction" : "Personal branding"}</Field>
                {selected.property_address && <Field label="Property">{selected.property_address}</Field>}
                {selected.deadline && <Field label="Deadline">{format(new Date(selected.deadline), "PPP")}</Field>}
                <Field label="Description"><p className="whitespace-pre-wrap">{selected.description}</p></Field>
                {selected.copy_notes && <Field label="Copy / messaging"><p className="whitespace-pre-wrap">{selected.copy_notes}</p></Field>}
                {selected.closing_gift && (
                  <div className="rounded-md border border-gold/30 bg-gold/5 p-3 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gold">Closing Gift Package</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Closing date: </span>{selected.closing_gift.closing_date ? format(new Date(selected.closing_gift.closing_date), "PPP") : "—"}</div>
                      <div><span className="text-muted-foreground">Office: </span>{selected.closing_gift.office_location ?? "—"}</div>
                      <div><span className="text-muted-foreground">Shirts: </span>{selected.closing_gift.shirt_count ?? 0}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">Sizes: </span>{(selected.closing_gift.shirt_sizes ?? []).map((s, i) => `Shirt ${i + 1}: ${s}`).join(" · ") || "—"}</div>
                    </div>
                  </div>
                )}
                {selected.file_urls.length > 0 && (
                  <Field label="Attachments">
                    <div className="space-y-1">
                      {selected.file_urls.map((k) => {
                        const name = k.split("-").slice(1).join("-") || k;
                        return (
                          <button key={k} onClick={() => openFile(k)} className="flex items-center gap-2 text-gold hover:underline">
                            <FileText className="h-4 w-4" /> {name} <ExternalLink className="h-3 w-3" />
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
                <Field label="Submitted">{format(new Date(selected.created_at), "PPP p")}</Field>
                {selected.status === "declined" && selected.decline_note && (
                  <Field label="Decline note"><p className="whitespace-pre-wrap text-destructive">{selected.decline_note}</p></Field>
                )}
                {selected.closing_gift_completed_at && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                    <span className="font-semibold text-emerald-300">Closing gift completed</span>
                    <span className="text-muted-foreground"> · {format(new Date(selected.closing_gift_completed_at), "PPP p")}</span>
                  </div>
                )}
              </div>
              {selected.closing_gift && (isAdmin || isClientCare) && (
                <DialogFooter className="gap-2">
                  {selected.closing_gift_completed_at ? (
                    <Button
                      variant="outline"
                      className="border-gold/40 text-gold hover:bg-gold/10"
                      disabled={reopenGift.isPending}
                      onClick={() => reopenGift.mutate(selected.id)}
                    >
                      Reopen closing gift
                    </Button>
                  ) : (
                    <Button
                      className="bg-gold text-navy hover:bg-gold/90"
                      disabled={completeGift.isPending}
                      onClick={() => completeGift.mutate(selected.id)}
                    >
                      <Check className="h-4 w-4 mr-1" /> Mark closing gift completed
                    </Button>
                  )}
                </DialogFooter>
              )}
              {isAdmin && selected.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => { setDeclineNote(""); setDeclineOpen(true); }}>
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                  <Button onClick={() => {
                    setApproveTarget("task");
                    setTaskOwner("none");
                    setTaskDueDate(selected.deadline ?? "");
                    setApproveOpen(true);
                  }}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline request</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason for declining (will be emailed to the agent)..."
            value={declineNote}
            onChange={(e) => setDeclineNote(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!declineNote.trim() || decline.isPending}
              onClick={() => selected && decline.mutate({ id: selected.id, note: declineNote.trim() })}
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve & convert</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Convert to</div>
              <Select value={approveTarget} onValueChange={(v) => setApproveTarget(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task (recommended)</SelectItem>
                  <SelectItem value="content">Content Calendar item</SelectItem>
                  <SelectItem value="video">Video Pipeline card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {approveTarget === "task" && (
              <>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Assign to</div>
                  <Select value={taskOwner} onValueChange={setTaskOwner}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(profiles as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {[p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Due date</div>
                  <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button
              disabled={approve.isPending}
              onClick={() => selected && approve.mutate({
                req: selected,
                target: approveTarget,
                owner: approveTarget === "task" && taskOwner !== "none" ? taskOwner : null,
                dueDate: approveTarget === "task" ? (taskDueDate || null) : null,
              })}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
