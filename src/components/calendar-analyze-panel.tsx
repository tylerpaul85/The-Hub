import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format, addDays, eachDayOfInterval } from "date-fns";
import { Sparkles, Loader2, AlertCircle, Plus, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyzeCalendar, type Recommendation } from "@/lib/analyze-calendar.functions";
import { getHolidaysForDate } from "@/lib/holidays";
import type { ContentItem } from "@/lib/content";

type Scope = "week" | "month";

const CATEGORY_CLASS: Record<Recommendation["category"], string> = {
  Gap: "bg-destructive/20 text-destructive border-destructive/40",
  Variety: "bg-[oklch(0.6_0.22_300)]/20 text-[oklch(0.8_0.18_300)] border-[oklch(0.6_0.22_300)]/40",
  Timing: "bg-[oklch(0.6_0.18_240)]/20 text-[oklch(0.8_0.18_240)] border-[oklch(0.6_0.18_240)]/40",
  Opportunity: "bg-gold/20 text-gold border-gold/40",
};

export function CalendarAnalyzePanel({
  open,
  onOpenChange,
  weekRange,
  monthRange,
  fetchItems,
  onCreatePost,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  weekRange: { start: Date; end: Date };
  monthRange: { start: Date; end: Date };
  fetchItems: (start: Date, end: Date) => Promise<ContentItem[]>;
  onCreatePost: (date: Date) => void;
}) {
  const [scope, setScope] = useState<Scope>("week");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const analyze = useServerFn(analyzeCalendar);

  const range = scope === "week" ? weekRange : monthRange;

  const run = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchItems(range.start, range.end);
        const days = eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) });
        // Exclude AON entirely from the analysis
        const filteredItems = items.filter((it) => (it as any).brand !== "AON");
        const scheduled = new Set(filteredItems.map((it) => format(new Date(it.scheduled_at), "yyyy-MM-dd")));
        const emptyDays = days
          .map((d) => format(d, "yyyy-MM-dd"))
          .filter((s) => !scheduled.has(s));

        const holidays: { date: string; name: string }[] = [];
        for (const d of days) {
          const hs = getHolidaysForDate(d);
          for (const h of hs) holidays.push({ date: format(d, "yyyy-MM-dd"), name: h.name });
        }

        const payload = {
          scope,
          rangeStart: format(range.start, "yyyy-MM-dd"),
          rangeEnd: format(addDays(range.end, -1), "yyyy-MM-dd"),
          currentDate: format(new Date(), "yyyy-MM-dd"),
          emptyDays,
          holidays,
          items: filteredItems.map((it) => {
            const d = new Date(it.scheduled_at);
            return {
              title: it.title,
              brand: (it as any).brand ?? null,
              platforms: it.platforms,
              status: it.status,
              scheduled_date: format(d, "yyyy-MM-dd"),
              scheduled_time: format(d, "HH:mm"),
              priority: it.priority,
              notes: it.notes ?? null,
            };
          }),
        };

        const result = await analyze({ data: payload });
        setRecs(result.recommendations);
        setRanAt(new Date(result.generatedAt));
      } catch (e: any) {
        setError(e?.message ?? "Analysis failed");
      } finally {
        setLoading(false);
      }
    },
    [scope, range.start, range.end, fetchItems, analyze],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-l border-border p-0 flex flex-col">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            AI Calendar Analysis
          </SheetTitle>
        </SheetHeader>

        <div className="p-5 border-b border-border space-y-3">
          <div className="flex bg-muted rounded-md p-0.5">
            {(["week", "month"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                  scope === s ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
          <Button
            onClick={run}
            disabled={loading}
            className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Analyze</>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-gold mb-3" />
              <p className="text-sm">Analyzing your calendar…</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                <AlertCircle className="h-4 w-4" /> Analysis failed
              </div>
              <p className="text-muted-foreground mb-3">{error}</p>
              <Button size="sm" variant="outline" onClick={run}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && recs && recs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No recommendations returned. Try a different scope.
            </p>
          )}

          {!loading && !error && recs && recs.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-background/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide", CATEGORY_CLASS[r.category] ?? "bg-muted border-border")}>
                  {r.category}
                </span>
                {r.suggested_date && (
                  <span className="text-[10px] text-muted-foreground">{r.suggested_date}</span>
                )}
              </div>
              <h4 className="font-semibold text-sm leading-snug">{r.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>
              {r.suggested_date && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => {
                    const [y, m, d] = r.suggested_date!.split("-").map(Number);
                    const dt = new Date(y, m - 1, d, 10, 0, 0, 0);
                    onCreatePost(dt);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Post
                </Button>
              )}
            </div>
          ))}

          {!loading && !error && !recs && (
            <p className="text-sm text-muted-foreground text-center py-12">
              Pick a scope and click Analyze to get AI recommendations for your calendar.
            </p>
          )}
        </div>

        {ranAt && (
          <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground text-center">
            Last analyzed {format(ranAt, "MMM d, yyyy 'at' h:mm a")}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
