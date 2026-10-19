import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid,
  Calculator,
  BookOpen,
  LogOut,
  ArrowLeft,
  User,
  ExternalLink,
} from "lucide-react";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentNavProps {
  activeTool: "tools" | "proceeds" | "playbooks";
}

export function AgentNav({ activeTool }: AgentNavProps) {
  const { agent, signOutAgent } = useAgentAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOutAgent();
    navigate({ to: "/agent-tools", replace: true });
  };

  const navItems = [
    {
      id: "tools",
      label: "All Tools",
      to: "/agent-tools",
      icon: LayoutGrid,
    },
    {
      id: "proceeds",
      label: "Seller Net Proceeds",
      to: "/seller-net-proceeds",
      icon: Calculator,
    },
    {
      id: "playbooks",
      label: "Playbook Library",
      to: "/playbooks",
      icon: BookOpen,
      badge: "Beta",
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface-1/90 backdrop-blur-md border-b border-border shadow-2xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3">
          {/* Left: Brand & Hub Link */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Link
              to="/agents"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline shrink-0"
              title="Return to MSREG Agent Hub"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Agent Portal
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <Link to="/agent-tools" className="flex items-center gap-2 group">
              <img src={logo} alt="MSREG Logo" className="h-7 w-auto transition-transform group-hover:scale-105" />
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
                  MSREG Agent
                </span>
                <span className="text-xs font-bold text-foreground leading-tight">
                  Tools Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Tool Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-surface-2/80 p-1 rounded-xl border border-border/80 w-full sm:w-auto overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTool === item.id;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                    isActive
                      ? "bg-accent text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-bold",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-surface-3 text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Right: Agent Account & Sign Out */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {agent ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-surface-2/50 px-2.5 py-1 rounded-full border border-border/60">
                <User className="h-3.5 w-3.5 text-accent" />
                <span className="font-semibold text-foreground max-w-[140px] truncate" title={agent.full_name}>
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
