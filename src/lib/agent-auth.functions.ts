import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SyncAgentSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
});

export interface AgentSyncResponse {
  token: string;
  account: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    office_location: string | null;
    office_phone: string | null;
    created_at: string;
  };
}

/**
 * Ensures an agent account exists in public.seller_proceeds_accounts
 * and issues a valid 30-day session token in public.seller_sessions.
 * This bridges Google OAuth or Supabase Auth directly into Agent Tools
 * without requiring any admin approval.
 */
export const syncAgentSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => SyncAgentSchema.parse(data))
  .handler(async ({ data }): Promise<AgentSyncResponse> => {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!cleanEmail.endsWith("@mattsmithrealestategroup.com")) {
      throw new Error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    let { data: acc } = await sb
      .from("seller_proceeds_accounts")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (!acc) {
      const derivedName =
        data.fullName?.trim() ||
        cleanEmail
          .split("@")[0]
          .split(".")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

      const { data: newAcc, error: createErr } = await sb
        .from("seller_proceeds_accounts")
        .insert({
          email: cleanEmail,
          full_name: derivedName || "MSREG Agent",
          phone: data.phone?.trim() || null,
          password_hash: "$2a$06$googleOAuthPlaceholderPasswordHashNotUsedDirectly",
        })
        .select()
        .single();

      if (createErr) {
        console.error("[syncAgentSessionFn] Error creating seller_proceeds_account:", createErr);
        throw new Error(createErr.message || "Failed to create agent account");
      }
      acc = newAcc;
    }

    // Create a 30-day session token
    const { data: sess, error: sessErr } = await sb
      .from("seller_sessions")
      .insert({ account_id: acc.id })
      .select()
      .single();

    if (sessErr) {
      console.error("[syncAgentSessionFn] Error creating seller_session:", sessErr);
      throw new Error(sessErr.message || "Failed to create agent session");
    }

    return {
      token: sess.token,
      account: {
        id: acc.id,
        email: acc.email,
        full_name: acc.full_name,
        phone: acc.phone,
        office_location: acc.office_location,
        office_phone: acc.office_phone,
        created_at: acc.created_at,
      },
    };
  });
