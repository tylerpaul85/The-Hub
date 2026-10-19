import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  UserCheck,
  Shield,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  listPlaybookGroups,
  upsertPlaybookGroup,
  deletePlaybookGroup,
  listAllAgentAccounts,
  updatePlaybookGroupMembers,
  type PlaybookGroup,
  type AgentAccountItem,
} from "@/lib/playbooks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PlaybookGroupsManagerProps {
  onGroupsUpdated: () => void;
}

export function PlaybookGroupsManager({ onGroupsUpdated }: PlaybookGroupsManagerProps) {
  const qc = useQueryClient();
  const listGroupsFn = useServerFn(listPlaybookGroups);
  const upsertGroupFn = useServerFn(upsertPlaybookGroup);
  const deleteGroupFn = useServerFn(deletePlaybookGroup);
  const listAgentsFn = useServerFn(listAllAgentAccounts);
  const updateMembersFn = useServerFn(updatePlaybookGroupMembers);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PlaybookGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Member management modal state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [activeGroupForMembers, setActiveGroupForMembers] = useState<PlaybookGroup | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentSearch, setAgentSearch] = useState("");
  const [isSavingMembers, setIsSavingMembers] = useState(false);

  const { data: groups = [], isLoading: isLoadingGroups, refetch: refetchGroups } = useQuery({
    queryKey: ["playbook-groups"],
    queryFn: () => listGroupsFn(),
  });

  const { data: allAgents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ["all-agent-accounts"],
    queryFn: () => listAgentsFn(),
  });

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupDescription("");
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (group: PlaybookGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setCreateModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setIsSavingGroup(true);
    try {
      await upsertGroupFn({
        data: {
          id: editingGroup?.id,
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
        },
      });

      toast.success(editingGroup ? "Group updated!" : "Group created!");
      setCreateModalOpen(false);
      refetchGroups();
      onGroupsUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save group");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    const confirm = window.confirm(
      `Are you sure you want to delete group "${name}"? Playbooks assigned to this group will lose this specific assignment.`
    );
    if (!confirm) return;

    try {
      await deleteGroupFn({ data: groupId });
      toast.success("Group deleted");
      refetchGroups();
      onGroupsUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete group");
    }
  };

  const handleOpenMembers = (group: PlaybookGroup) => {
    setActiveGroupForMembers(group);
    setSelectedAgentIds(group.agent_ids || []);
    setAgentSearch("");
    setMemberModalOpen(true);
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const handleSelectAllFiltered = (filtered: AgentAccountItem[]) => {
    const filteredIds = filtered.map((a) => a.id);
    setSelectedAgentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectAll = () => {
    setSelectedAgentIds([]);
  };

  const handleSaveMembers = async () => {
    if (!activeGroupForMembers) return;
    setIsSavingMembers(true);
    try {
      await updateMembersFn({
        data: {
          group_id: activeGroupForMembers.id,
          agent_ids: selectedAgentIds,
        },
      });

      toast.success(`Updated members for ${activeGroupForMembers.name}!`);
      setMemberModalOpen(false);
      refetchGroups();
      onGroupsUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update members");
    } finally {
      setIsSavingMembers(false);
    }
  };

  const filteredAgents = allAgents.filter(
    (a) =>
      a.full_name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.email.toLowerCase().includes(agentSearch.toLowerCase()) ||
      (a.office_location && a.office_location.toLowerCase().includes(agentSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-2/60 border border-border/80">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> Agent Access Groups
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
            Groups determine which agent accounts can see specific playbooks and who is held accountable in acknowledgment reports. Agent accounts synchronize automatically with Seller Net Proceeds accounts.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          size="sm"
          className="text-xs bg-gold text-navy hover:bg-gold/90 font-bold h-9 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> New Access Group
        </Button>
      </div>

      {/* Groups Grid */}
      {isLoadingGroups ? (
        <div className="py-16 text-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-accent mx-auto" />
          <p className="text-xs text-muted-foreground">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl p-8">
          No access groups created yet. Click "New Access Group" above to create your first distribution group.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const memberCount = group.agent_ids?.length ?? group.member_count ?? 0;
            return (
              <div
                key={group.id}
                className="rounded-2xl border border-border bg-surface-1 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-accent/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground">{group.name}</h4>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-muted-foreground border border-border/60">
                      <Users className="h-2.5 w-2.5 text-accent" /> {memberCount} {memberCount === 1 ? "Agent" : "Agents"}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[32px]">
                    {group.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenMembers(group)}
                    className="text-xs border-border hover:bg-surface-2 h-8 flex-1 cursor-pointer font-medium"
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1 text-gold" /> Manage Members
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(group)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Edit Group"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400 cursor-pointer"
                      title="Delete Group"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Group Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md bg-surface-1 border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingGroup ? "Edit Access Group" : "Create New Access Group"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveGroup} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Group Name *</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Listing Specialists or New Onboarding"
                className="bg-surface-2 border-border text-xs"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Description (Optional)</Label>
              <Input
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Describe which team members belong in this group..."
                className="bg-surface-2 border-border text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingGroup}
                size="sm"
                className="text-xs bg-gold text-navy hover:bg-gold/90 font-bold"
              >
                {isSavingGroup ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Member Management Modal */}
      <Dialog open={memberModalOpen} onOpenChange={setMemberModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] h-[80vh] max-h-[80vh] p-0 flex flex-col bg-surface-1 border border-border shadow-2xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/60 shrink-0">
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Assign Agents to {activeGroupForMembers?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Select agent accounts belonging to this group. Changes affect playbook access and compliance reports.
              </p>
            </div>
            <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25">
              {selectedAgentIds.length} Selected
            </div>
          </div>

          {/* Search & Bulk Actions */}
          <div className="p-4 border-b border-border bg-surface-2/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Filter agents by name, email, office..."
                className="pl-9 h-9 text-xs bg-surface-1 border-border"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAllFiltered(filteredAgents)}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                Select Filtered ({filteredAgents.length})
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                className="text-xs h-8 text-muted-foreground hover:text-rose-400"
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Agent Accounts List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {isLoadingAgents ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-accent mx-auto" />
                <p className="text-xs text-muted-foreground">Loading agent accounts...</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No matching agents found.
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent/10 border-accent/70 text-foreground"
                        : "bg-surface-2/40 border-border/70 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-accent border-accent text-white"
                            : "border-border bg-surface-1"
                        }`}
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : null}
                      </div>

                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {agent.full_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {agent.email} {agent.office_location ? `• ${agent.office_location}` : ""}
                        </span>
                      </div>
                    </div>

                    {agent.phone ? (
                      <span className="text-[11px] text-muted-foreground hidden sm:block">
                        {agent.phone}
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Save */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-surface-2/60 shrink-0">
            <span className="text-xs text-muted-foreground">
              {selectedAgentIds.length} of {allAgents.length} total agent accounts assigned
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMemberModalOpen(false)}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveMembers}
                disabled={isSavingMembers}
                className="text-xs bg-gold text-navy hover:bg-gold/90 font-bold"
              >
                {isSavingMembers ? "Saving..." : "Save Member Roster"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
