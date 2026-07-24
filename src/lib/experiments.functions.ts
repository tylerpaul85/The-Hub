import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_EMAILS = [
  "tyler.p@mattsmithrealestategroup.com",
  "tylerpaul85@gmail.com",
];

function assertAllowed(claims: any) {
  const email = String(claims?.email ?? "").toLowerCase();
  if (!ALLOWED_EMAILS.includes(email)) {
    throw new Error("Forbidden: Experiments access is restricted.");
  }
}

type ProbeResult = {
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
  note?: string;
  contentType?: string;
  data?: any;
  sisuStatusCode?: number | null;
};

async function probe(
  label: string,
  url: string,
  headers: Record<string, string>,
  opts?: { checkSisuStatus?: boolean },
): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    let data: unknown = text;
    let parsed = false;
    try {
      data = JSON.parse(text);
      parsed = true;
    } catch {
      /* keep text */
    }
    const looksLikeHtml =
      !parsed &&
      (contentType.includes("text/html") ||
        /^\s*<(!doctype|html)/i.test(typeof text === "string" ? text : ""));

    // Sisu returns HTTP 200 even on failure — real status is in body.status_code
    // (0 = success, negative = failure).
    let sisuStatusCode: number | null | undefined;
    let sisuOk = true;
    if (opts?.checkSisuStatus && parsed && data && typeof data === "object") {
      const sc = (data as any).status_code;
      if (typeof sc === "number") {
        sisuStatusCode = sc;
        sisuOk = sc === 0;
      } else {
        sisuStatusCode = null;
      }
    }

    const note = looksLikeHtml
      ? "Response is HTML, not JSON — this URL is hitting a website page, not an API endpoint. The base URL / path is wrong."
      : opts?.checkSisuStatus && sisuStatusCode !== undefined && sisuStatusCode !== null && sisuStatusCode !== 0
        ? `Sisu reported failure: status_code=${sisuStatusCode} (0 = success, negative = failure). HTTP status alone is misleading — always check body.status_code.`
        : undefined;

    const ok = res.ok && !looksLikeHtml && sisuOk;
    return {
      label,
      url,
      ok,
      status: res.status,
      contentType,
      data: truncate(data),
      error: !res.ok
        ? `HTTP ${res.status}`
        : looksLikeHtml
          ? "Non-JSON HTML response"
          : !sisuOk
            ? `Sisu status_code=${sisuStatusCode}`
            : undefined,
      note,
      sisuStatusCode,
    };
  } catch (e: any) {
    return { label, url, ok: false, status: null, error: e?.message ?? String(e) };
  }
}

function truncate(v: unknown): unknown {
  try {
    const s = JSON.stringify(v);
    if (s && s.length > 8000) return s.slice(0, 8000) + "...[truncated]";
  } catch {
    /* noop */
  }
  return v;
}

export const runApiDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAllowed((context as any).claims);

    const fubKey = process.env.FUB;
    // SISU_AUTHORIZATION should already be the full Basic auth token
    // (base64 of username:token). Fall back to legacy `Sisu` secret.
    const sisuAuth = process.env.SISU_AUTHORIZATION ?? process.env.Sisu;
    const sisuBase = (process.env.SISU_BASE_URL ?? "https://api.sisu.co/api").replace(/\/$/, "");

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const results: {
      fub: ProbeResult[];
      sisu: ProbeResult[];
      meta: Record<string, any>;
    } = {
      fub: [],
      sisu: [],
      meta: {
        fubKeyPresent: Boolean(fubKey),
        sisuAuthPresent: Boolean(sisuAuth),
        sisuBaseUrl: sisuBase,
        sisuAuthNote:
          "Sisu uses Basic auth. SISU_AUTHORIZATION must be the full base64(username:token) value — sent as `Authorization: Basic <value>`. Sisu returns HTTP 200 on failure; the real result is in body.status_code (0 = success, negative = failure).",
        ranAt: now.toISOString(),
      },
    };

    // --- Follow Up Boss ---
    if (!fubKey) {
      results.fub.push({
        label: "FUB secret missing",
        url: "",
        ok: false,
        status: null,
        error: "FUB secret is not configured.",
      });
    } else {
      const basic = `Basic ${Buffer.from(`${fubKey}:`).toString("base64")}`;
      const systemKey = process.env.FUB_SYSTEM_KEY ?? fubKey;
      const fubHeaders = {
        Authorization: basic,
        "X-System": "MSREG-Marketing-Dashboard",
        "X-System-Key": systemKey,
        Accept: "application/json",
      };

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      results.fub.push(await probe("Identity / account", "https://api.followupboss.com/v1/identity", fubHeaders));
      results.fub.push(
        await probe(
          "Calls logged today",
          `https://api.followupboss.com/v1/calls?createdAfter=${encodeURIComponent(startOfDay)}&limit=1`,
          fubHeaders,
        ),
      );
      results.fub.push(
        await probe(
          "Appointments this month",
          `https://api.followupboss.com/v1/appointments?createdAfter=${encodeURIComponent(startOfMonth)}&limit=1`,
          fubHeaders,
        ),
      );
      results.fub.push(
        await probe("Deals (first page)", "https://api.followupboss.com/v1/deals?limit=10", fubHeaders),
      );
      results.fub.push(
        await probe("Deal stages", "https://api.followupboss.com/v1/stages?limit=100", fubHeaders),
      );
      results.fub.push(
        await probe("Pipelines", "https://api.followupboss.com/v1/pipelines?limit=50", fubHeaders),
      );
    }

    // --- Sisu ---
    if (!sisuAuth) {
      results.sisu.push({
        label: "Sisu auth missing",
        url: "",
        ok: false,
        status: null,
        error: "SISU_AUTHORIZATION secret is not configured.",
      });
    } else {
      // The secret is already in base64(username:token) form per Sisu's docs.
      // Strip an accidental "Basic " prefix if present.
      const token = sisuAuth.replace(/^Basic\s+/i, "");
      const sisuHeaders = {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
      };

      // Allow overrides without code changes once exact format is confirmed.
      // SISU_TEAM_ID — appended as team_id=<id> when set.
      // SISU_LEADERBOARD_MONTH_PATH / SISU_LEADERBOARD_YEAR_PATH — full paths
      //   (with leading slash). Tokens {year}, {month}, {team} are substituted.
      const teamId = process.env.SISU_TEAM_ID ?? "";
      const teamQs = teamId ? `&team_id=${encodeURIComponent(teamId)}` : "";
      const subst = (tpl: string) =>
        tpl
          .replaceAll("{year}", String(year))
          .replaceAll("{month}", String(month))
          .replaceAll("{team}", encodeURIComponent(teamId));

      const monthOverride = process.env.SISU_LEADERBOARD_MONTH_PATH;
      const yearOverride = process.env.SISU_LEADERBOARD_YEAR_PATH;

      const sisuCalls: Array<{ label: string; path: string }> = [];

      if (monthOverride) {
        sisuCalls.push({ label: "Leaderboard Month (override)", path: subst(monthOverride) });
      } else {
        sisuCalls.push(
          { label: "Leaderboard Month — query params", path: `/v1/leaderboard/month?year=${year}&month=${month}${teamQs}` },
          { label: "Leaderboard Month — path segments", path: `/v1/leaderboard/month/${year}/${month}${teamId ? `?team_id=${encodeURIComponent(teamId)}` : ""}` },
          { label: "Leaderboard Monthly (singular)", path: `/v1/leaderboard/monthly?year=${year}&month=${month}${teamQs}` },
          { label: "Leaderboard ?type=month", path: `/v1/leaderboard?type=month&year=${year}&month=${month}${teamQs}` },
        );
      }

      if (yearOverride) {
        sisuCalls.push({ label: "Leaderboard Year (override)", path: subst(yearOverride) });
      } else {
        sisuCalls.push(
          { label: "Leaderboard Year — query params", path: `/v1/leaderboard/year?year=${year}${teamQs}` },
          { label: "Leaderboard Year — path segment", path: `/v1/leaderboard/year/${year}${teamId ? `?team_id=${encodeURIComponent(teamId)}` : ""}` },
          { label: "Leaderboard Yearly (singular)", path: `/v1/leaderboard/yearly?year=${year}${teamQs}` },
          { label: "Leaderboard ?type=year", path: `/v1/leaderboard?type=year&year=${year}${teamQs}` },
        );
      }

      sisuCalls.push(
        { label: "Agents", path: `/v1/agent` },
        { label: "Clients / Transactions (limit 5)", path: `/v1/client?limit=5` },
        { label: "Transactions endpoint (alt)", path: `/v1/transaction?limit=5` },
      );

      results.meta.sisuOverrides = {
        SISU_TEAM_ID: teamId || "(not set)",
        SISU_LEADERBOARD_MONTH_PATH: monthOverride || "(not set — using built-in variants)",
        SISU_LEADERBOARD_YEAR_PATH: yearOverride || "(not set — using built-in variants)",
        note:
          "Set these env vars to lock in the correct path once confirmed from Sisu's API Reference. Use tokens {year}, {month}, {team} in path templates.",
      };

      for (const { label, path } of sisuCalls) {
        const url = `${sisuBase}${path}`;
        results.sisu.push(
          await probe(`Sisu — ${label}`, url, sisuHeaders, { checkSisuStatus: true }),
        );
      }
    }


    return results;
  });

// ---------------- Live TV Dashboard ----------------

type FubUser = { id: number; name?: string; firstName?: string; lastName?: string };

async function fubFetch(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) as any };
  } catch {
    return { ok: false, status: res.status, data: null as any };
  }
}

async function fubPaginate(
  baseUrl: string,
  headers: Record<string, string>,
  collectionKey: string,
  maxPages = 5,
): Promise<any[]> {
  const out: any[] = [];
  for (let page = 0; page < maxPages; page++) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}limit=100&offset=${page * 100}`;
    const { ok, data } = await fubFetch(url, headers);
    if (!ok || !data) break;
    const items: any[] = data[collectionKey] ?? [];
    out.push(...items);
    const total: number | undefined = data?._metadata?.total;
    if (items.length < 100) break;
    if (typeof total === "number" && out.length >= total) break;
  }
  return out;
}

export type LiveStats = {
  ranAt: string;
  appointmentsThisMonth: number;
  callsToday: number;
  dealsByStage: Array<{ stage: string; count: number; pipeline?: string }>;
  callsLeaderboard: Array<{ name: string; count: number }>;
  appointmentsLeaderboard: Array<{ name: string; count: number }>;
  errors: string[];
};

export const getLiveStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiveStats> => {
    assertAllowed((context as any).claims);

    const fubKey = process.env.FUB;
    const errors: string[] = [];
    const empty: LiveStats = {
      ranAt: new Date().toISOString(),
      appointmentsThisMonth: 0,
      callsToday: 0,
      dealsByStage: [],
      callsLeaderboard: [],
      appointmentsLeaderboard: [],
      errors,
    };
    if (!fubKey) {
      errors.push("FUB secret not configured.");
      return empty;
    }

    const basic = `Basic ${Buffer.from(`${fubKey}:`).toString("base64")}`;
    const headers = {
      Authorization: basic,
      "X-System": "MSREG-Marketing-Dashboard",
      "X-System-Key": fubKey,
      Accept: "application/json",
    };

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [usersR, callsCountR, apptCountR, stagesR, dealsR, callsAllR, apptsAllR] =
      await Promise.all([
        fubFetch("https://api.followupboss.com/v1/users?limit=100", headers),
        fubFetch(
          `https://api.followupboss.com/v1/calls?createdAfter=${encodeURIComponent(startOfDay)}&limit=1`,
          headers,
        ),
        fubFetch(
          `https://api.followupboss.com/v1/appointments?createdAfter=${encodeURIComponent(startOfMonth)}&limit=1`,
          headers,
        ),
        fubFetch("https://api.followupboss.com/v1/stages?limit=100", headers),
        fubPaginate("https://api.followupboss.com/v1/deals", headers, "deals", 5),
        fubPaginate(
          `https://api.followupboss.com/v1/calls?createdAfter=${encodeURIComponent(startOfDay)}`,
          headers,
          "calls",
          3,
        ),
        fubPaginate(
          `https://api.followupboss.com/v1/appointments?createdAfter=${encodeURIComponent(startOfMonth)}`,
          headers,
          "appointments",
          5,
        ),
      ]);

    // User id -> name map
    const userMap = new Map<number, string>();
    const users: FubUser[] = usersR.data?.users ?? [];
    for (const u of users) {
      const name =
        u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        `User #${u.id}`;
      userMap.set(u.id, name);
    }

    const appointmentsThisMonth: number =
      apptCountR.data?._metadata?.total ?? (Array.isArray(apptsAllR) ? apptsAllR.length : 0);
    const callsToday: number =
      callsCountR.data?._metadata?.total ?? (Array.isArray(callsAllR) ? callsAllR.length : 0);

    // Stages map: id -> { name, pipelineId }
    const stages: Array<{ id: number; name: string; pipelineId?: number }> =
      stagesR.data?.stages ?? [];
    const stageMap = new Map<number, { name: string; pipelineId?: number }>();
    for (const s of stages) stageMap.set(s.id, { name: s.name, pipelineId: s.pipelineId });

    // Count deals per stage
    const dealCounts = new Map<number, number>();
    for (const d of dealsR) {
      const sid = d.stageId ?? d.stage?.id;
      if (typeof sid === "number") dealCounts.set(sid, (dealCounts.get(sid) ?? 0) + 1);
    }
    const dealsByStage = Array.from(dealCounts.entries())
      .map(([sid, count]) => ({
        stage: stageMap.get(sid)?.name ?? `Stage #${sid}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Leaderboards from calls / appointments
    function tally(items: any[]): Array<{ name: string; count: number }> {
      const counts = new Map<string, number>();
      for (const it of items) {
        const uid: number | undefined =
          it.userId ?? it.createdById ?? it.assignedUserId ?? it.user?.id;
        let name: string | undefined;
        if (typeof uid === "number") name = userMap.get(uid) ?? `User #${uid}`;
        if (!name && Array.isArray(it.users) && it.users.length > 0) {
          const u = it.users[0];
          name = userMap.get(u?.id) ?? u?.name ?? undefined;
        }
        if (!name) continue;
        if (name.trim().toLowerCase().includes("matt smith")) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }

    return {
      ranAt: now.toISOString(),
      appointmentsThisMonth,
      callsToday,
      dealsByStage,
      callsLeaderboard: tally(callsAllR),
      appointmentsLeaderboard: tally(apptsAllR),
      errors,
    };
  });

