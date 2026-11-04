import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, User, LogOut } from "lucide-react";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";

interface AgentNavProps {
  activeTool?: string;
}

export function AgentNav({ activeTool: _activeTool }: AgentNavProps) {
  const { agent, signOutAgent } = useAgentAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOutAgent();
    navigate({ to: "/agents", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-surface-1/90 backdrop-blur-md border-b border-border shadow-2xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-3">
          {/* Left: Brand & Return to Hub */}
          <div className="flex items-center gap-3">
            <Link
              to="/agents"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline shrink-0"
              title="Return to MSREG Agent Hub"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Agent Hub
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <Link to="/agents" className="flex items-center gap-2 group">
              <img src={logo} alt="MSREG Logo" className="h-7 w-auto transition-transform group-hover:scale-105" />
              <div className="hidden sm:flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
                  Matt Smith Real Estate Group
                </span>
                <span className="text-xs font-bold text-foreground leading-tight">
                  Seller Net Proceeds
                </span>
              </div>
            </Link>
          </div>

          {/* Right: Agent Account & Sign Out */}
          <div className="flex items-center gap-3">
            {agent ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-surface-2/50 px-2.5 py-1 rounded-full border border-border/60">
                <User className="h-3.5 w-3.5 text-accent" />
                <span className="font-semibold text-foreground max-w-[140px] sm:max-w-[200px] truncate" title={agent.full_name}>
                  {agent.full_name}
                </span>
              </div>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSignOut}
              className="text-xs border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground h-8 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
