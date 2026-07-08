import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Tv, FlaskConical, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/experiments/")({
  component: ExperimentsIndex,
});

function ExperimentsIndex() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-2xl font-semibold">Experiments</h1>
          <p className="text-sm text-muted-foreground">
            Hidden lab. Restricted access.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/experiments/tv-dashboard">
          <Card className="p-5 hover:border-gold/60 transition-colors cursor-pointer h-full border-gold/30 bg-gradient-to-br from-gold/5 to-transparent">
            <div className="flex items-start gap-3">
              <Tv className="h-5 w-5 text-gold mt-1" />
              <div>
                <div className="font-semibold">Live Stats TV Dashboard</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Fullscreen, auto-refreshing Follow Up Boss stats for the office TV.
                  Open this on the TV device and press Fullscreen.
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
                  Raw probes against Follow Up Boss + Sisu endpoints. For debugging
                  connections only.
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
                  Upload an empty room photo, choose a style, and get AI-staged versions.
                  Admin / marketing only.
                </div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

    </div>
  );
}
