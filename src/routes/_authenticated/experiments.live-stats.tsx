import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { runApiDiagnostics } from "@/lib/experiments.functions";

export const Route = createFileRoute("/_authenticated/experiments/live-stats")({
  component: LiveStatsDiagnostics,
});

type ProbeResult = {
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
  note?: string;
  contentType?: string;
  data?: unknown;
  sisuStatusCode?: number | null;
};

function LiveStatsDiagnostics() {
  const run = useServerFn(runApiDiagnostics);
  const mutation = useMutation({
    mutationFn: () => run(),
  });

  const data = mutation.data as
    | { fub: ProbeResult[]; sisu: ProbeResult[]; meta: Record<string, unknown> }
    | undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Live Stats — API Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Test connections to Sisu and Follow Up Boss. Inspect raw responses to
            confirm available fields before designing the TV display.
          </p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> Run diagnostics</>
          )}
        </Button>
      </div>

      {mutation.isError && (
        <Card className="p-4 border-red-500/40 bg-red-500/5 text-sm">
          {(mutation.error as Error)?.message ?? "Diagnostics failed."}
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <Card className="p-4 text-xs font-mono">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(data.meta, null, 2)}
            </pre>
          </Card>

          <Section title="Follow Up Boss" results={data.fub} />
          <Section title="Sisu" results={data.sisu} />
        </div>
      )}

      {!data && !mutation.isPending && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Click <b>Run diagnostics</b> to call both APIs and inspect raw responses.
        </Card>
      )}
    </div>
  );
}

function Section({ title, results }: { title: string; results: ProbeResult[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gold">{title}</h2>
      <div className="space-y-3">
        {results.map((r, i) => (
          <Card key={i} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {r.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium">{r.label}</span>
                {r.status !== null && (
                  <Badge variant={r.ok ? "default" : "destructive"}>HTTP {r.status}</Badge>
                )}
                {r.sisuStatusCode !== undefined && r.sisuStatusCode !== null && (
                  <Badge variant={r.sisuStatusCode === 0 ? "default" : "destructive"}>
                    status_code: {r.sisuStatusCode}
                  </Badge>
                )}
              </div>
              {r.url && (
                <code className="text-[10px] text-muted-foreground break-all">
                  {r.url}
                </code>
              )}
            </div>
            {r.error && (
              <div className="text-xs text-red-400">{r.error}</div>
            )}
            {r.note && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                ⚠ {r.note}
              </div>
            )}
            {r.contentType && (
              <div className="text-[10px] text-muted-foreground">
                content-type: {r.contentType}
              </div>
            )}
            {r.data !== undefined && (
              <pre className="text-[11px] font-mono bg-muted/40 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap break-all">

                {typeof r.data === "string"
                  ? r.data
                  : JSON.stringify(r.data, null, 2)}
              </pre>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
