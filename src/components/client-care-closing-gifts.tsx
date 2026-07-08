import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Gift, ExternalLink, AlertCircle, Check, History } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type ClosingGift = {
  closing_date?: string | null;
  office_location?: string | null;
  shirt_count?: number | null;
  shirt_sizes?: string[] | null;
} | null;

type Req = {
  id: string;
  agent_name: string;
  agent_email: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
  closing_gift: ClosingGift;
  closing_gift_completed_at: string | null;
};

export function ClientCareClosingGifts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"active" | "completed">("active");

  const { data: requests = [], isLoading } = useQuery<Req[]>({
    queryKey: ["client-care-closing-gifts"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marketing_requests")
        .select("id,agent_name,agent_email,status,created_at,closing_gift,closing_gift_completed_at")
        .not("closing_gift", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
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
      qc.invalidateQueries({ queryKey: ["client-care-closing-gifts"] });
      qc.invalidateQueries({ queryKey: ["marketing-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("marketing_requests")
        .update({ closing_gift_completed_at: null, closing_gift_completed_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reopened");
      qc.invalidateQueries({ queryKey: ["client-care-closing-gifts"] });
      qc.invalidateQueries({ queryKey: ["marketing-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const active = requests.filter((r) => r.status !== "declined" && !r.closing_gift_completed_at);
  const completed = requests.filter((r) => !!r.closing_gift_completed_at);
  const list = view === "active" ? active : completed;
  const pending = active.filter((r) => r.status === "pending");

  return (
    <section className="bg-card border border-gold/40 rounded-xl shadow-lg">
      <div className="flex items-center gap-2 p-5 border-b border-border bg-gradient-to-r from-gold/10 to-transparent rounded-t-xl">
        <Gift className="h-5 w-5 text-gold" />
        <h2 className="font-semibold text-foreground">Closing Gift Package Requests</h2>
        {pending.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide bg-gold text-navy px-2 py-0.5 rounded-full">
            <AlertCircle className="h-3 w-3" />
            {pending.length} new
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-gold/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setView("active")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                view === "active" ? "bg-gold text-navy" : "text-gold hover:bg-gold/10",
              )}
            >
              Active ({active.length})
            </button>
            <button
              type="button"
              onClick={() => setView("completed")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors border-l border-gold/30 inline-flex items-center gap-1",
                view === "completed" ? "bg-gold text-navy" : "text-gold hover:bg-gold/10",
              )}
            >
              <History className="h-3 w-3" />
              Completed ({completed.length})
            </button>
          </div>
          <Link to="/requests">
            <Button size="sm" variant="outline" className="border-gold/40 text-gold hover:bg-gold/10">
              View all <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="divide-y divide-border">
        {isLoading && (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && list.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {view === "active"
              ? "No active closing gift requests. You're all caught up. 🎁"
              : "No completed closing gift requests yet."}
          </div>
        )}
        {list.map((r) => {
          const cg = r.closing_gift ?? {};
          const sizes = (cg.shirt_sizes ?? []).filter(Boolean);
          const isPending = r.status === "pending";
          const isCompleted = !!r.closing_gift_completed_at;
          return (
            <div
              key={r.id}
              className={cn(
                "p-4 hover:bg-accent/30 transition-colors",
                isPending && !isCompleted && "bg-gold/5",
                isCompleted && "opacity-75",
              )}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-foreground">{r.agent_name}</div>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded border uppercase tracking-wide font-medium",
                      isCompleted && "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                      !isCompleted && isPending && "bg-gold/20 text-gold border-gold/40",
                      !isCompleted && r.status === "approved" && "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                    )}>
                      {isCompleted ? "Completed" : isPending ? "New / Pending" : r.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.agent_email}</div>
                </div>
                <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {isCompleted && r.closing_gift_completed_at
                    ? `Completed ${formatDistanceToNow(new Date(r.closing_gift_completed_at), { addSuffix: true })}`
                    : formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Detail label="Closing">
                  {cg.closing_date ? format(new Date(cg.closing_date), "MMM d, yyyy") : "—"}
                </Detail>
                <Detail label="Office">{cg.office_location ?? "—"}</Detail>
                <Detail label="Shirts">{cg.shirt_count ?? 0}</Detail>
                <Detail label="Sizes">
                  {sizes.length ? sizes.join(", ") : "—"}
                </Detail>
              </div>
              <div className="mt-3 flex justify-end">
                {isCompleted ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gold/40 text-gold hover:bg-gold/10"
                    disabled={reopenMutation.isPending}
                    onClick={() => reopenMutation.mutate(r.id)}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-gold text-navy hover:bg-gold/90"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(r.id)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark Completed
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground truncate">{children}</div>
    </div>
  );
}
