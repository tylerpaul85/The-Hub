import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  BookOpen,
  Sparkles,
  Calculator,
  ArrowRight,
  Search,
  X,
  Layers,
  Award,
} from "lucide-react";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { listAgentPlaybooks, searchPlaybooksFn, type AgentPlaybookSearchResult } from "@/lib/playbooks.functions";
import { AgentPlaybookSearch } from "@/components/playbooks/agent-playbook-search";
import { CourseHeroBanner } from "@/components/playbooks/course-hero-banner";
import { CourseAccordionList } from "@/components/playbooks/course-accordion-list";
import { CourseSidebarOverview } from "@/components/playbooks/course-sidebar-overview";
import { PlaybookThumbnail } from "@/components/playbooks/playbook-thumbnail";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/playbooks/")({
  validateSearch: searchSchema,
  component: PlaybooksIndexPage,
  head: () => ({
    meta: [
      { title: "Listing Agent Certification — Matt Smith Real Estate Group" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PlaybooksIndexPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { agent } = useAgentAuth();

  // 1. Fetch accessible directory
  const { data: directory, isLoading, error } = useQuery({
    queryKey: ["agent-playbooks-directory", agent?.id],
    queryFn: async () => {
      return await listAgentPlaybooks({ data: { agentId: agent?.id } });
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  // 2. Fetch full search results if q is present
  const { data: fullSearchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["agent-playbooks-search", q, agent?.id],
    queryFn: async () => {
      if (!q || !q.trim()) return [];
      return await searchPlaybooksFn({
        data: {
          query: q.trim(),
          agentId: agent?.id,
          limit: 30,
        },
      });
    },
    enabled: Boolean(q && q.trim()),
  });

  const handleSearchSubmit = (newQuery: string) => {
    navigate({
      to: "/playbooks",
      search: (prev: any) => ({
        ...prev,
        q: newQuery.trim() ? newQuery.trim() : undefined,
      }),
    });
  };

  const handleClearSearch = () => {
    navigate({
      to: "/playbooks",
      search: (prev: any) => ({ ...prev, q: undefined }),
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Breadcrumb Bar matching Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Link to="/agent-tools" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="text-muted-foreground/60">&gt;</span>
          <Link to="/playbooks" className="hover:text-foreground transition-colors">
            Courses
          </Link>
          <span className="text-muted-foreground/60">&gt;</span>
          <span className="font-bold text-foreground">Listing Agent Certification</span>
        </div>

        {/* Search bar at the top */}
        <div className="w-full sm:w-80">
          <AgentPlaybookSearch
            initialQuery={q || ""}
            onSearchSubmit={handleSearchSubmit}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-16 text-center space-y-3">
          <BookOpen className="h-10 w-10 animate-pulse text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Listing Agent Certification curriculum...</p>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-8 rounded-2xl border border-destructive/40 bg-destructive/10 text-center space-y-2">
          <p className="text-sm font-semibold text-destructive">Unable to load curriculum</p>
          <p className="text-xs text-muted-foreground">
            {(error as any)?.message || "Please refresh or try again later."}
          </p>
        </div>
      )}

      {/* When Search Query is Active: Full Search Results View */}
      {q && q.trim() && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <Search className="h-4 w-4 text-gold" />
                <span>Results for &quot;{q}&quot;</span>
                {!isSearchLoading && fullSearchResults && (
                  <span className="text-xs font-bold text-muted-foreground bg-surface-2 px-2.5 py-0.5 rounded-full border border-border/60">
                    {fullSearchResults.length} found
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Showing matching lessons and SOPs from your certification library
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSearch}
              className="h-8 px-3 text-xs border-border bg-surface-1 hover:bg-surface-2 rounded-xl self-start sm:self-auto cursor-pointer"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              <span>Back to curriculum</span>
            </Button>
          </div>

          {isSearchLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin text-gold" />
              <span>Searching lessons...</span>
            </div>
          ) : fullSearchResults && fullSearchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fullSearchResults.map((pb) => (
                <Link
                  key={pb.id}
                  to="/playbooks/$slug"
                  params={{ slug: pb.slug }}
                  className="group rounded-2xl border border-border/80 bg-surface-1 p-5 shadow-xs transition-all hover:border-gold/50 hover:bg-surface-2/40 hover:-translate-y-0.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <PlaybookThumbnail
                      title={pb.title}
                      category={pb.category}
                      className="w-full mb-2"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/70">
                        {pb.category}
                      </span>
                      <span className="text-xs text-muted-foreground">By {pb.owner}</span>
                    </div>

                    <h3 className="text-base font-bold text-foreground group-hover:text-gold transition-colors leading-snug">
                      {pb.title}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {pb.snippet || pb.summary}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-xs text-gold font-bold">
                    <span>Open Lesson</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl border border-border/80 bg-surface-1 space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h3 className="text-base font-bold text-foreground">No lessons found matching &quot;{q}&quot;</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Try searching for broader keywords like &quot;appointment&quot;, &quot;commission&quot;, or &quot;intake&quot;.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSearch}
                className="mt-2 text-xs rounded-xl cursor-pointer"
              >
                Back to full curriculum
              </Button>
            </div>
          )}
        </div>
      )}

      {/* When No Search Active: Course Hero Banner + Two-Column Course View (matching Image 1) */}
      {(!q || !q.trim()) && directory && (
        <div className="space-y-10">
          {/* Top Wide Hero Banner */}
          <CourseHeroBanner
            title="Listing Agent Certification"
            subtitle="The official Matt Smith Real Estate Group training curriculum. In-home presentation workflows, objection talk tracks, and transaction milestones."
            playbooks={directory.playbooks}
          />

          {/* Main Two-Column Layout (matching Image 1 & 2) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (Primary): Expandable Module Accordion List */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Certification Modules</span>
                  <span className="text-xs font-semibold text-muted-foreground bg-surface-2 px-2.5 py-0.5 rounded-full border border-border/60">
                    {directory.categories.length} Modules · {directory.playbooks.length} Lessons
                  </span>
                </h2>
              </div>

              <CourseAccordionList categories={directory.categories} />
            </div>

            {/* Right Column: Course Sidebar (Badge + Progress + Instructor) */}
            <div className="lg:col-span-4 sticky top-20">
              <CourseSidebarOverview
                playbooks={directory.playbooks}
                courseTitle="Listing Agent Certification"
              />
            </div>
          </div>
        </div>
      )}

      {/* Alternate Net Proceeds Tool Footer */}
      <div className="rounded-3xl border border-border/80 bg-surface-1 p-6 sm:p-7 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Need to run a Seller Net Sheet?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Seller Net Proceeds calculator is ready with your saved sheets, PDF downloads, and custom scenarios.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <Link to="/seller-net-proceeds" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-10 bg-gold text-navy hover:bg-gold/90 font-bold text-xs rounded-xl shadow-xs cursor-pointer">
              <span>Go to Net Proceeds</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
          <Link to="/agent-tools" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-10 border-border hover:bg-surface-2 text-xs rounded-xl cursor-pointer">
              Agent Tools Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
