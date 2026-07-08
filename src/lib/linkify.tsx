import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

// Render text and auto-convert any URLs into target="_blank" anchor tags.
export function Linkify({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        // Odd indices are the captured URLs from the split
        if (i % 2 === 1) {
          return (
            <a
              key={i}
              href={p}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline underline-offset-2 break-all hover:text-gold/80"
              onClick={(e) => e.stopPropagation()}
            >
              {p}
            </a>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </span>
  );
}
