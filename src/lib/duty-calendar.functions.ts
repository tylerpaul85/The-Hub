import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.role);
}
async function assertAdminOrCare(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!roles.includes("admin") && !roles.includes("client_care")) {
    throw new Error("Forbidden: Admin or Client Care role required");
  }
}

const OFFICE = z.enum(["rolla", "str", "loz"]);

// ───────────── Agents (roster) ─────────────
export const listDutyAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("duty_calendar_agents")
      .select("id,name,office,status,created_at")
      .order("office")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertAgentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  office: OFFICE,
  status: z.enum(["active", "inactive"]).default("active"),
});
export const upsertDutyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertAgentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("duty_calendar_agents")
        .update({ name: data.name, office: data.office, status: data.status })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("duty_calendar_agents")
      .insert({ name: data.name, office: data.office, status: data.status })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id };
  });

export const deleteDutyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    const { error } = await context.supabase.from("duty_calendar_agents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bulk import
const bulkSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        office: OFFICE,
      }),
    )
    .min(1),
});
export const bulkImportDutyAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    const { data: existing } = await context.supabase
      .from("duty_calendar_agents")
      .select("name,office");
    const seen = new Set(
      (existing ?? []).map((e: any) => `${e.name.toLowerCase()}|${e.office}`),
    );
    const toInsert = data.rows
      .filter((r) => !seen.has(`${r.name.toLowerCase()}|${r.office}`))
      .map((r) => ({ name: r.name, office: r.office, status: "active" as const }));
    if (toInsert.length === 0) return { inserted: 0, skipped: data.rows.length };
    const { error } = await context.supabase.from("duty_calendar_agents").insert(toInsert);
    if (error) throw new Error(error.message);
    return { inserted: toInsert.length, skipped: data.rows.length - toInsert.length };
  });

// ───────────── Profile picker for availability ─────────────
export const listAllActiveAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("duty_calendar_agents")
      .select("id,name,office")
      .eq("status", "active")
      .order("office")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ───────────── Availability ─────────────
const availabilitySchema = z.object({
  id: z.string().uuid().optional(),
  agent_id: z.string().uuid(),
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(["vacation", "sick", "personal", "other"]).nullable().optional(),
});
export const submitAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => availabilitySchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.date_end < data.date_start) throw new Error("End date must be on or after start date");
    const payload = {
      agent_id: data.agent_id,
      date_start: data.date_start,
      date_end: data.date_end,
      reason: data.reason ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("agent_availability").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("agent_availability")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id };
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agent_availability").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAvailabilityForAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agent_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("agent_availability")
      .select("id,agent_id,date_start,date_end,reason,created_at")
      .eq("agent_id", data.agent_id)
      .order("date_start", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ───────────── Duty calendar ─────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export const getDutyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.number().int().min(1).max(12), year: z.number().int(), office: OFFICE }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("duty_calendar")
      .select("duty_day,assigned_agent_id")
      .eq("year", data.year)
      .eq("month", data.month)
      .eq("office", data.office);
    if (error) throw new Error(error.message);

    const { data: agents } = await context.supabase
      .from("duty_calendar_agents")
      .select("id,name,office,status")
      .eq("office", data.office);

    const first = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const dim = daysInMonth(data.year, data.month);
    const last = `${data.year}-${String(data.month).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    const { data: ooo } = await context.supabase
      .from("agent_availability")
      .select("agent_id,date_start,date_end,reason")
      .lte("date_start", last)
      .gte("date_end", first);

    const byDay = new Map<number, string | null>();
    for (const r of rows ?? []) byDay.set(r.duty_day, r.assigned_agent_id);

    const grid = Array.from({ length: dim }, (_, i) => {
      const day = i + 1;
      const dateStr = `${data.year}-${String(data.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const oooAgents = (ooo ?? [])
        .filter((o: any) => o.date_start <= dateStr && o.date_end >= dateStr)
        .map((o: any) => o.agent_id);
      const agentId = byDay.get(day) ?? null;
      const agent = agents?.find((a: any) => a.id === agentId) ?? null;
      return { day, agent_id: agentId, agent_name: agent?.name ?? null, ooo_agent_ids: oooAgents };
    });

    // Per-agent OOO ranges for this month (clipped to month bounds), only for office agents
    const officeAgentIds = new Set((agents ?? []).map((a: any) => a.id));
    const ooo_ranges = (ooo ?? [])
      .filter((o: any) => officeAgentIds.has(o.agent_id))
      .map((o: any) => {
        const agent = agents?.find((a: any) => a.id === o.agent_id);
        return {
          agent_id: o.agent_id,
          agent_name: agent?.name ?? "Unknown",
          date_start: o.date_start < first ? first : o.date_start,
          date_end: o.date_end > last ? last : o.date_end,
          reason: o.reason ?? null,
        };
      })
      .sort((a: any, b: any) =>
        a.date_start === b.date_start ? a.agent_name.localeCompare(b.agent_name) : a.date_start.localeCompare(b.date_start),
      );

    return { grid, agents: agents ?? [], days_in_month: dim, ooo_ranges };
  });

export const assignDutyDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        month: z.number().int().min(1).max(12),
        year: z.number().int(),
        office: OFFICE,
        day: z.number().int().min(1).max(31),
        agent_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("duty_calendar")
      .upsert(
        {
          year: data.year,
          month: data.month,
          office: data.office,
          duty_day: data.day,
          assigned_agent_id: data.agent_id,
        },
        { onConflict: "year,month,office,duty_day" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createDutyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        month: z.number().int().min(1).max(12),
        year: z.number().int(),
        office: OFFICE,
        assignments: z.array(z.object({ day: z.number().int(), agent_id: z.string().uuid().nullable() })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    const rows = data.assignments.map((a) => ({
      year: data.year,
      month: data.month,
      office: data.office,
      duty_day: a.day,
      assigned_agent_id: a.agent_id,
    }));
    if (rows.length > 0) {
      const { error } = await context.supabase
        .from("duty_calendar")
        .upsert(rows, { onConflict: "year,month,office,duty_day" });
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: rows.length };
  });

export const deleteDutyCalendarMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.number().int(), year: z.number().int(), office: OFFICE }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("duty_calendar")
      .delete()
      .eq("year", data.year)
      .eq("month", data.month)
      .eq("office", data.office);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ───────────── Analyze with Claude ─────────────
export const analyzeDutyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.number().int().min(1).max(12), year: z.number().int(), office: OFFICE }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCare(context.supabase, context.userId);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

    const { data: agents } = await context.supabase
      .from("duty_calendar_agents")
      .select("id,name")
      .eq("office", data.office)
      .eq("status", "active");

    if (!agents || agents.length === 0) {
      throw new Error("No active agents in this office. Add agents to the duty roster first.");
    }

    const ids = agents.map((a: any) => a.id);
    const first = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const dim = daysInMonth(data.year, data.month);
    const last = `${data.year}-${String(data.month).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    const { data: ooo } = await context.supabase
      .from("agent_availability")
      .select("agent_id,date_start,date_end")
      .in("agent_id", ids)
      .lte("date_start", last)
      .gte("date_end", first);

    const oooByAgent: Record<string, string[]> = {};
    for (const a of agents) {
      const dates: string[] = [];
      for (const o of ooo ?? []) {
        if (o.agent_id !== a.id) continue;
        const start = o.date_start > first ? o.date_start : first;
        const end = o.date_end < last ? o.date_end : last;
        for (let d = new Date(start); d <= new Date(end); d.setUTCDate(d.getUTCDate() + 1)) {
          dates.push(d.toISOString().slice(0, 10));
        }
      }
      oooByAgent[a.name] = Array.from(new Set(dates));
    }

    const officeLabel = data.office === "rolla" ? "Rolla" : data.office === "str" ? "St. Robert" : "Lake of the Ozarks";
    const monthLabel = new Date(data.year, data.month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

    // Exclude Sundays — duty days are Monday-Saturday only
    const eligibleDays: number[] = [];
    const dayToDow: Record<number, number> = {};
    for (let day = 1; day <= dim; day++) {
      const dow = new Date(Date.UTC(data.year, data.month - 1, day)).getUTCDay();
      dayToDow[day] = dow;
      if (dow !== 0) eligibleDays.push(day);
    }

    // ── Previous month workload (same office) ──
    const prevMonth = data.month === 1 ? 12 : data.month - 1;
    const prevYear = data.month === 1 ? data.year - 1 : data.year;
    const { data: prevRows } = await context.supabase
      .from("duty_calendar")
      .select("duty_day,assigned_agent_id")
      .eq("year", prevYear)
      .eq("month", prevMonth)
      .eq("office", data.office);

    const prevCountById: Record<string, number> = {};
    const prevDaysByAgent: Record<string, number[]> = {};
    for (const r of prevRows ?? []) {
      if (!r.assigned_agent_id) continue;
      prevCountById[r.assigned_agent_id] = (prevCountById[r.assigned_agent_id] ?? 0) + 1;
      (prevDaysByAgent[r.assigned_agent_id] ??= []).push(r.duty_day);
    }
    const prevByAgentName: Record<string, { count: number; days: number[] }> = {};
    for (const a of agents) {
      prevByAgentName[a.name] = {
        count: prevCountById[a.id] ?? 0,
        days: (prevDaysByAgent[a.id] ?? []).sort((x, y) => x - y),
      };
    }

    // Was an agent OOO at all during previous month?
    const prevFirst = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevDim = daysInMonth(prevYear, prevMonth);
    const prevLast = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevDim).padStart(2, "0")}`;
    const { data: prevOoo } = await context.supabase
      .from("agent_availability")
      .select("agent_id")
      .in("agent_id", ids)
      .lte("date_start", prevLast)
      .gte("date_end", prevFirst);
    const oooLastMonthIds = new Set((prevOoo ?? []).map((r: any) => r.agent_id));
    const oooLastMonthNames = agents
      .filter((a: any) => oooLastMonthIds.has(a.id))
      .map((a: any) => a.name);

    const agentLines = agents
      .map((a: any) => {
        const ooo = oooByAgent[a.name] ?? [];
        return `- ${a.name} | OOO this month: ${ooo.length ? ooo.join(", ") : "none"} | Last month duty days: ${prevByAgentName[a.name].count}`;
      })
      .join("\n");

    const prevMonthLabel = new Date(prevYear, prevMonth - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
    const prevLines = Object.entries(prevByAgentName)
      .map(([name, info]) => `- ${name}: ${info.count} duty days${info.days.length ? ` (days: ${info.days.join(", ")})` : ""}`)
      .join("\n") || "- No previous month data available";

    const prompt = `You are scheduling duty days for a real estate office for ${monthLabel}.
Office: ${officeLabel}

CONSTRAINTS:
1. Do NOT assign any agent to Sundays
2. Do NOT assign an agent on their OOO dates (see list below)
3. Distribute duty days as evenly as possible across all agents
4. Do NOT schedule the same agent more than once per week (Mon-Sat)
5. Consider workload balance from previous month (if available)

AGENTS & AVAILABILITY:
${agentLines}

ELIGIBLE DUTY DAYS (Mon-Sat only, Sundays excluded): ${JSON.stringify(eligibleDays)}
Total eligible duty days: ${eligibleDays.length}
Day-of-week map for this month (0=Sun..6=Sat): ${JSON.stringify(dayToDow)}

PREVIOUS MONTH (${prevMonthLabel}):
${prevLines}
Agents OOO at any point last month: ${oooLastMonthNames.length ? oooLastMonthNames.join(", ") : "none"}

WORKLOAD BALANCING LOGIC:
- If an agent had fewer duty days last month, they should get slightly more this month (to even out)
- If an agent had more duty days last month, they should get slightly fewer this month
- If an agent was OOO last month, they may have more duty days this month to catch up (unless OOO this month too)
- Goal: long-term balance, not just this month

Generate optimal duty day assignments following all constraints above.
Only include Mon-Sat days from the eligible list. Do not assign on OOO dates.

Return ONLY JSON in this exact shape with no commentary:
{"suggestions": [{"day": 1, "agent": "John Smith"}, {"day": 2, "agent": "Jane Doe"}]}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Claude API error: ${resp.status} ${txt.slice(0, 300)}`);
    }
    const json: any = await resp.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude returned no JSON");
    let parsed: { suggestions: Array<{ day: number; agent: string }> };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new Error("Failed to parse Claude response as JSON");
    }

    const byName = new Map<string, string>();
    for (const a of agents) byName.set(a.name.toLowerCase(), a.id);
    const eligibleSet = new Set(eligibleDays);
    const mapped = (parsed.suggestions ?? [])
      .filter((s) => s.day >= 1 && s.day <= dim && eligibleSet.has(s.day))
      .map((s) => ({ day: s.day, agent_id: byName.get((s.agent ?? "").toLowerCase()) ?? null, agent_name: s.agent }));

    return { suggestions: mapped, days_in_month: dim };
  });
