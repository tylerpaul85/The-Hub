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
  Check,
  Award,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlaybookContentRenderer } from "@/components/playbooks/playbook-content-renderer";
import { CourseSidebarContents } from "@/components/playbooks/course-sidebar-contents";
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

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success("Playbook link copied! Ready to share via text or Slack.");
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
      toast.success("Lesson marked as complete! Certification progress updated.");
      if (onAcknowledged) onAcknowledged();
    } catch (err: any) {
      toast.error(err.message || "Failed to record completion.");
    } finally {
      setIsSubmittingAck(false);
    }
  };

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

  const modulePlaybooks = playbook.module_playbooks || [];
  const allPlaybooks = playbook.all_playbooks || [];

  return (
    <div className="space-y-6 pb-20 md:pb-12">
      {/* Top Breadcrumb Bar matching Image 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link to="/agent-tools" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="text-muted-foreground/60">&gt;</span>
          <Link to="/playbooks" className="hover:text-foreground transition-colors">
            Courses
          </Link>
          <span className="text-muted-foreground/60">&gt;</span>
          <Link to="/playbooks" className="font-semibold text-foreground hover:text-gold transition-colors">
            Listing Agent Certification
          </Link>
          <span className="text-muted-foreground/60">&gt;</span>
          <span className="text-gold font-bold truncate max-w-[200px] sm:max-w-xs">{playbook.title}</span>
        </div>

        {/* Share Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="h-8 px-3 text-xs border-border bg-surface-1 hover:bg-surface-2 rounded-xl cursor-pointer"
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
      </div>

      {/* Main Two-Column Learning Layout (matching Image 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Lesson Content (70% width on desktop) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl border border-border/80 bg-surface-1/90 p-6 sm:p-8 lg:p-10 shadow-xl space-y-6">
            {/* Header / About this Lesson */}
            <div className="space-y-2 border-b border-border/60 pb-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/25">
                  {playbook.category}
                </span>

                {isAcknowledged && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed {formattedAckDate ? `(${formattedAckDate})` : ""}</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {playbook.title}
              </h1>

              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground font-medium">
                <span>About this Lesson</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{playbook.read_time_minutes} min read</span>
                </span>
                <span>•</span>
                <span>By {playbook.owner}</span>
              </div>
            </div>

            {/* Markdown Content & Media */}
            <div className="pt-2">
              <PlaybookContentRenderer content={playbook.content} />
            </div>

            {/* Bottom Full-Width "Mark As Complete" Button (matching Image 3) */}
            <div className="pt-8 border-t border-border/60 space-y-3">
              {isAcknowledged ? (
                <div className="w-full h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Completed on {formattedAckDate || "today"} — Lesson Verified</span>
                </div>
              ) : (
                <Button
                  onClick={handleAcknowledge}
                  disabled={isSubmittingAck}
                  className="w-full h-12 rounded-2xl bg-gold text-navy hover:bg-gold/90 font-extrabold text-sm shadow-lg shadow-gold/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{isSubmittingAck ? "Recording Progress..." : "Mark As Complete"}</span>
                </Button>
              )}

              <p className="text-center text-xs text-muted-foreground">
                {isAcknowledged
                  ? "You have completed this lesson. Progress has been logged in your MSREG Certification record."
                  : `Signed in as ${agent?.full_name || "MSREG Agent"}. Click "Mark As Complete" to log your progress.`}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Course Contents Sidebar (matching Image 3) */}
        <div className="lg:col-span-4 sticky top-20">
          <CourseSidebarContents
            currentPlaybook={playbook}
            modulePlaybooks={modulePlaybooks}
            allPlaybooks={allPlaybooks}
          />
        </div>
      </div>
    </div>
  );
}
