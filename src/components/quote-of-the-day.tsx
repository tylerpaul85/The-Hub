import { useMemo } from "react";
import { getQuoteOfTheDay } from "@/lib/quotes";

export function QuoteOfTheDay() {
  const quote = useMemo(() => getQuoteOfTheDay(), []);
  return (
    <aside
      className="rounded-xl border border-gold/20 bg-card/60 px-6 py-5 shadow-sm"
      aria-label="Quote of the day"
    >
      <blockquote className="font-serif italic text-lg leading-relaxed text-foreground/90">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <figcaption className="mt-3 text-xs uppercase tracking-[0.18em] text-gold/70">
        — {quote.author}
      </figcaption>
    </aside>
  );
}
