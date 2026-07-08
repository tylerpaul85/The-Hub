import { useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { displayName, mentionHandle } from "@/lib/eos";

export interface MentionUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface Props {
  value: string;
  onChange: (v: string, mentions: string[]) => void;
  users: MentionUser[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Lightweight @-mention textarea. Detects `@token` at the caret and shows a dropdown
 * of users whose display name or handle starts with the token. Inserting picks a user
 * and stores `@Handle` in the body; the user id is added to the returned mentions array.
 */
export function MentionTextarea({ value, onChange, users, placeholder, rows = 3, disabled, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  // Track which user ids are currently referenced as @handle / @email tokens
  const computeMentions = (text: string) => {
    const ids: string[] = [];
    for (const u of users) {
      const handle = mentionHandle(u);
      if (text.includes("@" + handle) || text.includes("@" + u.email)) ids.push(u.id);
    }
    return ids;
  };

  useEffect(() => { setActive(0); }, [query]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const caret = e.target.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\w.@+-]*)$/);
    setQuery(m ? m[1] : null);
    onChange(text, computeMentions(text));
  };

  const filtered = query !== null
    ? users.filter((u) => {
        const q = query.toLowerCase();
        return (
          mentionHandle(u).toLowerCase().startsWith(q) ||
          displayName(u).toLowerCase().startsWith(q) ||
          (u.first_name ?? "").toLowerCase().startsWith(q) ||
          u.email.toLowerCase().startsWith(q)
        );
      }).slice(0, 6)
    : [];

  const pick = (u: MentionUser) => {
    const ta = ref.current; if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(/@([\w.@+-]*)$/, `@${mentionHandle(u)} `);
    const next = replaced + after;
    onChange(next, computeMentions(next));
    setQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % filtered.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + filtered.length) % filtered.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(filtered[active]); }
    else if (e.key === "Escape") { setQuery(null); }
  };

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={handleInput}
        onKeyDown={onKey}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
      />
      {filtered.length > 0 && (
        <div className="absolute z-50 left-2 bottom-full mb-1 w-64 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          {filtered.map((u, i) => {
            const name = displayName(u);
            return (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(u); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2",
                  i === active ? "bg-gold/15 text-gold" : "hover:bg-accent/40",
                )}
              >
                <span className="h-5 w-5 rounded-full bg-gold/20 text-gold text-[10px] flex items-center justify-center font-semibold">
                  {name[0]?.toUpperCase()}
                </span>
                <span className="flex-1 truncate">{name}</span>
                <span className="text-[10px] text-muted-foreground">@{mentionHandle(u)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
