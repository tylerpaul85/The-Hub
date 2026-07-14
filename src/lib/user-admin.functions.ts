import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Forced build trigger to synchronize server function mapping IDs on Netlify after build regrouping

const InviteSchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "marketing_coordinator", "video_editor", "videographer", "contributor", "client_care"]),
  redirectTo: z.string().url().max(500),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: { first_name: data.firstName, last_name: data.lastName },
    });
    if (error && !/already/i.test(error.message)) throw new Error(error.message);

    const userId = invited?.user?.id;
    if (userId) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
      await supabaseAdmin
        .from("profiles")
        .update({ first_name: data.firstName, last_name: data.lastName })
        .eq("id", userId);
    }
    return { ok: true };
  });

const RemoveSchema = z.object({ userId: z.string().uuid() });

export const removeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RemoveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    if (data.userId === context.userId) throw new Error("You cannot remove yourself.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Null out audit-log references first so nothing blocks the cascade.
    await supabaseAdmin.from("security_audit_log").update({ actor_user_id: null }).eq("actor_user_id", data.userId);
    await supabaseAdmin.from("security_audit_log").update({ target_user_id: null }).eq("target_user_id", data.userId);

    // Remove app-level rows that don't have a FK to auth.users (won't cascade).
    await supabaseAdmin.from("notifications").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("content_comments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("video_comments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("content_history").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("l10_meeting_ratings").delete().eq("user_id", data.userId);

    // Pre-delete profile + roles so a stale row can't block the auth delete.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    // Hard delete the auth user.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId, false);
    if (error && !/not found|does not exist/i.test(error.message)) {
      throw new Error(`Auth delete failed: ${error.message}`);
    }

    return { ok: true };
  });
