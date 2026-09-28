// ==============================================================================
// AGENT AUDIT SERVER FUNCTIONS
// TanStack Start server functions for FUB sync, deterministic metrics,
// Claude evaluation, human review queue, rubric management, and email dispatch.
// ==============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_AUDIT_MODEL,
  DEFAULT_MONTHLY_SAMPLE_SIZE,
  ANONYMIZED_AGENT_LABEL,
  isExcludedAgent,
  getFubLeadUrl,
} from "./config";
import {
  fetchFubUsers,
  fetchFubLeads,
  fetchFubNotes,
  fetchFubCalls,
  fetchFubTextMessages,
  fetchFubEmails,
  fetchFubTasks,
  fetchFubAppointments,
  fetchFubDeals,
  buildSanitizedLeadTimeline,
} from "./fub-client";
import {
  gradeLeadDirectly,
  createClaudeBatch,
  getClaudeBatchStatus,
  getClaudeBatchResults,
  buildLeadGraderSystemPrompt,
  LEAD_GRADER_TOOL,
} from "./claude-batch";
import type {
  AuditRubricCriterion,
  TimelineActivity,
} from "./types";

/**
 * Asserts the calling user has the admin role.
 */
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(`Role verification error: ${error.message}`);
  const isAdmin = (data ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) {
    throw new Error("Forbidden: Administrator access is required for Agent Audit.");
  }
}

// ------------------------------------------------------------------------------
// 1. Data Sync Functions & Upsert Helpers
// ------------------------------------------------------------------------------

function parseTimestamptz(val: any): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "0000-00-00" || trimmed.startsWith("0000-00-00")) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseTags(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((t) => (typeof t === "string" ? t : (t?.name || String(t)))).filter(Boolean);
  }
  if (typeof val === "string") {
    return val.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

function parseNumeric(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : Number(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? null : num;
}

function parseBigInt(val: any): number | null {
  if (!val) return null;
  const n = Number(val);
  return isNaN(n) || n === 0 ? null : n;
}

async function upsertAgents(sb: any, users: any[]) {
  if (!users?.length) return 0;
  const agentRows = users.map((u: any) => ({
    fub_id: parseBigInt(u.id),
    name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ").trim(),
    first_name: u.firstName || null,
    last_name: u.lastName || null,
    email: u.email || null,
    role: u.role || null,
    is_active: u.status === "active" || u.isActive !== false,
    raw_data: u,
    updated_at: new Date().toISOString(),
  })).filter((r: any) => r.fub_id);
  const { error } = await sb.from("fub_agents").upsert(agentRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertAgents] Error:", error);
  return agentRows.length;
}

async function upsertLeads(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const leadRows = items.map((p: any) => ({
    fub_id: parseBigInt(p.id),
    name: p.name || [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unnamed",
    first_name: p.firstName || null,
    last_name: p.lastName || null,
    stage: p.stage || null,
    source: p.source || null,
    assigned_user_fub_id: parseBigInt(p.assignedUserId),
    assigned_user_name: p.assignedTo || null,
    price: parseNumeric(p.price),
    contacted: Boolean(p.contacted),
    tags: parseTags(p.tags),
    fub_created_at: parseTimestamptz(p.created),
    fub_updated_at: parseTimestamptz(p.updated),
    last_activity: parseTimestamptz(p.lastActivity),
    last_communication: parseTimestamptz(p.lastCommunication),
    last_sent_email: parseTimestamptz(p.lastSentEmail),
    last_sent_text: parseTimestamptz(p.lastSentText),
    last_outgoing_call: parseTimestamptz(p.lastOutgoingCall),
    raw_data: p,
    updated_at: new Date().toISOString(),
  })).filter((r: any) => r.fub_id);
  const { error } = await sb.from("fub_leads").upsert(leadRows, { onConflict: "fub_id" });
  if (error) {
    console.error("[upsertLeads] Error:", error);
    throw new Error(`Failed to save leads: ${error.message}`);
  }
  return leadRows.length;
}

async function upsertNotes(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const noteRows = items.map((n: any) => ({
    fub_id: parseBigInt(n.id),
    person_fub_id: parseBigInt(n.personId),
    user_fub_id: parseBigInt(n.userId),
    user_name: n.user?.name || null,
    subject: n.subject || null,
    body: n.body || "",
    fub_created_at: parseTimestamptz(n.created),
    fub_updated_at: parseTimestamptz(n.updated),
    raw_data: n,
  })).filter((r: any) => r.fub_id && r.person_fub_id);
  const { error } = await sb.from("fub_notes").upsert(noteRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertNotes] Error:", error);
  return noteRows.length;
}

async function upsertCalls(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const callRows = items.map((c: any) => ({
    fub_id: parseBigInt(c.id),
    person_fub_id: parseBigInt(c.personId),
    user_fub_id: parseBigInt(c.userId),
    user_name: c.user?.name || null,
    duration: Number(c.duration) || 0,
    outcome: c.outcome || null,
    direction: c.direction || null,
    note: c.note || null,
    fub_created_at: parseTimestamptz(c.created),
    raw_data: c,
  })).filter((r: any) => r.fub_id);
  const { error } = await sb.from("fub_calls").upsert(callRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertCalls] Error:", error);
  return callRows.length;
}

async function upsertTexts(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const textRows = items.map((t: any) => ({
    fub_id: parseBigInt(t.id),
    person_fub_id: parseBigInt(t.personId),
    user_fub_id: parseBigInt(t.userId),
    user_name: t.user?.name || null,
    direction: t.direction || null,
    body: t.body || "",
    fub_created_at: parseTimestamptz(t.created),
    raw_data: t,
  })).filter((r: any) => r.fub_id && r.person_fub_id);
  const { error } = await sb.from("fub_text_messages").upsert(textRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertTexts] Error:", error);
  return textRows.length;
}

async function upsertEmails(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const emailRows = items.map((e: any) => ({
    fub_id: parseBigInt(e.id),
    person_fub_id: parseBigInt(e.personId),
    user_fub_id: parseBigInt(e.userId),
    user_name: e.user?.name || null,
    direction: e.direction || null,
    subject: e.subject || null,
    body: e.body || "",
    fub_created_at: parseTimestamptz(e.created),
    raw_data: e,
  })).filter((r: any) => r.fub_id && r.person_fub_id);
  const { error } = await sb.from("fub_emails").upsert(emailRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertEmails] Error:", error);
  return emailRows.length;
}

async function upsertTasks(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const taskRows = items.map((tk: any) => ({
    fub_id: parseBigInt(tk.id),
    person_fub_id: parseBigInt(tk.personId),
    assigned_user_fub_id: parseBigInt(tk.assignedUserId),
    assigned_user_name: tk.assignedTo || null,
    name: tk.name || "Task",
    type: tk.type || null,
    due_date: tk.dueDate || null,
    is_completed: tk.status === "completed" || Boolean(tk.completedAt),
    completed_at: parseTimestamptz(tk.completedAt),
    fub_created_at: parseTimestamptz(tk.created),
    fub_updated_at: parseTimestamptz(tk.updated),
    raw_data: tk,
  })).filter((r: any) => r.fub_id && r.person_fub_id);
  const { error } = await sb.from("fub_tasks").upsert(taskRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertTasks] Error:", error);
  return taskRows.length;
}

async function upsertAppointments(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const apptRows = items.map((a: any) => ({
    fub_id: parseBigInt(a.id),
    person_fub_id: parseBigInt(a.personId),
    user_fub_id: parseBigInt(a.userId),
    user_name: a.user?.name || null,
    title: a.title || null,
    description: a.description || null,
    location: a.location || null,
    start_time: parseTimestamptz(a.start || a.startTime),
    end_time: parseTimestamptz(a.end || a.endTime),
    outcome: a.outcome || null,
    fub_created_at: parseTimestamptz(a.created),
    fub_updated_at: parseTimestamptz(a.updated),
    raw_data: a,
  })).filter((r: any) => r.fub_id);
  const { error } = await sb.from("fub_appointments").upsert(apptRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertAppointments] Error:", error);
  return apptRows.length;
}

async function upsertDeals(sb: any, items: any[]) {
  if (!items?.length) return 0;
  const dealRows = items.map((d: any) => ({
    fub_id: parseBigInt(d.id),
    person_fub_id: parseBigInt(d.personId),
    user_fub_id: parseBigInt(d.userId),
    user_name: d.user?.name || null,
    pipeline_id: parseBigInt(d.pipelineId),
    pipeline_name: d.pipeline?.name || null,
    stage_id: parseBigInt(d.stageId),
    stage_name: d.stage?.name || null,
    name: d.name || null,
    price: parseNumeric(d.price),
    fub_created_at: parseTimestamptz(d.created),
    fub_updated_at: parseTimestamptz(d.updated),
    raw_data: d,
  })).filter((r: any) => r.fub_id);
  const { error } = await sb.from("fub_deals").upsert(dealRows, { onConflict: "fub_id" });
  if (error) console.error("[upsertDeals] Error:", error);
  return dealRows.length;
}

export const triggerFubSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullSync: z.boolean().default(false),
        step: z
          .enum([
            "quick",
            "agents_leads",
            "comms",
            "tasks_pipeline",
            "scan_flags",
          ])
          .default("quick"),
      })
      .parse(input || {}),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Start sync log
    const { data: logRow, error: logErr } = await sb
      .from("fub_sync_logs")
      .insert({
        sync_type: input.step === "quick" ? (input.fullSync ? "full" : "quick") : input.step,
        status: "running",
        triggered_by: context.userId,
      })
      .select("id")
      .single();

    if (logErr) throw new Error(`Failed to create sync log: ${logErr.message}`);
    const syncLogId = logRow.id;

    const counts: Record<string, number> = {
      agents: 0,
      leads: 0,
      notes: 0,
      calls: 0,
      texts: 0,
      emails: 0,
      tasks: 0,
      appointments: 0,
      deals: 0,
    };

    try {
      // Find latest sync timestamp if incremental
      let updatedAfter: string | undefined;
      if (!input.fullSync) {
        const { data: latestLead } = await sb
          .from("fub_leads")
          .select("fub_updated_at")
          .order("fub_updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestLead?.fub_updated_at) {
          // Sync changes since latest record with a 4-hour buffer for clock skew
          const d = new Date(latestLead.fub_updated_at);
          d.setHours(d.getHours() - 4);
          updatedAfter = d.toISOString();
        }
      }

      if (input.step === "quick") {
        // Fast parallel fetch across core entities (1 page each = up to 100 recent items)
        // All network requests run concurrently within 2-3 seconds
        const [usersRes, leadsRes, callsRes, notesRes, tasksRes] = await Promise.allSettled([
          fetchFubUsers(),
          fetchFubLeads(updatedAfter, 1),
          fetchFubCalls(updatedAfter, 1),
          fetchFubNotes(updatedAfter, 1),
          fetchFubTasks(updatedAfter, 1),
        ]);

        if (usersRes.status === "fulfilled" && usersRes.value?.length) {
          counts.agents = await upsertAgents(sb, usersRes.value);
        }
        if (leadsRes.status === "fulfilled" && leadsRes.value?.items?.length) {
          counts.leads = await upsertLeads(sb, leadsRes.value.items);
        }
        if (callsRes.status === "fulfilled" && callsRes.value?.items?.length) {
          counts.calls = await upsertCalls(sb, callsRes.value.items);
        }
        if (notesRes.status === "fulfilled" && notesRes.value?.items?.length) {
          counts.notes = await upsertNotes(sb, notesRes.value.items);
        }
        if (tasksRes.status === "fulfilled" && tasksRes.value?.items?.length) {
          counts.tasks = await upsertTasks(sb, tasksRes.value.items);
        }

        // Run deterministic integrity scan
        await sb.rpc("fn_audit_generate_integrity_flags");

      } else if (input.step === "agents_leads") {
        const pages = input.fullSync ? 4 : 2;
        const [usersRes, leadsRes] = await Promise.allSettled([
          fetchFubUsers(),
          fetchFubLeads(updatedAfter, pages),
        ]);
        if (usersRes.status === "fulfilled" && usersRes.value?.length) {
          counts.agents = await upsertAgents(sb, usersRes.value);
        }
        if (leadsRes.status === "fulfilled" && leadsRes.value?.items?.length) {
          counts.leads = await upsertLeads(sb, leadsRes.value.items);
        }

      } else if (input.step === "comms") {
        const pages = input.fullSync ? 3 : 2;
        const [callsRes, notesRes, textsRes, emailsRes] = await Promise.allSettled([
          fetchFubCalls(updatedAfter, pages),
          fetchFubNotes(updatedAfter, pages),
          fetchFubTextMessages(updatedAfter, pages),
          fetchFubEmails(updatedAfter, pages),
        ]);
        if (callsRes.status === "fulfilled" && callsRes.value?.items?.length) {
          counts.calls = await upsertCalls(sb, callsRes.value.items);
        }
        if (notesRes.status === "fulfilled" && notesRes.value?.items?.length) {
          counts.notes = await upsertNotes(sb, notesRes.value.items);
        }
        if (textsRes.status === "fulfilled" && textsRes.value?.items?.length) {
          counts.texts = await upsertTexts(sb, textsRes.value.items);
        }
        if (emailsRes.status === "fulfilled" && emailsRes.value?.items?.length) {
          counts.emails = await upsertEmails(sb, emailsRes.value.items);
        }

      } else if (input.step === "tasks_pipeline") {
        const pages = input.fullSync ? 3 : 2;
        const [tasksRes, apptsRes, dealsRes] = await Promise.allSettled([
          fetchFubTasks(updatedAfter, pages),
          fetchFubAppointments(updatedAfter, pages),
          fetchFubDeals(updatedAfter, pages),
        ]);
        if (tasksRes.status === "fulfilled" && tasksRes.value?.items?.length) {
          counts.tasks = await upsertTasks(sb, tasksRes.value.items);
        }
        if (apptsRes.status === "fulfilled" && apptsRes.value?.items?.length) {
          counts.appointments = await upsertAppointments(sb, apptsRes.value.items);
        }
        if (dealsRes.status === "fulfilled" && dealsRes.value?.items?.length) {
          counts.deals = await upsertDeals(sb, dealsRes.value.items);
        }

      } else if (input.step === "scan_flags") {
        await sb.rpc("fn_audit_generate_integrity_flags");
      }

      // Mark log completed
      await sb
        .from("fub_sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_synced: counts,
        })
        .eq("id", syncLogId);

      return { ok: true, syncLogId, counts, step: input.step };
    } catch (err: any) {
      console.error("[triggerFubSync] Sync error:", err);
      await sb
        .from("fub_sync_logs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: err.message || String(err),
          records_synced: counts,
        })
        .eq("id", syncLogId);
      throw err;
    }
  });

export const getSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("fub_sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ------------------------------------------------------------------------------
// 2. Overview & Agent Details (SQL Only)
// ------------------------------------------------------------------------------

export const getAgentAuditOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    // SQL computed view metrics
    const { data: metrics, error: mErr } = await context.supabase
      .from("view_audit_agent_monthly_metrics")
      .select("*")
      .order("avg_rubric_score", { ascending: false });

    if (mErr) throw new Error(mErr.message);

    // Latest audit reports / audit dates
    const { data: reports } = await context.supabase
      .from("audit_reports")
      .select("agent_fub_id, audit_month, average_quality_score, finalized_at")
      .order("created_at", { ascending: false });

    const reportMap = new Map<number, any>();
    for (const r of reports ?? []) {
      if (r.agent_fub_id && !reportMap.has(r.agent_fub_id)) {
        reportMap.set(r.agent_fub_id, r);
      }
    }

    return (metrics ?? [])
      .filter((m: any) => !isExcludedAgent(m.agent_name))
      .map((m: any) => ({
        ...m,
        last_audit: reportMap.get(m.agent_fub_id) || null,
      }));
  });

export const getAgentAuditDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ agentFubId: z.number() }).parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // 1. Agent record
    const { data: agent, error: aErr } = await context.supabase
      .from("fub_agents")
      .select("*")
      .eq("fub_id", input.agentFubId)
      .single();
    if (aErr) throw new Error(aErr.message);

    // 2. Open & historical integrity flags
    const { data: flags, error: fErr } = await context.supabase
      .from("audit_integrity_flags")
      .select("*")
      .eq("agent_fub_id", input.agentFubId)
      .order("created_at", { ascending: false });
    if (fErr) throw new Error(fErr.message);

    // Enrich flags with deep links
    const enrichedFlags = (flags ?? []).map((f: any) => ({
      ...f,
      lead_url: f.lead_fub_id ? getFubLeadUrl(f.lead_fub_id) : null,
    }));

    // 3. Sampled leads & Claude grades
    const { data: sampledLeads, error: slErr } = await context.supabase
      .from("audit_sampled_leads")
      .select("*, grades:audit_lead_grades(*), compliance_flags:audit_compliance_flags(*)")
      .eq("agent_fub_id", input.agentFubId)
      .order("sampled_at", { ascending: false });
    if (slErr) throw new Error(slErr.message);

    const enrichedSampledLeads = (sampledLeads ?? []).map((sl: any) => ({
      ...sl,
      lead_url: getFubLeadUrl(sl.person_fub_id),
    }));

    // 4. Compliance flags
    const { data: complianceFlags } = await context.supabase
      .from("audit_compliance_flags")
      .select("*")
      .eq("agent_fub_id", input.agentFubId)
      .order("created_at", { ascending: false });

    // 5. Reports
    const { data: reports } = await context.supabase
      .from("audit_reports")
      .select("*")
      .eq("agent_fub_id", input.agentFubId)
      .order("created_at", { ascending: false });

    return {
      agent,
      flags: enrichedFlags,
      sampledLeads: enrichedSampledLeads,
      complianceFlags: complianceFlags ?? [],
      reports: reports ?? [],
    };
  });

// ------------------------------------------------------------------------------
// 3. Review Queue Actions (Agree / Disagree / Note overrides)
// ------------------------------------------------------------------------------

export const reviewIntegrityFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        flagId: z.string().uuid(),
        status: z.enum(["confirmed", "dismissed", "needs_human_review"]),
        humanOverrideStatus: z.enum(["agreed", "disagreed"]),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("audit_integrity_flags")
      .update({
        status: input.status,
        human_override_status: input.humanOverrideStatus,
        human_override_notes: input.notes || null,
        human_override_by: context.userId,
        human_override_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.flagId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewLeadGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        gradeId: z.string().uuid(),
        humanOverrideScore: z.number().min(1).max(5).nullable(),
        humanOverrideStatus: z.enum(["agreed", "disagreed"]),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("audit_lead_grades")
      .update({
        human_override_score: input.humanOverrideScore,
        human_override_status: input.humanOverrideStatus,
        human_override_notes: input.notes || null,
        human_override_by: context.userId,
        human_override_at: new Date().toISOString(),
      })
      .eq("id", input.gradeId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewComplianceFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        flagId: z.string().uuid(),
        status: z.enum(["confirmed", "dismissed"]),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("audit_compliance_flags")
      .update({
        human_review_status: input.status,
        human_notes: input.notes || null,
        human_reviewed_by: context.userId,
        human_reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.flagId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const scanIntegrityFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("fn_audit_generate_integrity_flags");
    if (error) throw new Error(error.message);
    return data;
  });

// ------------------------------------------------------------------------------
// 4. Rubric Criteria Editor
// ------------------------------------------------------------------------------

export const getRubricCriteria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_rubric_criteria")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as AuditRubricCriterion[];
  });

export const upsertRubricCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        key: z.string().min(2).max(64),
        name: z.string().min(2).max(128),
        category: z.string().default("Conversation Quality"),
        weight: z.number().min(0.1).max(5).default(1.0),
        anchor_1: z.string().min(5),
        anchor_3: z.string().min(5),
        anchor_5: z.string().min(5),
        description: z.string().optional(),
        examples: z.string().optional(),
        is_active: z.boolean().default(true),
        sort_order: z.number().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const payload = {
      key: input.key,
      name: input.name,
      category: input.category,
      weight: input.weight,
      anchor_1: input.anchor_1,
      anchor_3: input.anchor_3,
      anchor_5: input.anchor_5,
      description: input.description || null,
      examples: input.examples || null,
      is_active: input.is_active,
      sort_order: input.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await context.supabase
        .from("audit_rubric_criteria")
        .update(payload)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: input.id };
    } else {
      const { data, error } = await context.supabase
        .from("audit_rubric_criteria")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
  });

// ------------------------------------------------------------------------------
// 5. Claude Sampling & Grading Execution
// ------------------------------------------------------------------------------

export const runAgentGradingSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentFubId: z.number(),
        sampleSize: z.number().min(1).max(50).default(DEFAULT_MONTHLY_SAMPLE_SIZE),
        auditMonth: z.string().default(() => new Date().toISOString().slice(0, 7)),
        mode: z.enum(["direct", "batch"]).default("direct"),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // 1. Fetch Agent info
    const { data: agent } = await sb
      .from("fub_agents")
      .select("fub_id, name")
      .eq("fub_id", input.agentFubId)
      .single();
    if (!agent) throw new Error("Agent not found in database.");

    // 2. Fetch active rubric criteria
    const { data: criteriaRows } = await sb
      .from("audit_rubric_criteria")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    const criteria = (criteriaRows ?? []) as AuditRubricCriterion[];
    if (criteria.length === 0) {
      throw new Error("No active rubric criteria found. Please configure the rubric first.");
    }

    // 3. Sample leads assigned to this agent with recent activity
    let candidateLeads: any[] = [];
    const { data: primaryLeads } = await sb
      .from("fub_leads")
      .select("fub_id, name, stage, source, created_at")
      .eq("assigned_user_fub_id", input.agentFubId)
      .order("last_activity", { ascending: false })
      .limit(100);

    candidateLeads = primaryLeads ?? [];

    // Fallback: if no leads are directly assigned to this agent in fub_leads,
    // search for leads where this agent participated in conversations (calls, notes, tasks)
    if (candidateLeads.length === 0) {
      const [agentCalls, agentNotes, agentTasks] = await Promise.all([
        sb.from("fub_calls").select("person_fub_id").eq("user_fub_id", input.agentFubId).gt("person_fub_id", 0).limit(50),
        sb.from("fub_notes").select("person_fub_id").eq("user_fub_id", input.agentFubId).gt("person_fub_id", 0).limit(50),
        sb.from("fub_tasks").select("person_fub_id").eq("assigned_user_fub_id", input.agentFubId).gt("person_fub_id", 0).limit(50),
      ]);

      const activePersonIds = Array.from(
        new Set([
          ...(agentCalls.data || []).map((c: any) => c.person_fub_id),
          ...(agentNotes.data || []).map((n: any) => n.person_fub_id),
          ...(agentTasks.data || []).map((t: any) => t.person_fub_id),
        ]),
      ).filter(Boolean);

      if (activePersonIds.length > 0) {
        const { data: fallbackLeads } = await sb
          .from("fub_leads")
          .select("fub_id, name, stage, source, created_at")
          .in("fub_id", activePersonIds)
          .limit(100);
        candidateLeads = fallbackLeads ?? [];
      }
    }

    const candidates = candidateLeads;
    if (candidates.length === 0) {
      throw new Error(
        `No leads found assigned to or handled by ${agent.name} (ID: ${agent.fub_id}). Run "Quick Sync FUB" or choose an agent with active leads.`,
      );
    }

    // Shuffle and pick sampleSize leads
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const selectedLeads = shuffled.slice(0, input.sampleSize);

    const sampledLeadResults: any[] = [];

    // Process each lead
    for (const lead of selectedLeads) {
      // Gather activities for this lead
      const [calls, notes, texts, emails, tasks, appts, stages] = await Promise.all([
        sb.from("fub_calls").select("*").eq("person_fub_id", lead.fub_id),
        sb.from("fub_notes").select("*").eq("person_fub_id", lead.fub_id),
        sb.from("fub_text_messages").select("*").eq("person_fub_id", lead.fub_id),
        sb.from("fub_emails").select("*").eq("person_fub_id", lead.fub_id),
        sb.from("fub_tasks").select("*").eq("person_fub_id", lead.fub_id),
        sb.from("fub_appointments").select("*").eq("person_fub_id", lead.fub_id),
        sb.from("fub_stage_history").select("*").eq("person_fub_id", lead.fub_id),
      ]);

      const timeline = buildSanitizedLeadTimeline({
        calls: calls.data ?? [],
        notes: notes.data ?? [],
        texts: texts.data ?? [],
        emails: emails.data ?? [],
        tasks: tasks.data ?? [],
        appointments: appts.data ?? [],
        stageHistory: stages.data ?? [],
        agentName: agent.name,
      });

      // Insert sampled lead record
      const { data: sampledRow, error: slErr } = await sb
        .from("audit_sampled_leads")
        .insert({
          audit_month: input.auditMonth,
          agent_fub_id: agent.fub_id,
          agent_name: agent.name,
          person_fub_id: lead.fub_id,
          anonymized_label: ANONYMIZED_AGENT_LABEL,
          timeline_json: timeline,
          grading_status: "pending",
        })
        .select("id")
        .single();

      if (slErr) continue;

      // In Direct mode: grade synchronously
      if (input.mode === "direct") {
        try {
          const gradingOutput = await gradeLeadDirectly(timeline, criteria);

          // Insert criterion grades
          const gradeInserts = (gradingOutput.scores ?? []).map((s) => {
            const criterionMatch = criteria.find((c) => c.key === s.criterion_key);
            return {
              sampled_lead_id: sampledRow.id,
              criterion_id: criterionMatch?.id || null,
              criterion_key: s.criterion_key,
              score: s.insufficient_evidence ? null : s.score,
              insufficient_evidence: s.insufficient_evidence,
              cited_activity_ids: s.cited_activity_ids,
              excerpt: s.excerpt,
              reasoning: s.reasoning,
            };
          });

          if (gradeInserts.length > 0) {
            await sb.from("audit_lead_grades").insert(gradeInserts);
          }

          // Insert compliance concerns (if any)
          const compInserts = (gradingOutput.compliance_concerns ?? []).map((c) => ({
            sampled_lead_id: sampledRow.id,
            person_fub_id: lead.fub_id,
            agent_fub_id: agent.fub_id,
            agent_name: agent.name,
            flag_type: c.flag_type,
            exact_language: c.exact_language,
            cited_activity_ids: [c.activity_id],
            severity: "high",
          }));

          if (compInserts.length > 0) {
            await sb.from("audit_compliance_flags").insert(compInserts);
          }

          // Calculate overall score (average of non-null scores)
          const validScores = gradeInserts
            .map((g) => g.score)
            .filter((s): s is number => typeof s === "number");
          const avgScore =
            validScores.length > 0
              ? Number(
                  (
                    validScores.reduce((acc, curr) => acc + curr, 0) / validScores.length
                  ).toFixed(2),
                )
              : null;

          await sb
            .from("audit_sampled_leads")
            .update({
              grading_status: "graded",
              overall_score: avgScore,
            })
            .eq("id", sampledRow.id);

          sampledLeadResults.push({
            lead_fub_id: lead.fub_id,
            status: "graded",
            score: avgScore,
          });
        } catch (e: any) {
          console.error(`Error grading lead #${lead.fub_id}:`, e);
          await sb
            .from("audit_sampled_leads")
            .update({ grading_status: "error" })
            .eq("id", sampledRow.id);
        }
      } else {
        sampledLeadResults.push({
          lead_fub_id: lead.fub_id,
          status: "queued_for_batch",
        });
      }
    }

    return {
      ok: true,
      agent_fub_id: agent.fub_id,
      sampled_count: selectedLeads.length,
      results: sampledLeadResults,
    };
  });

// ------------------------------------------------------------------------------
// 6. Calibration Support
// ------------------------------------------------------------------------------

export const getCalibrationSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: sets, error } = await context.supabase
      .from("audit_calibration_sets")
      .select("*, leads:audit_calibration_leads(count)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return sets ?? [];
  });

export const upsertCalibrationSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(128),
        description: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (input.id) {
      const { error } = await context.supabase
        .from("audit_calibration_sets")
        .update({
          name: input.name,
          description: input.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: input.id };
    } else {
      const { data, error } = await context.supabase
        .from("audit_calibration_sets")
        .insert({
          name: input.name,
          description: input.description || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
  });

export const getCalibrationLeadDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ setId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_calibration_leads")
      .select("*, grades:audit_calibration_grades(*)")
      .eq("calibration_set_id", input.setId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addLeadToCalibration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        setId: z.string().uuid(),
        personFubId: z.number(),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Fetch lead & activities
    const { data: lead } = await sb
      .from("fub_leads")
      .select("name, assigned_user_fub_id, assigned_user_name")
      .eq("fub_id", input.personFubId)
      .single();

    const [calls, notes, texts, emails] = await Promise.all([
      sb.from("fub_calls").select("*").eq("person_fub_id", input.personFubId),
      sb.from("fub_notes").select("*").eq("person_fub_id", input.personFubId),
      sb.from("fub_text_messages").select("*").eq("person_fub_id", input.personFubId),
      sb.from("fub_emails").select("*").eq("person_fub_id", input.personFubId),
    ]);

    const timeline = buildSanitizedLeadTimeline({
      calls: calls.data ?? [],
      notes: notes.data ?? [],
      texts: texts.data ?? [],
      emails: emails.data ?? [],
      agentName: lead?.assigned_user_name,
    });

    const { data: row, error } = await sb
      .from("audit_calibration_leads")
      .insert({
        calibration_set_id: input.setId,
        person_fub_id: input.personFubId,
        agent_fub_id: lead?.assigned_user_fub_id || null,
        agent_name: lead?.assigned_user_name || null,
        lead_name: lead?.name || `Lead #${input.personFubId}`,
        timeline_json: timeline,
        notes: input.notes || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const saveCalibrationHumanGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        calibrationLeadId: z.string().uuid(),
        criterionId: z.string().uuid(),
        criterionKey: z.string(),
        humanScore: z.number().min(1).max(5),
        humanNotes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("audit_calibration_grades")
      .upsert(
        {
          calibration_lead_id: input.calibrationLeadId,
          criterion_id: input.criterionId,
          criterion_key: input.criterionKey,
          human_score: input.humanScore,
          human_notes: input.humanNotes || null,
        },
        { onConflict: "calibration_lead_id, criterion_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runCalibrationEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        calibrationSetId: z.string().uuid(),
        model: z.string().default(DEFAULT_AUDIT_MODEL),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: criteriaRows } = await sb
      .from("audit_rubric_criteria")
      .select("*")
      .eq("is_active", true);
    const criteria = (criteriaRows ?? []) as AuditRubricCriterion[];

    const { data: leads } = await sb
      .from("audit_calibration_leads")
      .select("id, timeline_json")
      .eq("calibration_set_id", input.calibrationSetId);

    let evaluatedCount = 0;

    for (const lead of leads ?? []) {
      const output = await gradeLeadDirectly(lead.timeline_json as TimelineActivity[], criteria, input.model);

      for (const s of output.scores ?? []) {
        const criterionMatch = criteria.find((c) => c.key === s.criterion_key);
        if (!criterionMatch) continue;

        // Update or insert Claude score on the calibration grade record
        const { data: existing } = await sb
          .from("audit_calibration_grades")
          .select("id")
          .eq("calibration_lead_id", lead.id)
          .eq("criterion_id", criterionMatch.id)
          .maybeSingle();

        if (existing) {
          await sb
            .from("audit_calibration_grades")
            .update({
              claude_score: s.score,
              claude_reasoning: s.reasoning,
              claude_evaluated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // If human grade not yet entered, insert with default human_score 3 to preserve structure
          await sb.from("audit_calibration_grades").insert({
            calibration_lead_id: lead.id,
            criterion_id: criterionMatch.id,
            criterion_key: s.criterion_key,
            human_score: 3,
            claude_score: s.score,
            claude_reasoning: s.reasoning,
            claude_evaluated_at: new Date().toISOString(),
          });
        }
      }
      evaluatedCount++;
    }

    return { ok: true, evaluatedCount };
  });

// ------------------------------------------------------------------------------
// 7. Monthly Report Email via Gmail API (Google Service Account)
// ------------------------------------------------------------------------------

export const sendMonthlyAuditReportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipientEmail: z.string().email(),
        auditMonth: z.string(),
        reportType: z.enum(["team_rollup", "agent"]).default("team_rollup"),
        agentFubId: z.number().optional(),
        agentName: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const keyString = process.env.GOOGLE_SA_KEY_JSON;
    if (!keyString) {
      throw new Error(
        "Missing Google Service Account key in environment variables (GOOGLE_SA_KEY_JSON)",
      );
    }

    let key: any;
    try {
      key = JSON.parse(keyString);
    } catch {
      key = JSON.parse(keyString.replace(/\\n/g, "\n"));
    }

    // Fetch team metrics
    const { data: metrics } = await sb
      .from("view_audit_agent_monthly_metrics")
      .select("*");

    const activeMetrics = (metrics ?? []).filter(
      (m: any) => !isExcludedAgent(m.agent_name),
    );

    // Build email HTML table
    const tableRows = activeMetrics
      .map(
        (m: any) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-weight: 600;">${m.agent_name}</td>
        <td style="padding: 10px; text-align: center;">${m.avg_rubric_score ? m.avg_rubric_score + " / 5.0" : "N/A"}</td>
        <td style="padding: 10px; text-align: center;">${m.open_integrity_flags_count}</td>
        <td style="padding: 10px; text-align: center;">${m.compliance_flags_count > 0 ? `<span style="color: #dc2626; font-weight: bold;">${m.compliance_flags_count}</span>` : "0"}</td>
        <td style="padding: 10px; text-align: center;">${m.short_calls_pct}% (${m.total_short_calls}/${m.total_calls})</td>
      </tr>`,
      )
      .join("");

    const emailSubject = `MSREG Agent Audit Report — ${input.auditMonth} Team Rollup`;
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; background-color: #f9fafb; margin: 0; padding: 24px;">
      <div style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background-color: #111827; padding: 24px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #d4af37;">Matt Smith Real Estate Group</h1>
          <p style="margin: 6px 0 0 0; font-size: 14px; color: #9ca3af;">Agent Audit System — Monthly Performance & Integrity Report (${input.auditMonth})</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 14px; line-height: 1.6; color: #374151;">
            Hello, below is the finalized Agent Audit overview for <strong>${input.auditMonth}</strong>.
            This report summarizes conversation rubric quality, deterministic data-integrity flags, and compliance checks across all active real estate agents.
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f3f4f6; text-align: left; color: #4b5563; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
                <th style="padding: 10px;">Agent</th>
                <th style="padding: 10px; text-align: center;">Quality Score</th>
                <th style="padding: 10px; text-align: center;">Integrity Flags</th>
                <th style="padding: 10px; text-align: center;">Compliance</th>
                <th style="padding: 10px; text-align: center;">Short Calls (&le;10s)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <strong>Confidentiality Note:</strong> This audit report is generated strictly for leadership coaching and compliance review. All metrics are computed in PostgreSQL and conversation quality grades are verified by leadership.
          </div>
        </div>
      </div>
    </body>
    </html>`;

    // Google Service Account Domain-Wide Delegation to send email
    const { google } = await import("googleapis");
    const senderEmail =
      process.env.GMAIL_SENDER_EMAIL ||
      key.client_email ||
      "tyler.p@mattsmithrealestategroup.com";

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ["https://www.googleapis.com/auth/gmail.send", "https://mail.google.com/"],
      senderEmail,
    );

    const gmail = google.gmail({ version: "v1", auth });

    // Format RFC 2822 email message
    const utf8Subject = `=?utf-8?B?${Buffer.from(emailSubject).toString("base64")}?=`;
    const messageParts = [
      `From: MSREG Agent Audit <${senderEmail}>`,
      `To: ${input.recipientEmail}`,
      `Subject: ${utf8Subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      emailHtml,
    ];
    const message = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return { ok: true, recipient: input.recipientEmail, sentAt: new Date().toISOString() };
  });
