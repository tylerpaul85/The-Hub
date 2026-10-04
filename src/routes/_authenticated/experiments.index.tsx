import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, FlaskConical, Wand2, CalendarOff, UserCheck, Bot, Share2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/experiments/")({
  component: ExperimentsIndex,
});

function ExperimentsIndex() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-2xl font-semibold">Experiments & Lab</h1>
          <p className="text-sm text-muted-foreground">
            Admin tools, intelligence, and prototypes.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Meta Social & Analytics */}
        <Link to="/meta-social">
          <Card className="p-5 hover:border-gold transition-all cursor-pointer h-full border-gold/40 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent shadow-sm hover:shadow-md">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-gold/15 text-gold border border-gold/30 shrink-0">
                <Share2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Social & Analytics</span>
                  <Badge
                    variant="outline"
                    className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold"
                  >
                    Lab / Meta API
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Meta Graph API integration for publishing content directly to Facebook &
                  Instagram, and monitoring real-time page analytics.
                </div>
              </div>
            </div>
          </Card>
        </Link>
        {/* Agent Audit System */}
        <Link to="/admin/audit">
          <Card className="p-5 hover:border-gold transition-all cursor-pointer h-full border-gold/40 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent shadow-sm hover:shadow-md">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-gold/15 text-gold border border-gold/30 shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Agent Audit System</span>
                  <Badge
                    variant="outline"
                    className="bg-gold/15 text-gold border-gold/30 text-[10px] font-bold"
                  >
                    Admin
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Audit agent quality in Follow Up Boss, grade conversation timelines against our
                  rubric, catch data-integrity issues (SQL only), and produce reports.
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {/* FUB AI Assistant */}
        <Link to="/admin/assistant">
          <Card className="p-5 hover:border-gold transition-all cursor-pointer h-full border-gold/40 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent shadow-sm hover:shadow-md">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-gold/15 text-gold border border-gold/30 shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">FUB AI Assistant</span>
                  <Badge
                    variant="outline"
                    className="bg-gold/15 text-gold border-gold/30 text-[10px] font-bold"
                  >
                    Admin
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Interactive conversational analyst for Follow Up Boss pipeline metrics, stale
                  leads leaderboards, and source reports.
                </div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/my-availability">
          <Card className="p-5 hover:border-gold/60 transition-colors cursor-pointer h-full">
            <div className="flex items-start gap-3">
              <CalendarOff className="h-5 w-5 text-gold mt-1" />
              <div>
                <div className="font-semibold">My Availability</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Manage agent unavailability dates for the duty calendar. (Moved to Lab).
                </div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/experiments/tv-dashboard">
          <Card className="p-5 hover:border-gold/60 transition-colors cursor-pointer h-full border-gold/30 bg-gradient-to-br from-gold/5 to-transparent">
            <div className="flex items-start gap-3">
              <Tv className="h-5 w-5 text-gold mt-1" />
              <div>
                <div className="font-semibold">Live Stats TV Dashboard</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Fullscreen, auto-refreshing Follow Up Boss stats for the office TV. Open this on
                  the TV device and press Fullscreen.
                </div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/experiments/live-stats">
          <Card className="p-5 hover:border-gold/60 transition-colors cursor-pointer h-full">
            <div className="flex items-start gap-3">
              <FlaskConical className="h-5 w-5 text-gold mt-1" />
              <div>
                <div className="font-semibold">API Diagnostics</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Raw probes against Follow Up Boss + Sisu endpoints. For debugging connections
                  only.
                </div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/experiments/virtual-staging">
          <Card className="p-5 hover:border-gold/60 transition-colors cursor-pointer h-full border-gold/30 bg-gradient-to-br from-gold/5 to-transparent">
            <div className="flex items-start gap-3">
              <Wand2 className="h-5 w-5 text-gold mt-1" />
              <div>
                <div className="font-semibold">Virtual Staging Tool</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Upload an empty room photo, choose a style, and get AI-staged versions. Admin /
                  marketing only.
                </div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
