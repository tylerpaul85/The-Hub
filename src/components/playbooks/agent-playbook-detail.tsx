import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Share2,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  List,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlaybookContentRenderer,
  extractHeadings,
  type HeadingItem,
} from "@/components/playbooks/playbook-content-renderer";
import { acknowledgePlaybookFn, type AgentPlaybookDetail } from "@/lib/playbooks.functions";
import { useAgentAuth } from "@/hooks/use-agent-auth";

interface AgentPlaybookDetailProps {
  playbook: AgentPlaybookDetail;
  onAcknowledged?: () => void;
}

export function AgentPlaybookDetailView({ playbook, onAcknowledged }: AgentPlaybookDetailProps) {
  const { agent } = useAgentAuth();
  const [isAcknowledged, setIsAcknowledged] = useState(playbook.acknowledged);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(playbook.acknowledged_at || null);
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Extract headings from the playbook markdown content
  const headings = useMemo(() => {
    return extractHeadings(playbook.content);
  }, [playbook.content]);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success("Playbook link copied to clipboard! Ready to share via text or Slack.");
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleAcknowledge = async () => {
    if (!agent) {
      toast.error("Please sign in to record your acknowledgment.");
      return;
    }

    if (isAcknowledged) return;

    setIsSubmittingAck(true);
    try {
      const res = await acknowledgePlaybookFn({
        data: {
          playbookId: playbook.id,
          agentId: agent.id,
        },
      });

      setIsAcknowledged(true);
      setAcknowledgedAt(res.acknowledged_at);
      toast.success("Acknowledgment recorded! Thank you for reviewing this MSREG playbook.");
      if (onAcknowledged) onAcknowledged();
    } catch (err: any) {
      toast.error(err.message || "Failed to record acknowledgment.");
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileTocOpen(false);
    }
  };

  const formattedReviewedDate = useMemo(() => {
    try {
      return new Date(playbook.last_reviewed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return playbook.last_reviewed_at;
    }
  }, [playbook.last_reviewed_at]);

  const formattedAckDate = useMemo(() => {
    if (!acknowledgedAt) return null;
    try {
      return new Date(acknowledgedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return acknowledgedAt;
    }
  }, [acknowledgedAt]);

  return (
    <div className="space-y-8 pb-24 md:pb-12">
      {/* Top Action Nav Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <Link
          to="/playbooks"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Playbook Library</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Share / Copy Link button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-9 px-3 text-xs border-border bg-surface-1 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" />
                <span className="text-emerald-400 font-semibold">Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <span>Share Link</span>
              </>
            )}
          </Button>

          {/* Top Desktop Acknowledgment Action */}
          <div className="hidden sm:block">
            {isAcknowledged ? (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Acknowledged {formattedAckDate ? `on ${formattedAckDate}` : ""}</span>
              </div>
            ) : (
              <Button
                onClick={handleAcknowledge}
                disabled={isSubmittingAck}
                className="h-9 px-4 text-xs font-bold rounded-xl bg-gold text-navy hover:bg-gold/90 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                <span>{isSubmittingAck ? "Recording..." : "I've Read This Playbook"}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Playbook Header Dossier */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2 p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-surface-2 border border-border/70 text-accent">
            {playbook.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-surface-1 px-2.5 py-0.5 rounded-full border border-border/60">
            <Clock className="h-3.5 w-3.5" />
            <span>{playbook.read_time_minutes} min read</span>
          </span>
          <span className="text-xs text-muted-foreground bg-surface-1 px-2.5 py-0.5 rounded-full border border-border/60">
            v{playbook.version_number}.0
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
          {playbook.title}
        </h1>

        {playbook.summary && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-4xl">
            {playbook.summary}
          </p>
        )}

        {/* Metadata row */}
        <div className="pt-3 border-t border-border/60 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-[11px] font-bold">
              {playbook.owner.charAt(0)}
            </div>
            <span>
              Author / Owner: <strong className="text-foreground">{playbook.owner}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              Reviewed: <strong className="text-foreground">{formattedReviewedDate}</strong>
            </span>
          </div>

          {playbook.tags && playbook.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {playbook.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-surface-2 text-[11px] text-muted-foreground border border-border/60"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Collapsible Table of Contents */}
      {headings.length > 1 && (
        <div className="lg:hidden rounded-2xl border border-border/80 bg-surface-1 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setMobileTocOpen(!mobileTocOpen)}
            className="w-full p-4 flex items-center justify-between text-left text-sm font-bold text-foreground cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-gold" />
              <span>Table of Contents ({headings.length} sections)</span>
            </div>
            {mobileTocOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {mobileTocOpen && (
            <div className="p-4 pt-0 border-t border-border/50 space-y-1.5 text-xs">
              {headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => scrollToHeading(h.id)}
                  className={`block w-full text-left py-1.5 hover:text-gold transition-colors text-muted-foreground ${
                    h.level === 1 ? "font-bold text-foreground" : h.level === 2 ? "pl-3 font-medium" : "pl-6"
                  }`}
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Layout (Desktop: Content + Sticky TOC) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left / Center Column: Rendered Markdown Content */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-8">
          <div className="rounded-3xl border border-border/80 bg-surface-1/80 p-6 sm:p-8 lg:p-10 shadow-lg">
            <PlaybookContentRenderer content={playbook.content} />
          </div>

          {/* Acknowledgment Card on Mobile & Desktop */}
          <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2 p-6 sm:p-7 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-gold" />
                  <h3 className="text-base font-bold text-foreground">Playbook Compliance & Verification</h3>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  By clicking acknowledge, you confirm you have read, understood, and agreed to implement these standard operating procedures in your MSREG transactions.
                </p>
              </div>

              {isAcknowledged ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Acknowledged {formattedAckDate ? `(${formattedAckDate})` : ""}</span>
                </div>
              ) : (
                <Button
                  onClick={handleAcknowledge}
                  disabled={isSubmittingAck}
                  className="h-11 px-5 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs shrink-0 shadow-md shadow-gold/15 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  <span>{isSubmittingAck ? "Recording..." : "I've Read This Playbook"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Related Playbooks Section */}
          {playbook.related_playbooks && playbook.related_playbooks.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" />
                  <h3 className="text-base font-bold text-foreground">Related Playbooks</h3>
                </div>
                <span className="text-xs text-muted-foreground">In this category or shared topics</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {playbook.related_playbooks.map((rel) => (
                  <Link
                    key={rel.id}
                    to="/playbooks/$slug"
                    params={{ slug: rel.slug }}
                    className="group rounded-2xl border border-border/80 bg-surface-1 p-4 shadow-xs hover:border-gold/50 hover:bg-surface-2/50 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/70">
                        {rel.category}
                      </span>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-gold transition-colors line-clamp-2">
                        {rel.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {rel.summary}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-gold font-semibold">
                      <span>View Playbook</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Table of Contents on Desktop */}
        {headings.length > 1 && (
          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-20 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-surface-1 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border/60 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <List className="h-3.5 w-3.5 text-gold" />
                <span>On This Page</span>
              </div>

              <nav className="space-y-1 text-xs max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => scrollToHeading(h.id)}
                    className={`block w-full text-left py-1.5 transition-colors hover:text-gold cursor-pointer text-muted-foreground ${
                      h.level === 1
                        ? "font-bold text-foreground text-xs"
                        : h.level === 2
                        ? "pl-3 font-medium text-xs"
                        : "pl-5 text-[11px]"
                    }`}
                  >
                    {h.text}
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Share Tip Box */}
            <div className="rounded-2xl border border-border/70 bg-surface-1/50 p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                <span>Deep-Linkable URL</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                You can copy the URL in your browser bar or use the share button to text or Slack this exact guide directly to other agents.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-md border-t border-border/80 p-3 flex items-center justify-between gap-3 shadow-2xl">
        <div className="truncate text-xs">
          <p className="font-bold text-foreground truncate">{playbook.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {isAcknowledged ? `Acknowledged ${formattedAckDate || ""}` : "Pending acknowledgment"}
          </p>
        </div>

        {isAcknowledged ? (
          <div className="h-10 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs inline-flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            <span>Read</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleAcknowledge}
            disabled={isSubmittingAck}
            className="h-10 px-4 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs shrink-0 shadow-md cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            <span>{isSubmittingAck ? "..." : "I've Read This"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
