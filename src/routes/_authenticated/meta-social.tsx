/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { ALLOWED_EXPERIMENT_EMAILS } from "./experiments";
import {
  Share2,
  BarChart3,
  Send,
  Settings2,
  CheckCircle2,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Share,
  Users,
  Image as ImageIcon,
  KeyRound,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import {
  getMetaConfig,
  connectFacebookPage,
  disconnectFacebookPage,
  publishPostToMeta,
  getPageAnalytics,
} from "@/lib/meta-social.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/meta-social")({
  component: MetaSocialPage,
  head: () => ({
    meta: [
      { title: "Meta Social & Analytics — MSREG Hub" },
      {
        name: "description",
        content: "Publish content to Facebook and monitor live page analytics.",
      },
    ],
  }),
});

function MetaSocialPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"analytics" | "publisher" | "settings">("analytics");

  // Server functions
  const fetchConfig = useServerFn(getMetaConfig);
  const fetchAnalytics = useServerFn(getPageAnalytics);
  const connectPageFn = useServerFn(connectFacebookPage);
  const disconnectPageFn = useServerFn(disconnectFacebookPage);
  const publishFn = useServerFn(publishPostToMeta);

  // Queries
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["meta-config"],
    queryFn: () => fetchConfig(),
  });

  // Selected page for Analytics switcher
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const activePageId = selectedPageId || configData?.pages?.[0]?.page_id || "";

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
    isRefetching,
  } = useQuery({
    queryKey: ["meta-analytics", activePageId],
    queryFn: () => fetchAnalytics({ data: { pageId: activePageId || undefined } }),
    enabled: Boolean(activePageId) || (configData?.pages?.length ?? 0) > 0,
  });

  // Settings form state
  const [pageId, setPageId] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [brandTag, setBrandTag] = useState("PP");

  // Publisher form state
  const [publishTargetBrand, setPublishTargetBrand] = useState<string>("MSREG ALL");
  const [publishMessage, setPublishMessage] = useState("");
  const [publishImageUrl, setPublishImageUrl] = useState("");
  const [lastPublishedUrl, setLastPublishedUrl] = useState<string | null>(null);

  // Mutations
  const connectMutation = useMutation({
    mutationFn: () =>
      connectPageFn({
        data: {
          pageId,
          pageAccessToken,
          brandTag,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Successfully connected ${res.page.page_name}!`);
      setPageId("");
      setPageAccessToken("");
      queryClient.invalidateQueries({ queryKey: ["meta-config"] });
      queryClient.invalidateQueries({ queryKey: ["meta-analytics"] });
      setActiveTab("analytics");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to connect Facebook Page.");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectPageFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Page disconnected.");
      queryClient.invalidateQueries({ queryKey: ["meta-config"] });
      queryClient.invalidateQueries({ queryKey: ["meta-analytics"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disconnect page.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishFn({
        data: {
          brandTag: publishTargetBrand,
          message: publishMessage,
          mediaUrl: publishImageUrl || undefined,
          mediaType: publishImageUrl ? "photo" : "status",
        },
      }),
    onSuccess: (res) => {
      toast.success(`Post successfully published to ${res.pageName}!`);
      setLastPublishedUrl(res.permalinkUrl);
      setPublishMessage("");
      setPublishImageUrl("");
      queryClient.invalidateQueries({ queryKey: ["meta-analytics"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to publish post.");
    },
  });

  const isConnected = (configData?.pages?.length ?? 0) > 0;

  const email = (user?.email ?? "").toLowerCase();
  const canAccess = isAdmin || ALLOWED_EXPERIMENT_EMAILS.includes(email);
  if (!authLoading && !canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Back to Experiments breadcrumb */}
      <div>
        <Link
          to="/experiments"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Experiments
        </Link>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Share2 className="h-6 w-6 text-gold" />
              Meta Social & Analytics
            </h1>
            <Badge
              variant="outline"
              className="bg-gold/15 text-gold border-gold/30 text-xs font-semibold"
            >
              Lab Experiment
            </Badge>
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
              }
            >
              {isConnected ? "Page Connected" : "Setup Required"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Publish content directly to Facebook and monitor real-time reach, engagement, and post
            performance.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-card/60 p-1 rounded-xl border border-border/60">
          <Button
            variant={activeTab === "analytics" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("analytics")}
            className="text-xs gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </Button>
          <Button
            variant={activeTab === "publisher" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("publisher")}
            className="text-xs gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Publish Studio
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className="text-xs gap-1.5"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Page Setup
          </Button>
        </div>
      </div>

      {/* ── TAB 1: ANALYTICS & INSIGHTS ── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {!isConnected ? (
            <Card className="border-border/60 bg-card/40 text-center py-12">
              <CardContent className="space-y-4 max-w-md mx-auto">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <KeyRound className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">
                    No Facebook Page Connected
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Connect your MSREG Facebook Page in the Page Setup tab to start viewing live
                    analytics and publishing content.
                  </p>
                </div>
                <Button
                  onClick={() => setActiveTab("settings")}
                  className="text-xs bg-gold hover:bg-gold/90"
                >
                  Connect Facebook Page →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Analytics Header with Multi-Page Switcher & Refresh */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center gap-3">
                  {analyticsData?.pictureUrl ? (
                    <img
                      src={analyticsData.pictureUrl}
                      alt={analyticsData.pageName}
                      className="h-12 w-12 rounded-full border border-border/80 object-cover shadow-xs"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gold/15 text-gold flex items-center justify-center font-bold text-sm border border-gold/30">
                      MS
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">
                        {analyticsData?.pageName}
                      </h2>
                      {analyticsData?.brandTag && (
                        <Badge
                          variant="outline"
                          className="bg-gold/15 text-gold border-gold/30 text-[10px] font-bold"
                        >
                          {analyticsData.brandTag}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Live Facebook Page Performance & Insights
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Page Switcher */}
                  {configData?.pages && configData.pages.length > 1 && (
                    <div className="flex items-center bg-background/80 p-1 rounded-lg border border-border/60">
                      {configData.pages.map((p: any) => {
                        const isSelected = activePageId === p.page_id;
                        const label = p.brand_tag
                          ? `${p.brand_tag} · ${p.page_name.includes("Lake") ? "Lake of the Ozarks" : "Main Page"}`
                          : p.page_name;
                        return (
                          <Button
                            key={p.page_id}
                            type="button"
                            variant={isSelected ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedPageId(p.page_id)}
                            className={`text-xs h-7 px-3 rounded-md transition-all ${
                              isSelected
                                ? "bg-gold text-primary-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchAnalytics()}
                    disabled={isRefetching}
                    className="text-xs gap-1.5 border-border/60 h-8"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-border/60 bg-card/40">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center justify-between">
                      Page Followers
                      <Users className="h-3.5 w-3.5 text-gold" />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {(analyticsData?.followersCount ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Total followers</p>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/40">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center justify-between">
                      Recent Engagements
                      <Sparkles className="h-3.5 w-3.5 text-gold" />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {(analyticsData?.recentStats?.totalEngagements ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Likes + comments + shares</p>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/40">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center justify-between">
                      Recent Reactions
                      <ThumbsUp className="h-3.5 w-3.5 text-gold" />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {(analyticsData?.recentStats?.totalLikes ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Across last 15 posts</p>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/40">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center justify-between">
                      Post Comments
                      <MessageSquare className="h-3.5 w-3.5 text-gold" />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {(analyticsData?.recentStats?.totalComments ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Across last 15 posts</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Posts Table / Cards */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Recent Published Posts & Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(analyticsData?.posts || []).map((post: any) => (
                    <Card
                      key={post.id}
                      className="border-border/60 bg-card/40 flex flex-col justify-between"
                    >
                      <CardContent className="p-4 space-y-3">
                        {post.imageUrl && (
                          <div className="aspect-video w-full overflow-hidden rounded-md border border-border/40 bg-muted/40">
                            <img
                              src={post.imageUrl}
                              alt="Post graphic"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                          {post.message}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3 text-gold" /> {post.likesCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-gold" /> {post.commentsCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share className="h-3 w-3 text-gold" /> {post.sharesCount}
                          </span>
                          <a
                            href={post.permalinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-gold hover:underline font-medium"
                          >
                            View <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: PUBLISH STUDIO ── */}
      {activeTab === "publisher" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Send className="h-4 w-4 text-gold" />
                Publish Directly to Facebook Page
              </CardTitle>
              <CardDescription className="text-xs">
                Draft your post caption, attach a graphic link, and publish instantly without
                leaving the Hub.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastPublishedUrl && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                  <div className="text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Your post was published live on Facebook!</span>
                  </div>
                  <a
                    href={lastPublishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 underline"
                  >
                    View Post <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Post Destination Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Post Destination</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishTargetBrand("MSREG ALL")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      publishTargetBrand === "MSREG ALL"
                        ? "border-gold bg-gold/15 text-foreground font-semibold ring-1 ring-gold/40 shadow-xs"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <p className="font-semibold text-foreground">Both Pages</p>
                    <p className="text-[11px] text-muted-foreground">MSREG ALL (Main & LOZ)</p>
                  </button>
                  {configData?.pages?.map((p: any) => {
                    const isSelected = publishTargetBrand === (p.brand_tag || p.page_id);
                    return (
                      <button
                        key={p.page_id}
                        type="button"
                        onClick={() => setPublishTargetBrand(p.brand_tag || p.page_id)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? "border-gold bg-gold/15 text-foreground font-semibold ring-1 ring-gold/40 shadow-xs"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <p className="font-semibold text-foreground truncate">{p.page_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.brand_tag ? `Brand: ${p.brand_tag}` : "Connected Page"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="postMessage" className="text-xs font-medium">
                  Post Caption / Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="postMessage"
                  rows={5}
                  value={publishMessage}
                  onChange={(e) => setPublishMessage(e.target.value)}
                  placeholder="Just listed! Check out this gorgeous property at..."
                  className="bg-background/60 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="postImage" className="text-xs font-medium">
                  Image or Graphic URL (Optional)
                </Label>
                <Input
                  id="postImage"
                  type="url"
                  value={publishImageUrl}
                  onChange={(e) => setPublishImageUrl(e.target.value)}
                  placeholder="https://... (image URL from listing or cloud storage)"
                  className="bg-background/60 text-xs"
                />
              </div>

              {publishImageUrl && (
                <div className="rounded-lg border border-border/40 p-2 bg-background/50">
                  <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Image Preview:
                  </p>
                  <img
                    src={publishImageUrl}
                    alt="Preview"
                    className="max-h-48 rounded object-cover mx-auto"
                    onError={() => toast.error("Could not preview image URL")}
                  />
                </div>
              )}

              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || !publishMessage.trim() || !isConnected}
                className="w-full bg-gold hover:bg-gold/90 text-primary-foreground font-semibold text-xs py-2.5 gap-2"
              >
                {publishMutation.isPending
                  ? "Publishing to Facebook..."
                  : "Publish Live to Facebook"}
                <Send className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 3: PAGE SETUP & CREDENTIALS ── */}
      {activeTab === "settings" && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* App Credentials Info */}
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gold" />
                Meta App Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-background/50">
                <span className="text-muted-foreground">App ID:</span>
                <code className="font-mono font-semibold text-foreground">
                  {configData?.appId || "2004401023558912"}
                </code>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-background/50">
                <span className="text-muted-foreground">App Secret:</span>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                >
                  Configured in .env
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Permanent Token Setup Guide */}
          <Card className="border-gold/30 bg-gold/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gold flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                How to Get a Permanent (Never-Expiring) Page Token
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                <strong>Why do tokens expire?</strong> Graph API Explorer issues temporary test
                sessions that Meta automatically terminates at midnight PDT (00:00:00 PDT). Follow
                either option below for a permanent connection:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border border-border/50 bg-background/60 p-3 space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-gold text-[11px] font-bold">
                    1
                  </span>
                  Option A: Meta Business Suite System User (Recommended — Never Expires)
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] pl-1 leading-relaxed">
                  <li>
                    Open{" "}
                    <a
                      href="https://business.facebook.com/settings"
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold underline inline-flex items-center gap-0.5"
                    >
                      Meta Business Settings <ExternalLink className="h-2.5 w-2.5" />
                    </a>{" "}
                    &rarr; <strong>Users</strong> &rarr; <strong>System Users</strong>.
                  </li>
                  <li>
                    Click <strong>Add</strong> &rarr; Name: <code>Hub Automation</code>, Role:{" "}
                    <strong>Admin</strong>.
                  </li>
                  <li>
                    Click <strong>Assign Assets</strong> &rarr; <strong>Pages</strong> &rarr; Select
                    both your pages &rarr; Enable <strong>Full Control</strong> (Manage Page) &rarr;
                    Save.
                  </li>
                  <li>
                    Click <strong>Generate New Token</strong> &rarr; Select App{" "}
                    <strong>MSREG Marketing Hub</strong> &rarr; Token Expiration:{" "}
                    <strong className="text-foreground">Never</strong>.
                  </li>
                  <li>
                    Check permissions: <code>pages_show_list</code>,{" "}
                    <code>pages_read_engagement</code>, <code>pages_manage_posts</code>,{" "}
                    <code>pages_manage_metadata</code>.
                  </li>
                  <li>
                    Click <strong>Generate Token</strong>, copy it, and paste it below. This token{" "}
                    <strong>never expires</strong>!
                  </li>
                </ol>
              </div>

              <div className="rounded-md border border-border/50 bg-background/60 p-3 space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-gold text-[11px] font-bold">
                    2
                  </span>
                  Option B: Graph API Explorer with App ID
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  If using{" "}
                  <a
                    href="https://developers.facebook.com/tools/explorer"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gold underline inline-flex items-center gap-0.5"
                  >
                    Graph API Explorer <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  , switch the top-right <strong>Meta App</strong> dropdown to{" "}
                  <strong>MSREG Marketing Hub</strong> (not "Graph API Explorer"). When you paste
                  the token here, The Hub will automatically exchange it with your App Secret into a
                  permanent Page Access Token.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Connect New Page */}
          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Share2 className="h-4 w-4 text-gold" />
                Connect Facebook Page
              </CardTitle>
              <CardDescription className="text-xs">
                Enter your Facebook Page ID and Page Access Token to authorize publishing and
                analytics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pageId" className="text-xs font-medium">
                  Facebook Page ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pageId"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="e.g. 102938475612345"
                  className="bg-background/60 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Found in your Facebook Page's "About" section or Business Suite Settings.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pageAccessToken" className="text-xs font-medium">
                  Page Access Token <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pageAccessToken"
                  type="password"
                  value={pageAccessToken}
                  onChange={(e) => setPageAccessToken(e.target.value)}
                  placeholder="EAA..."
                  className="bg-background/60 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Generated via Meta Graph API Explorer or Meta Business System User.
                </p>
              </div>

              {/* Brand Association */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Brand Association <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBrandTag("PP")}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      brandTag === "PP"
                        ? "border-gold bg-gold/15 text-foreground font-semibold ring-1 ring-gold/40 shadow-xs"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <p className="font-semibold text-foreground">PP (Main Page)</p>
                    <p className="text-[10px] text-muted-foreground">
                      Matt Smith Real Estate Group
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandTag("LOZ")}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      brandTag === "LOZ"
                        ? "border-gold bg-gold/15 text-foreground font-semibold ring-1 ring-gold/40 shadow-xs"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <p className="font-semibold text-foreground">LOZ (Lake of Ozarks)</p>
                    <p className="text-[10px] text-muted-foreground">Lake of the Ozarks Page</p>
                  </button>
                </div>
              </div>

              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !pageId.trim() || !pageAccessToken.trim()}
                className="w-full bg-gold hover:bg-gold/90 text-primary-foreground font-semibold text-xs py-2.5"
              >
                {connectMutation.isPending
                  ? "Verifying with Meta..."
                  : "Test Connection & Save Page"}
              </Button>
            </CardContent>
          </Card>

          {/* Connected Pages List */}
          {configData?.pages && configData.pages.length > 0 && (
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Active Connected Pages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {configData.pages.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-foreground">{p.page_name}</p>
                        {p.brand_tag && (
                          <Badge
                            variant="outline"
                            className="bg-gold/15 text-gold border-gold/30 text-[10px] font-bold"
                          >
                            {p.brand_tag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Page ID: {p.page_id}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectMutation.mutate(p.id)}
                      className="text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Guide */}
          <div className="rounded-xl border border-border/40 bg-card/20 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-gold" />
              How to get your permanent Page Access Token:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px]">
              <li>
                Open the{" "}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold underline"
                >
                  Meta Graph API Explorer
                </a>
                .
              </li>
              <li>
                Select your app: <strong>MSREG Marketing Hub</strong>.
              </li>
              <li>
                In the <strong>User or Page</strong> dropdown, choose your Facebook Page.
              </li>
              <li>
                Ensure permissions <code>pages_manage_posts</code> and <code>read_insights</code>{" "}
                are added.
              </li>
              <li>
                Click <strong>Generate Access Token</strong> and paste it above!
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
