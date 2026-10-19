import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ArrowLeft, ShieldAlert, Sparkles } from "lucide-react";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { getAgentPlaybookBySlug } from "@/lib/playbooks.functions";
import { AgentPlaybookDetailView } from "@/components/playbooks/agent-playbook-detail";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/playbooks/$slug")({
  component: PlaybookDetailPage,
  head: () => ({
    meta: [
      { title: "Playbook View — Matt Smith Real Estate Group" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PlaybookDetailPage() {
  const { slug } = useParams({ from: "/playbooks/$slug" });
  const { agent } = useAgentAuth();
  const queryClient = useQueryClient();

  const { data: playbook, isLoading, error } = useQuery({
    queryKey: ["agent-playbook-detail", slug, agent?.id],
    queryFn: async () => {
      return await getAgentPlaybookBySlug({
        data: {
          slug,
          agentId: agent?.id,
        },
      });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <BookOpen className="h-10 w-10 animate-pulse text-gold mx-auto" />
        <p className="text-sm text-muted-foreground">Loading playbook content...</p>
      </div>
    );
  }

  if (error || !playbook) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="h-16 w-16 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Playbook Unavailable</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {(error as any)?.message ||
              "This playbook does not exist, has been archived, or your account does not belong to the required access group."}
          </p>
        </div>

        <div className="pt-2">
          <Link to="/playbooks">
            <Button variant="outline" className="text-xs rounded-xl border-border bg-surface-1 hover:bg-surface-2 cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              <span>Back to Playbook Library</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AgentPlaybookDetailView
      playbook={playbook}
      onAcknowledged={() => {
        queryClient.invalidateQueries({ queryKey: ["agent-playbook-detail", slug] });
        queryClient.invalidateQueries({ queryKey: ["agent-playbooks-directory"] });
      }}
    />
  );
}
