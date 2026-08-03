import { useMemo } from "react";
import { getQuoteOfTheDay } from "@/lib/quotes";

export function QuoteOfTheDay() {
  const quote = useMemo(() => getQuoteOfTheDay(), []);
  return (
    <aside
      className="rounded-lg border border-border bg-card px-4 py-3"
      aria-label="Quote of the day"
    >
      <blockquote className="italic text-sm leading-relaxed text-foreground/80">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <figcaption className="mt-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        — {quote.author}
      </figcaption>
    </aside>
  );
}
