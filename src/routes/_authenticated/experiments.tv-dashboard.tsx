import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getLiveStats, type LiveStats } from "@/lib/experiments.functions";
import { Maximize2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/experiments/tv-dashboard")({
  component: TvDashboard,
});

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function TvDashboard() {
  const run = useServerFn(getLiveStats);
  const query = useQuery<LiveStats>({
    queryKey: ["live-stats"],
    queryFn: () => run(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const now = useNow(1000);
  const [chromeHidden, setChromeHidden] = useState(false);

  // Hide app shell chrome when this route is mounted by toggling a body class.
  useEffect(() => {
    document.body.classList.add("tv-dashboard-mode");
    return () => {
      document.body.classList.remove("tv-dashboard-mode");
    };
  }, []);

  const data = query.data;
  const loading = query.isLoading && !data;

  const goFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 bg-[hsl(220_60%_8%)] text-white overflow-hidden">
      <style>{`
        body.tv-dashboard-mode [data-app-shell-chrome] { display: none !important; }
        body.tv-dashboard-mode main { padding: 0 !important; max-width: none !important; }
      `}</style>

      {/* Background flourish */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 0%, hsl(45 90% 55% / 0.18), transparent 60%), radial-gradient(900px 500px at 100% 100%, hsl(220 70% 30% / 0.6), transparent 60%)",
        }}
      />

      {/* Controls (only visible on hover) */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => query.refetch()}
          className="rounded-md bg-white/10 hover:bg-white/20 backdrop-blur px-3 py-2 text-sm flex items-center gap-2"
          title="Refresh now"
        >
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          onClick={goFullscreen}
          className="rounded-md bg-white/10 hover:bg-white/20 backdrop-blur px-3 py-2 text-sm flex items-center gap-2"
        >
          <Maximize2 className="h-4 w-4" />
          Fullscreen
        </button>
      </div>

      <div className="relative z-10 h-full w-full flex flex-col p-[2vw]">
        {/* Header */}
        <header className="flex items-end justify-between mb-[1.5vw]">
          <div>
            <div className="text-[hsl(45_90%_60%)] font-semibold tracking-[0.3em] text-[1.1vw] uppercase">
              MSREG · Live Pulse
            </div>
            <div className="text-white/70 text-[1.4vw] mt-1">{dateStr}</div>
          </div>
          <div className="text-right">
            <div className="text-white font-bold tabular-nums text-[3.5vw] leading-none">
              {timeStr}
            </div>
            <div className="text-white/50 text-[0.9vw] mt-2">
              {query.isFetching ? "Refreshing…" : `Updated ${formatAgo(data?.ranAt, now)}`}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-[2vw]">
            Loading live stats…
          </div>
        ) : (
          <>
            {/* Hero numbers */}
            <section className="grid grid-cols-2 gap-[1.5vw] mb-[1.5vw]">
              <HeroCard
                label="Appointments Set · This Month"
                value={data?.appointmentsThisMonth ?? 0}
                accent
              />
              <HeroCard label="Calls Logged · Today" value={data?.callsToday ?? 0} />
            </section>

            {/* Leaderboards + Pipeline */}
            <section className="flex-1 grid grid-cols-3 gap-[1.5vw] min-h-0">
              <Leaderboard
                title="Calls Today"
                rows={data?.callsLeaderboard ?? []}
                emptyText="No calls logged yet today."
              />
              <Leaderboard
                title="Appointments This Month"
                rows={data?.appointmentsLeaderboard ?? []}
                emptyText="No appointments yet this month."
              />
              <PipelinePanel rows={data?.dealsByStage ?? []} />
            </section>
          </>
        )}

        {data?.errors && data.errors.length > 0 ? (
          <div className="absolute bottom-2 left-4 text-red-300/80 text-xs">
            {data.errors.join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatAgo(iso: string | undefined, now: Date) {
  if (!iso) return "just now";
  const ms = now.getTime() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(iso).toLocaleTimeString();
}

function HeroCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-[1.2vw] p-[2vw] overflow-hidden border ${
        accent
          ? "border-[hsl(45_90%_55%/0.4)] bg-gradient-to-br from-[hsl(45_90%_55%/0.18)] to-[hsl(220_60%_15%/0.6)]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div
        className={`uppercase tracking-[0.25em] text-[1vw] font-semibold ${
          accent ? "text-[hsl(45_90%_70%)]" : "text-white/70"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-[0.6vw] font-bold tabular-nums leading-none text-[10vw] ${
          accent ? "text-[hsl(45_90%_65%)]" : "text-white"
        }`}
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function Leaderboard({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{ name: string; count: number }>;
  emptyText: string;
}) {
  const top = rows.slice(0, 8);
  const max = top[0]?.count ?? 1;
  return (
    <div className="rounded-[1.2vw] border border-white/10 bg-white/[0.04] p-[1.5vw] flex flex-col min-h-0">
      <div className="text-[hsl(45_90%_60%)] uppercase tracking-[0.25em] font-semibold text-[1vw] mb-[1vw]">
        {title}
      </div>
      {top.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/40 text-[1.4vw] text-center">
          {emptyText}
        </div>
      ) : (
        <ol className="flex-1 flex flex-col justify-between gap-[0.6vw] min-h-0">
          {top.map((r, i) => {
            const pct = Math.max(8, Math.round((r.count / max) * 100));
            return (
              <li key={r.name + i} className="relative">
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-[hsl(45_90%_55%/0.15)]"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-[0.8vw] py-[0.6vw]">
                  <div className="flex items-center gap-[1vw] min-w-0">
                    <div
                      className={`tabular-nums font-bold text-[1.6vw] w-[2.5vw] ${
                        i === 0 ? "text-[hsl(45_90%_65%)]" : "text-white/40"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="truncate text-white font-semibold text-[1.6vw]">
                      {r.name}
                    </div>
                  </div>
                  <div className="tabular-nums font-bold text-[2vw] text-white">
                    {r.count}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function PipelinePanel({ rows }: { rows: Array<{ stage: string; count: number }> }) {
  const top = rows.slice(0, 8);
  const total = rows.reduce((a, b) => a + b.count, 0);
  return (
    <div className="rounded-[1.2vw] border border-white/10 bg-white/[0.04] p-[1.5vw] flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-[1vw]">
        <div className="text-[hsl(45_90%_60%)] uppercase tracking-[0.25em] font-semibold text-[1vw]">
          Pipeline · Deals by Stage
        </div>
        <div className="tabular-nums text-white/70 text-[1.2vw]">
          {total} total
        </div>
      </div>
      {top.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/40 text-[1.4vw] text-center">
          No deals returned.
        </div>
      ) : (
        <ul className="flex-1 flex flex-col justify-between gap-[0.6vw] min-h-0">
          {top.map((r) => (
            <li
              key={r.stage}
              className="flex items-center justify-between px-[0.8vw] py-[0.6vw] rounded-md bg-white/[0.03]"
            >
              <div className="truncate text-white font-semibold text-[1.4vw]">
                {r.stage}
              </div>
              <div className="tabular-nums font-bold text-[1.8vw] text-[hsl(45_90%_65%)]">
                {r.count}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
