import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Mail, Clock, CheckCircle2, XCircle, UserCheck } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { inviteUser, removeUser as removeUserFn } from "@/lib/user-admin.functions";

type AppRole =
  | "admin"
  | "marketing_coordinator"
  | "video_editor"
  | "videographer"
  | "contributor"
  | "client_care";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "marketing_coordinator", label: "Marketing Coordinator" },
  { value: "video_editor", label: "Video Editor" },
  { value: "videographer", label: "Videographer" },
  { value: "client_care", label: "Client Care" },
  { value: "contributor", label: "Contributor" },
];

const ROLE_PRIORITY: AppRole[] = [
  "admin",
  "marketing_coordinator",
  "video_editor",
  "videographer",
  "client_care",
  "contributor",
];

function pickRole(roles: AppRole[]): AppRole {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return "contributor";
}

function roleLabel(role: AppRole): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

interface PendingUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

function PendingUserRow({
  u,
  onApprove,
  onRemove,
  isPending,
}: {
  u: PendingUser;
  onApprove: (userId: string, role: AppRole) => void;
  onRemove: (userId: string) => void;
  isPending: boolean;
}) {
  const [approveRole, setApproveRole] = useState<AppRole>("contributor");
  return (
    <div className="p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[220px]">
        <div className="font-medium text-sm">
          {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
        </div>
        <div className="text-xs text-muted-foreground">{u.email}</div>
        <div className="text-xs text-muted-foreground">
          Signed up {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
        </div>
      </div>
      <Select value={approveRole} onValueChange={(v) => setApproveRole(v as AppRole)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={() => onApprove(u.id, approveRole)}
        disabled={isPending}
        className="bg-gold text-gold-foreground hover:bg-gold/90"
      >
        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (confirm(`Reject and remove ${u.email}?`)) onRemove(u.id);
        }}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface UserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  last_active_at: string | null;
  roles: AppRole[];
}

function formatLastActive(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const time = format(d, "h:mm a");
  if (d >= startOfToday) return `Today at ${time}`;
  if (d >= startOfYesterday) return `Yesterday at ${time}`;
  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / 86400000) + 1;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  return format(d, "MMM d, yyyy");
}

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Users — MSREG Hub" }] }),
});

function UsersPage() {
  const { isAdmin, loading, user: me } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("contributor");
  const [inviting, setInviting] = useState(false);

  // --- Pending invites ---
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["pending-invites"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_invites")
        .select("id, email, role, invited_by, created_at, expires_at, redeemed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        email: string;
        role: AppRole;
        invited_by: string | null;
        created_at: string;
        expires_at: string;
        redeemed_at: string | null;
      }>;
    },
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pending_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite revoked");
      qc.invalidateQueries({ queryKey: ["pending-invites"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Pending-approval users ---
  const { data: pendingUsers = [] } = useQuery({
    queryKey: ["pending-approval-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, email, first_name, last_name, created_at")
        .eq("pending_approval", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        created_at: string;
      }>;
    },
  });

  const approveUser = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Clear pending flag
      const { error: profErr } = await (supabase as any)
        .from("profiles")
        .update({ pending_approval: false })
        .eq("id", userId);
      if (profErr) throw profErr;
      // Ensure correct role is set (remove old, insert new)
      await (supabase as any).from("user_roles").delete().eq("user_id", userId);
      const { error: roleErr } = await (supabase as any)
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (roleErr) throw roleErr;
    },
    onSuccess: () => {
      toast.success("User approved");
      qc.invalidateQueries({ queryKey: ["pending-approval-users"] });
      qc.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["users-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id, email, first_name, last_name, created_at, last_active_at")
          .order("created_at", { ascending: false }),
        (supabase as any).from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? [])
        .map((p: any) => ({
          id: p.id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          created_at: p.created_at,
          last_active_at: p.last_active_at ?? null,
          roles: rolesByUser.get(p.id) ?? [],
        }))
        .filter((p: UserRow) => p.roles.length > 0) as UserRow[];
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Remove all existing roles, then add the chosen one
      const { error: delErr } = await (supabase as any)
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await (supabase as any)
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeFn = useServerFn(removeUserFn);
  const inviteFn = useServerFn(inviteUser);

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      await removeFn({ data: { userId } });
    },
    onSuccess: () => {
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove user"),
  });

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return;
    setInviting(true);
    try {
      // Create a pending_invite record so Google sign-in gets the right role
      await (supabase as any).from("pending_invites").upsert(
        { email: email.trim().toLowerCase(), role: inviteRole, invited_by: me?.id },
        { onConflict: "email" },
      );
      // Also send the Supabase email invite (email/password flow)
      await inviteFn({
        data: {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: inviteRole,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      toast.success(`Invitation emailed to ${email}. They'll set a password or sign in with Google.`, {
        duration: 6000,
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      setInviteRole("contributor");
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["pending-invites"] });
    } catch (err: any) {
      toast.error(err.message ?? "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage who can access MSREG Content Hub.</p>
      </header>

      <section className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-gold" /> Invite a user
        </h2>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
          <div className="w-40">
            <Label htmlFor="invite-first">First name</Label>
            <Input
              id="invite-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="mt-1.5"
              autoComplete="given-name"
            />
          </div>
          <div className="w-40">
            <Label htmlFor="invite-last">Last name</Label>
            <Input
              id="invite-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="mt-1.5"
              autoComplete="family-name"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>
          <div className="w-44">
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={inviting}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {inviting ? "Sending..." : "Send invite"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          Invitees receive a confirmation email. After they confirm and sign in for the first time
          (via email/password or Google), their role will be automatically assigned.
        </p>
      </section>

      {/* ── Pending Invites ── */}
      {pendingInvites.length > 0 && (
        <section className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-gold" />
            <h2 className="font-semibold">Pending Invites ({pendingInvites.filter(i => !i.redeemed_at && !isPast(new Date(i.expires_at))).length})</h2>
          </div>
          <div className="divide-y divide-border">
            {pendingInvites.map((inv) => {
              const expired = isPast(new Date(inv.expires_at));
              const redeemed = !!inv.redeemed_at;
              return (
                <div key={inv.id} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-medium text-sm">{inv.email}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      Role: {roleLabel(inv.role)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {redeemed ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Redeemed {format(new Date(inv.redeemed_at!), "MMM d")}
                      </span>
                    ) : expired ? (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> Expired
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {!redeemed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Revoke invite for ${inv.email}?`)) revokeInvite.mutate(inv.id);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Pending Approval Users ── */}
      {pendingUsers.length > 0 && (
        <section className="bg-card border border-amber-500/30 rounded-xl overflow-hidden mb-6">
          <div className="p-5 border-b border-amber-500/30 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-amber-300">Awaiting Approval ({pendingUsers.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {pendingUsers.map((u) => (
              <PendingUserRow
                key={u.id}
                u={u}
                onApprove={(userId, role) => approveUser.mutate({ userId, role })}
                onRemove={(userId) => removeUser.mutate(userId)}
                isPending={approveUser.isPending}
              />
            ))}
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">All Users ({rows.length})</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading users...</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((u) => {
              const currentRole: AppRole = pickRole(u.roles);
              const isSelf = u.id === me?.id;
              return (
                <div key={u.id} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-medium text-sm">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                      {isSelf && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="min-w-[180px]">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Last active
                    </div>
                    <div
                      className={`text-sm ${u.last_active_at ? "text-foreground" : "text-muted-foreground italic"}`}
                    >
                      {formatLastActive(u.last_active_at)}
                    </div>
                  </div>
                  <div className="min-w-[160px]">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Role
                    </div>
                    <div className="text-sm">{roleLabel(currentRole)}</div>
                  </div>
                  <div className="min-w-[140px]">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Created
                    </div>
                    <div className="text-sm">{format(new Date(u.created_at), "MMM d, yyyy")}</div>
                  </div>
                  <Select
                    value={currentRole}
                    onValueChange={(v) => changeRole.mutate({ userId: u.id, role: v as AppRole })}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSelf}
                    onClick={() => {
                      if (confirm(`Revoke access for ${u.email}?`)) removeUser.mutate(u.id);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
