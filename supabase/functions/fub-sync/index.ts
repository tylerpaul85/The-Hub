// ==============================================================================
// SUPABASE EDGE FUNCTION: fub-sync
// Scheduled Nightly / Webhook-triggered incremental sync from Follow Up Boss
// ==============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const FUB_BASE_URL = "https://api.followupboss.com/v1";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const fubApiKey = Deno.env.get("FUB_API_KEY") || Deno.env.get("FUB") || "";
  const fubSystemKey = Deno.env.get("FUB_SYSTEM_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase service environment variables" }),
      { status: 500, headers: corsHeaders },
    );
  }

  if (!fubApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing FUB_API_KEY environment secret" }),
      { status: 500, headers: corsHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate request (must either be Supabase cron secret or admin user JWT)
  const authHeader = req.headers.get("Authorization");
  let triggeredByUserId: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        triggeredByUserId = user.id;
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Admin role required" }),
            { status: 403, headers: corsHeaders },
          );
        }
      }
    }
  }

  // Helper for FUB Fetch
  async function fubFetch(endpoint: string, retries = 2): Promise<Response> {
    const url = endpoint.startsWith("http") ? endpoint : `${FUB_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Basic ${btoa(`${fubApiKey}:`)}`,
      Accept: "application/json",
      "X-System": "MSREG-Agent-Audit-Edge",
    };
    if (fubSystemKey) headers["X-System-Key"] = fubSystemKey;

    const res = await fetch(url, { headers });
    if (res.status === 429 && retries > 0) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 2;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 500));
      return fubFetch(endpoint, retries - 1);
    }
    return res;
  }

  // Create log
  const { data: logRow, error: logErr } = await supabase
    .from("fub_sync_logs")
    .insert({
      sync_type: "incremental",
      status: "running",
      triggered_by: triggeredByUserId,
    })
    .select("id")
    .single();

  if (logErr) {
    return new Response(
      JSON.stringify({ error: "Failed to initialize sync log", details: logErr }),
      { status: 500, headers: corsHeaders },
    );
  }

  const logId = logRow.id;
  const counts: Record<string, number> = {
    agents: 0,
    leads: 0,
    notes: 0,
    calls: 0,
  };

  try {
    // 1. Sync Users
    const uRes = await fubFetch("/users?limit=100");
    if (uRes.ok) {
      const uData = await uRes.json();
      const users = uData?.users ?? [];
      if (users.length > 0) {
        const rows = users.map((u: any) => ({
          fub_id: u.id,
          name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ").trim(),
          first_name: u.firstName || null,
          last_name: u.lastName || null,
          email: u.email || null,
          role: u.role || null,
          is_active: u.status === "active" || u.isActive !== false,
          raw_data: u,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from("fub_agents").upsert(rows, { onConflict: "fub_id" });
        counts.agents = rows.length;
      }
    }

    // 2. Sync Recent Leads (people updated in last 48 hours)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const pRes = await fubFetch(`/people?limit=100&sort=-updated&updatedAfter=${encodeURIComponent(twoDaysAgo)}`);
    if (pRes.ok) {
      const pData = await pRes.json();
      const people = pData?.people ?? [];
      if (people.length > 0) {
        const rows = people.map((p: any) => ({
          fub_id: p.id,
          name: p.name || [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unnamed",
          first_name: p.firstName || null,
          last_name: p.lastName || null,
          stage: p.stage || null,
          source: p.source || null,
          assigned_user_fub_id: p.assignedUserId || null,
          assigned_user_name: p.assignedTo || null,
          price: p.price ? Number(p.price) : null,
          contacted: Boolean(p.contacted),
          tags: Array.isArray(p.tags) ? p.tags : [],
          fub_created_at: p.created || null,
          fub_updated_at: p.updated || null,
          last_activity: p.lastActivity || null,
          last_communication: p.lastCommunication || null,
          last_sent_email: p.lastSentEmail || null,
          last_sent_text: p.lastSentText || null,
          last_outgoing_call: p.lastOutgoingCall || null,
          raw_data: p,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from("fub_leads").upsert(rows, { onConflict: "fub_id" });
        counts.leads = rows.length;
      }
    }

    // 3. Scan & refresh SQL integrity flags
    await supabase.rpc("fn_audit_generate_integrity_flags");

    // Complete log
    await supabase
      .from("fub_sync_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_synced: counts,
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({ ok: true, syncLogId: logId, counts }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    await supabase
      .from("fub_sync_logs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: err.message || String(err),
        records_synced: counts,
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
