import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  ShieldCheck,
  Edit,
  Trash2,
  Users,
  Eye,
  Layers,
  Sparkles,
  Tag,
  ArrowUpDown,
  FileText,
  Calendar,
  Check,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listAdminPlaybooks,
  listPlaybookGroups,
  markPlaybookReviewed,
  deleteAdminPlaybook,
  type PlaybookRecord,
  type PlaybookGroup,
} from "@/lib/playbooks.functions";
import { PlaybookEditorDialog } from "@/components/playbooks/playbook-editor-dialog";
import { PlaybookVersionDialog } from "@/components/playbooks/playbook-version-dialog";
import { PlaybookAcknowledgmentDialog } from "@/components/playbooks/playbook-acknowledgment-dialog";
import { PlaybookGroupsManager } from "@/components/playbooks/playbook-groups-manager";

export const Route = createFileRoute("/_authenticated/admin/playbooks")({
  ssr: false,
  component: AdminPlaybooksPage,
  head: () => ({
    meta: [{ title: "Playbooks Manager — MSREG Hub" }],
  }),
});

function AdminPlaybooksPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();

  const listPlaybooksFn = useServerFn(listAdminPlaybooks);
  const listGroupsFn = useServerFn(listPlaybookGroups);
  const markReviewedFn = useServerFn(markPlaybookReviewed);
  const deletePlaybookFn = useServerFn(deleteAdminPlaybook);

  // Main UI state
  const [activeTab, setActiveTab] = useState<"playbooks" | "groups">("playbooks");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Modals state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<PlaybookRecord | null>(null);

  const [versionOpen, setVersionOpen] = useState(false);
  const [versionPlaybook, setVersionPlaybook] = useState<PlaybookRecord | null>(null);

  const [ackOpen, setAckOpen] = useState(false);
  const [ackPlaybook, setAckPlaybook] = useState<PlaybookRecord | null>(null);

  // Query playbooks
  const { data: playbooks = [], isLoading: isLoadingPlaybooks, refetch: refetchPlaybooks } = useQuery({
    queryKey: ["admin-playbooks"],
    queryFn: () => listPlaybooksFn(),
    enabled: isAdmin,
  });

  // Query groups
  const { data: groups = [], refetch: refetchGroups } = useQuery({
    queryKey: ["playbook-groups"],
    queryFn: () => listGroupsFn(),
    enabled: isAdmin,
  });

  // Calculate overdue count
  const overdueCount = useMemo(() => {
    return playbooks.filter((p) => p.is_review_overdue).length;
  }, [playbooks]);

  // Categories list derived from playbooks
  const categories = useMemo(() => {
    const set = new Set(playbooks.map((p) => p.category));
    return Array.from(set);
  }, [playbooks]);

  // Filtered playbooks
  const filteredPlaybooks = useMemo(() => {
    return playbooks.filter((pb) => {
      // Search
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        pb.title.toLowerCase().includes(q) ||
        (pb.summary && pb.summary.toLowerCase().includes(q)) ||
        pb.owner.toLowerCase().includes(q) ||
        pb.tags.some((t) => t.toLowerCase().includes(q));

      // Category
      const matchCategory = categoryFilter === "all" || pb.category === categoryFilter;

      // Status
      const matchStatus = statusFilter === "all" || pb.status === statusFilter;

      // Group
      const matchGroup =
        groupFilter === "all" ||
        pb.assigned_groups.some((g) => g.id === groupFilter || g.name === groupFilter);

      // Overdue
      const matchOverdue = !overdueOnly || pb.is_review_overdue;

      return matchSearch && matchCategory && matchStatus && matchGroup && matchOverdue;
    });
  }, [playbooks, search, categoryFilter, statusFilter, groupFilter, overdueOnly]);

  // Actions
  const handleMarkReviewed = async (pb: PlaybookRecord) => {
    try {
      await markReviewedFn({
        data: {
          id: pb.id,
          reviewed_by: user?.email || "Admin",
        },
      });
      toast.success(`Marked "${pb.title}" as reviewed!`);
      refetchPlaybooks();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark as reviewed");
    }
  };

  const handleDelete = async (pb: PlaybookRecord) => {
    const confirm = window.confirm(
      `Are you sure you want to delete playbook "${pb.title}"? This cannot be undone.`
    );
    if (!confirm) return;

    try {
      await deletePlaybookFn({ data: pb.id });
      toast.success("Playbook deleted");
      refetchPlaybooks();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete playbook");
    }
  };

  const handleOpenCreate = () => {
    setEditingPlaybook(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (pb: PlaybookRecord) => {
    setEditingPlaybook(pb);
    setEditorOpen(true);
  };

  const handleOpenVersions = (pb: PlaybookRecord) => {
    setVersionPlaybook(pb);
    setVersionOpen(true);
  };

  const handleOpenAckReport = (pb: PlaybookRecord) => {
    setAckPlaybook(pb);
    setAckOpen(true);
  };

  // If not admin, access denied holding screen
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The Playbooks Admin section is reserved for Matt Smith Real Estate Group administrators and leadership.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Playbooks Manager"
        subtitle="Manage agent operating procedures, Markdown guidelines, access groups, and review cadence."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenCreate}
              className="bg-gold text-navy hover:bg-gold/90 font-bold text-xs h-9 shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New Playbook
            </Button>
          </div>
        }
      />

      {/* Overdue Review Alert Banner (Flag anything not reviewed in 6+ months) */}
      {overdueCount > 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-200">
                {overdueCount} {overdueCount === 1 ? "Playbook Requires" : "Playbooks Require"} Review
              </p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                These playbooks have not been reviewed in 6+ months. Keeping procedures current ensures agents execute team standards accurately.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`text-xs h-8 border-amber-500/40 shrink-0 ${
              overdueOnly
                ? "bg-amber-500 text-navy font-bold hover:bg-amber-400"
                : "bg-surface-1/60 hover:bg-surface-2 text-amber-300"
            }`}
          >
            {overdueOnly ? "Show All Playbooks" : "Filter Overdue Playbooks"}
          </Button>
        </div>
      ) : null}

      {/* Main Navigation Tabs: Playbooks vs Access Groups */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="bg-surface-2 p-1 border border-border">
          <TabsTrigger value="playbooks" className="text-xs font-semibold">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> All Playbooks ({playbooks.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="text-xs font-semibold">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Access Groups ({groups.length})
          </TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1: PLAYBOOKS LIST VIEW                                        */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="playbooks" className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-1 border border-border">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, owner, tags, or content..."
                className="pl-9 h-9 text-xs bg-surface-2 border-border"
              />
            </div>

            {/* Select Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>

              {/* Group Filter */}
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Assigned Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              {/* Overdue filter pill */}
              <button
                type="button"
                onClick={() => setOverdueOnly(!overdueOnly)}
                className={`h-9 px-3 rounded-md text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  overdueOnly
                    ? "bg-amber-500 text-navy border-amber-500 font-bold"
                    : "bg-surface-2 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Overdue (6m+)</span>
                {overdueCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/20 text-amber-300">
                    {overdueCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Table of Playbooks */}
          {isLoadingPlaybooks ? (
            <div className="py-24 text-center space-y-3">
              <BookOpen className="h-8 w-8 animate-pulse text-accent mx-auto" />
              <p className="text-xs text-muted-foreground">Loading playbook repository...</p>
            </div>
          ) : filteredPlaybooks.length === 0 ? (
            <EmptyState
              title="No Playbooks Found"
              description="No playbooks match your current search and filter criteria."
              actionLabel="Create New Playbook"
              onAction={handleOpenCreate}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-surface-1 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-surface-2/70 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Playbook Title</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Owner</th>
                      <th className="p-4">Assigned Groups</th>
                      <th className="p-4">Last Reviewed</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredPlaybooks.map((pb) => {
                      const isOverdue = pb.is_review_overdue;
                      const statusClass =
                        pb.status === "published"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : pb.status === "draft"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border";

                      return (
                        <tr
                          key={pb.id}
                          className={`hover:bg-surface-2/60 transition-colors ${
                            isOverdue ? "bg-amber-500/[0.03]" : ""
                          }`}
                        >
                          {/* Title & Summary */}
                          <td className="p-4 max-w-sm">
                            <div className="space-y-1">
                              <span
                                onClick={() => handleOpenEdit(pb)}
                                className="font-bold text-sm text-foreground hover:text-gold cursor-pointer transition-colors block"
                              >
                                {pb.title}
                              </span>
                              {pb.summary ? (
                                <p className="text-[11px] text-muted-foreground line-clamp-1">
                                  {pb.summary}
                                </p>
                              ) : null}
                              {pb.tags && pb.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {pb.tags.slice(0, 3).map((t, i) => (
                                    <span
                                      key={i}
                                      className="px-1.5 py-0.2 rounded bg-surface-2 text-[10px] text-muted-foreground border border-border/50"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                  {pb.tags.length > 3 ? (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{pb.tags.length - 3}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="p-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-surface-2 text-foreground font-semibold text-[11px] border border-border">
                              {pb.category}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusClass}`}
                            >
                              {pb.status}
                            </span>
                          </td>

                          {/* Owner */}
                          <td className="p-4 whitespace-nowrap text-foreground font-medium">
                            {pb.owner}
                          </td>

                          {/* Assigned Groups */}
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {pb.assigned_groups.map((g) => (
                                <span
                                  key={g.id}
                                  className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold border border-accent/20"
                                >
                                  {g.name}
                                </span>
                              ))}
                              {pb.assigned_groups.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground italic">None</span>
                              ) : null}
                            </div>
                          </td>

                          {/* Last Reviewed & Overdue Badge */}
                          <td className="p-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <span
                                className={`text-[11px] font-medium block ${
                                  isOverdue ? "text-amber-400 font-bold" : "text-foreground"
                                }`}
                              >
                                {pb.last_reviewed_at
                                  ? new Date(pb.last_reviewed_at).toLocaleDateString()
                                  : "Never"}
                              </span>

                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <AlertTriangle className="h-2.5 w-2.5" /> 6+ Months Overdue
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {pb.months_since_review > 0
                                    ? `${pb.months_since_review} mo ago`
                                    : "Recently reviewed"}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Mark as Reviewed Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkReviewed(pb)}
                                title="Mark as Reviewed today"
                                className="h-8 px-2 text-[11px] border-border hover:bg-surface-2 text-muted-foreground hover:text-emerald-400 cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                                <span>Reviewed</span>
                              </Button>

                              {/* Acknowledgment Report Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenAckReport(pb)}
                                title="View Agent Acknowledgment Compliance"
                                className="h-8 px-2 text-[11px] text-muted-foreground hover:text-accent cursor-pointer"
                              >
                                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                                <span>Report</span>
                              </Button>

                              {/* Version History Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenVersions(pb)}
                                title="Version History"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>

                              {/* Edit Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEdit(pb)}
                                title="Edit Playbook"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-gold cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>

                              {/* Delete Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(pb)}
                                title="Delete Playbook"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ----------------------------------------------------------------- */}
        {/* TAB 2: ACCESS GROUPS MANAGEMENT                                   */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="groups">
          <PlaybookGroupsManager onGroupsUpdated={() => {
            refetchGroups();
            refetchPlaybooks();
          }} />
        </TabsContent>
      </Tabs>

      {/* Playbook Editor Dialog */}
      <PlaybookEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        playbook={editingPlaybook}
        groups={groups}
        currentUser={user?.email || "Admin"}
        onSaved={() => {
          refetchPlaybooks();
        }}
      />

      {/* Version History Dialog */}
      <PlaybookVersionDialog
        open={versionOpen}
        onOpenChange={setVersionOpen}
        playbook={versionPlaybook}
        onRestored={() => {
          refetchPlaybooks();
        }}
      />

      {/* Acknowledgment Report Dialog */}
      <PlaybookAcknowledgmentDialog
        open={ackOpen}
        onOpenChange={setAckOpen}
        playbook={ackPlaybook}
      />
    </div>
  );
}
