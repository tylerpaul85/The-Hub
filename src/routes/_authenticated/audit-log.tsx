import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Download } from "lucide-react";
import { toCsv, downloadCsv, todayStamp } from "@/lib/csv";
import { logAuditEvent } from "@/lib/audit.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/audit-log")({
  component: AuditLogPage,
  head: () => ({ meta: [{ title: "Audit Log — MSREG" }] }),
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

type AuditRow = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

function AuditLogPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");

  useEffect(() => {
    if (!loading && !isAdmin) router.navigate({ to: "/dashboard" });
  }, [loading, isAdmin, router]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-log"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_team_members");
      return data ?? [];
    },
  });
  const name = (id: string | null) => {
    if (!id) return "—";
    const p = (profiles as any[]).find((x) => x.id === id);
    if (!p) return id.slice(0, 8);
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || id.slice(0, 8);
  };

  const types = Array.from(new Set(rows.map((r) => r.event_type))).sort();
  const filtered = rows.filter((r) => {
    if (type !== "all" && r.event_type !== type) return false;
    if (search) {
      const hay = `${r.event_type} ${r.target_id ?? ""} ${JSON.stringify(r.metadata ?? {})}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const handleExport = async () => {
    if (!isAdmin) return;
    const headers = ["When", "Event", "Actor", "Target", "IP Address", "Details"];
    const rows = filtered.map((r) => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      r.event_type,
      name(r.actor_user_id),
      r.target_user_id ? name(r.target_user_id) : (r.target_id ?? ""),
      r.ip_address ?? "",
      r.metadata && Object.keys(r.metadata).length ? JSON.stringify(r.metadata) : "",
    ]);
    downloadCsv(`MSREG-Audit-Log-${todayStamp()}.csv`, toCsv(headers, rows));
    toast.success(`Exported ${rows.length} audit entr${rows.length === 1 ? "y" : "ies"}`);
    try {
      await logAuditEvent({ data: {
        event_type: "audit_log.export",
        metadata: { row_count: rows.length, filter_type: type, search_present: !!search },
      }});
    } catch { /* non-fatal */ }
  };

  if (!isAdmin) return null;


  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-gold" />
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Append-only record of sensitive events. Admin only.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto">
          <Download className="h-4 w-4 mr-1.5" /> Export
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Event</th>
              <th className="text-left px-3 py-2">Actor</th>
              <th className="text-left px-3 py-2">Target</th>
              <th className="text-left px-3 py-2">IP</th>
              <th className="text-left px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No events yet.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{format(new Date(r.created_at), "MMM d, p")}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="font-mono text-[11px]">{r.event_type}</Badge></td>
                <td className="px-3 py-2">{name(r.actor_user_id)}</td>
                <td className="px-3 py-2">{r.target_user_id ? name(r.target_user_id) : (r.target_id ?? "—")}</td>
                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{r.ip_address ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[360px] truncate" title={JSON.stringify(r.metadata ?? {})}>
                  {r.metadata && Object.keys(r.metadata).length ? JSON.stringify(r.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
