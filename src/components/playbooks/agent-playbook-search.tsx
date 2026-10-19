import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, BookOpen, Clock, ArrowRight, CornerDownLeft, Sparkles, CheckCircle2 } from "lucide-react";
import { searchPlaybooksFn, type AgentPlaybookSearchResult } from "@/lib/playbooks.functions";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { Badge } from "@/components/ui/badge";

interface AgentPlaybookSearchProps {
  onSearchSubmit?: (query: string) => void;
  initialQuery?: string;
}

export function AgentPlaybookSearch({ onSearchSubmit, initialQuery = "" }: AgentPlaybookSearchProps) {
  const navigate = useNavigate();
  const { agent, sellerSupabase } = useAgentAuth();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AgentPlaybookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Global "/" shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if target is an editable input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search query handler (~250ms)
  const performSearch = useCallback(
    async (searchTerm: string) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setResults([]);
        setLoading(false);
        setIsOpen(false);
        return;
      }

      setLoading(true);

      try {
        // Try Postgres RPC directly via sellerSupabase first if available
        let fetchedResults: AgentPlaybookSearchResult[] = [];
        if (sellerSupabase) {
          try {
            const { data, error } = await sellerSupabase.rpc("search_playbooks", {
              query_text: trimmed,
              p_limit: 8,
            });
            if (!error && Array.isArray(data) && data.length > 0) {
              fetchedResults = data;
            }
          } catch {}
        }

        // Seamless fallback to server function
        if (fetchedResults.length === 0) {
          fetchedResults = await searchPlaybooksFn({
            data: {
              query: trimmed,
              agentId: agent?.id,
              limit: 8,
            },
          });
        }

        setResults(fetchedResults);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        console.error("Playbook search failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [sellerSupabase, agent?.id]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setQuery(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!nextVal.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(nextVal);
    }, 250);
  };

  const handleSelectResult = (item: AgentPlaybookSearchResult) => {
    setIsOpen(false);
    navigate({ to: "/playbooks/$slug", params: { slug: item.slug } });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (activeIndex >= 0 && results[activeIndex]) {
      handleSelectResult(results[activeIndex]);
      return;
    }

    if (query.trim()) {
      setIsOpen(false);
      if (onSearchSubmit) {
        onSearchSubmit(query.trim());
      } else {
        navigate({
          to: "/playbooks",
          search: { q: query.trim() } as any,
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!isOpen || results.length === 0) {
      if (e.key === "Enter") {
        handleSubmit(e);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const highlightSnippet = (text: string, highlightQuery: string) => {
    if (!text) return null;
    const cleanHighlight = highlightQuery.trim();
    if (!cleanHighlight) return text;

    const words = cleanHighlight.split(/\s+/).filter(Boolean);
    const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");

    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-gold/25 text-gold font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Search Input Box */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim() && results.length > 0) setIsOpen(true);
            }}
            placeholder="Search playbooks, objection scripts, SOPs, checklists..."
            className="w-full h-13 sm:h-14 pl-12 pr-28 rounded-2xl bg-surface-1/95 border border-border/90 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-gold/60 focus:ring-4 focus:ring-gold/15 shadow-xl transition-all"
            autoComplete="off"
            spellCheck="false"
          />

          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                  if (onSearchSubmit) onSearchSubmit("");
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-surface-2/90 border border-border text-[11px] font-mono text-muted-foreground select-none pointer-events-none shadow-xs">
              <span>/</span>
            </kbd>
          </div>
        </div>
      </form>

      {/* Dropdown Results Overlay */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-border/80 bg-surface-1/95 backdrop-blur-xl shadow-2xl overflow-hidden divide-y divide-border/50 animate-in fade-in zoom-in-95 duration-150"
        >
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin text-gold" />
              <span>Searching MSREG Playbook Library...</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-1">
                {results.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                        isActive
                          ? "bg-surface-2 border border-gold/40 shadow-xs"
                          : "hover:bg-surface-2/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className={`h-4 w-4 shrink-0 ${isActive ? "text-gold" : "text-accent"}`} />
                          <span className="font-semibold text-sm text-foreground truncate">
                            {highlightSnippet(item.title, query)}
                          </span>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/60">
                          {item.category}
                        </span>
                      </div>

                      {/* Highlighted snippet */}
                      <p className="text-xs text-muted-foreground line-clamp-2 pl-6 leading-relaxed">
                        {highlightSnippet(item.snippet || item.summary, query)}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center justify-between pl-6 pt-1 text-[11px] text-muted-foreground">
                        <span className="truncate">By {item.owner}</span>
                        {isActive && (
                          <span className="text-gold font-medium inline-flex items-center gap-1 text-[11px]">
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer row with Enter action */}
              <div className="px-4 py-2.5 bg-surface-2/70 flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-[11px]">
                  Found {results.length} result{results.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="font-medium text-foreground hover:text-gold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>View all results</span>
                  <CornerDownLeft className="h-3 w-3" />
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center space-y-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-foreground">No matching playbooks found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Try searching for broader keywords like &quot;listing&quot;, &quot;commission&quot;, &quot;buyer&quot;, or &quot;scripts&quot;.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
