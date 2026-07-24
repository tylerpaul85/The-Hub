import { createClient } from "@supabase/supabase-js";

// Global cache for stages
let cachedStages: string[] | null = null;
let lastStagesFetchTime = 0;

// Log warning at startup if FUB_SYSTEM_KEY is missing
const systemKey = process.env.FUB_SYSTEM_KEY;
if (!systemKey) {
  console.warn("[Startup Warning] FUB_SYSTEM_KEY is not configured in the environment. Follow Up Boss API global rate limits will be halved (125 vs 250 per 10s window).");
}

// ---------------- Helper Utilities ----------------

// Timezone-aware date math helper: computes days ago in America/Chicago
function getCentralDateCutoff(daysAgo: number, nowOverride?: Date): { isoStr: string; fubStr: string } {
  const now = nowOverride || new Date();
  
  // Calculate date in America/Chicago timezone
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  chicagoTime.setDate(chicagoTime.getDate() - daysAgo);

  const yyyy = chicagoTime.getFullYear();
  const mm = String(chicagoTime.getMonth() + 1).padStart(2, "0");
  const dd = String(chicagoTime.getDate()).padStart(2, "0");
  const hh = String(chicagoTime.getHours()).padStart(2, "0");
  const min = String(chicagoTime.getMinutes()).padStart(2, "0");
  const ss = String(chicagoTime.getSeconds()).padStart(2, "0");

  const fubStr = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

  // Corresponding UTC date
  const utcDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const isoStr = utcDate.toISOString();

  return { isoStr, fubStr };
}

// Timezone-aware day-difference helper (America/Chicago midnight boundaries)
function getDaysSinceCentral(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  
  const nowChicago = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const targetChicago = new Date(target.toLocaleString("en-US", { timeZone: "America/Chicago" }));

  nowChicago.setHours(0, 0, 0, 0);
  targetChicago.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((nowChicago.getTime() - targetChicago.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

// Dynamic stage caching helper
async function getStages(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedStages && (now - lastStagesFetchTime < 60 * 60 * 1000)) {
    return cachedStages;
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      Accept: "application/json",
      "X-System": "MSREG-Hub-Assistant",
    };
    if (systemKey) {
      headers["X-System-Key"] = systemKey;
    }
    const res = await fetch("https://api.followupboss.com/v1/stages?limit=100", { headers });
    if (res.ok) {
      const data = await res.json() as any;
      cachedStages = (data?.stages ?? []).map((s: any) => s.name);
      lastStagesFetchTime = now;
      return cachedStages || [];
    }
  } catch (e) {
    console.error("Failed to fetch stages for cache:", e);
  }
  return cachedStages || [];
}

// Optimized FUB fetch with rate-limiting backoff, retries, and timeout
async function fubFetch(url: string, apiKey: string, retries = 1, timeoutMs = 12000): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    Accept: "application/json",
    "X-System": "MSREG-Hub-Assistant",
  };
  if (systemKey) {
    headers["X-System-Key"] = systemKey;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);

    const remaining = Number(res.headers.get("X-RateLimit-Remaining"));
    const limitContext = res.headers.get("X-RateLimit-Context") || "unknown";

    if (res.status === 401) {
      throw new Error("Follow Up Boss API authentication failed (401). Please verify the server FUB_API_KEY environment configuration.");
    }
    if (res.status === 403) {
      throw new Error("Follow Up Boss API permission denied (403). The configured API key lacks permission to access this resource.");
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 2;
      console.warn(`[FUB Rate Limit 429] Context: ${limitContext}. Retry-After: ${retryAfter}s.`);
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 500));
        return fubFetch(url, apiKey, retries - 1, timeoutMs);
      } else {
        throw new Error(`Follow Up Boss rate limit exceeded (429). Context: ${limitContext}. Please try again shortly.`);
      }
    }
    if (res.status >= 500) {
      throw new Error(`Follow Up Boss API server error (${res.status}). Service may be temporarily unavailable.`);
    }

    if (remaining && remaining < 20) {
      console.log(`[FUB Rate Limit Low] Remaining: ${remaining}. Pausing for cooldown.`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return res;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error(`Follow Up Boss API request timed out after ${timeoutMs / 1000}s.`);
    }
    throw err;
  }
}

// Pagination with keyset (next) pointer, falling back to offset if next is absent
async function fubPaginate(
  baseUrl: string,
  apiKey: string,
  collectionKey: string,
  maxPages = 5
): Promise<{ items: any[]; total: number; truncated: boolean }> {
  const out: any[] = [];
  let nextUrl = baseUrl;
  let total = 0;
  let pagesFetched = 0;

  while (nextUrl && pagesFetched < maxPages) {
    const sep = nextUrl.includes("?") ? "&" : "?";
    let url = nextUrl;
    if (!url.includes("limit=")) {
      url = `${nextUrl}${sep}limit=100`;
    }

    const res = await fubFetch(url, apiKey);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`FUB API error GET ${url} (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    if (!data) break;

    const items = data[collectionKey] ?? [];
    out.push(...items);
    total = data?._metadata?.total ?? total;
    pagesFetched++;

    // Keyset pagination: prefer nextLink (full URL)
    let nextUrlCandidate = data?._metadata?.nextLink || null;

    // If nextLink is missing but next cursor string is present, append next query param to baseUrl
    if (!nextUrlCandidate && data?._metadata?.next) {
      const cursor = data._metadata.next;
      const sep = baseUrl.includes("?") ? "&" : "?";
      nextUrlCandidate = `${baseUrl}${sep}next=${encodeURIComponent(cursor)}`;
    }

    // Offset fallback
    if (!nextUrlCandidate && items.length === 100 && total > out.length) {
      const currentOffset = data?._metadata?.offset ?? ((pagesFetched - 1) * 100);
      const nextOffset = currentOffset + 100;
      const baseWithoutOffset = baseUrl.replace(/[&?]offset=\d+/, "");
      const newSep = baseWithoutOffset.includes("?") ? "&" : "?";
      nextUrlCandidate = `${baseWithoutOffset}${newSep}offset=${nextOffset}`;
    }

    nextUrl = nextUrlCandidate;

    if (items.length < 100) break;
  }

  return {
    items: out,
    total,
    truncated: total > out.length,
  };
}

// ---------------- Tool Implementations ----------------

// 1. search_people
async function handleSearchPeople(input: any, apiKey: string) {
  const {
    stage,
    source,
    assigned_user_id,
    assigned_to,
    last_activity_before,
    last_activity_after,
    last_communication_before,
    contacted,
    tags,
    include_trash = false,
    sort = "-lastActivity",
    limit = 100,
  } = input;

  const requestedLimit = Math.min(limit ? Number(limit) : 100, 500);
  const maxPages = Math.ceil(requestedLimit / 100);

  const queryParams = new URLSearchParams();
  queryParams.append("limit", "100");
  queryParams.append("sort", sort);
  queryParams.append("fields", "id,name,firstName,lastName,created,createdVia,stage,source,assignedUserId,assignedTo,lastActivity,lastCommunication,lastSentEmail,lastSentText,lastOutgoingCall,contacted,price,tags");

  if (stage) queryParams.append("stage", stage);
  if (source) queryParams.append("source", source);
  if (assigned_user_id) queryParams.append("assignedUserId", String(assigned_user_id));
  if (assigned_to) queryParams.append("assignedTo", assigned_to);
  if (last_activity_before) queryParams.append("lastActivityBefore", last_activity_before);
  if (last_activity_after) queryParams.append("lastActivityAfter", last_activity_after);
  if (contacted !== undefined) queryParams.append("contacted", String(contacted));
  if (tags) queryParams.append("tags", tags);
  if (include_trash) queryParams.append("includeTrash", "true");

  const fubRes = await fubPaginate(
    `https://api.followupboss.com/v1/people?${queryParams.toString()}`,
    apiKey,
    "people",
    maxPages
  );

  let people = fubRes.items;
  let totalMatching = fubRes.total;
  let truncated = fubRes.truncated;

  // Apply client-side filter for last_communication_before
  if (last_communication_before) {
    const commCutoff = new Date(last_communication_before).getTime();
    people = people.filter((p: any) => {
      const lastCommTime = p.lastCommunication ? new Date(p.lastCommunication).getTime() : 0;
      return lastCommTime < commCutoff;
    });
    if (fubRes.truncated) {
      truncated = true;
    }
  }

  // Format return payload
  const returnedCount = Math.min(people.length, requestedLimit);
  const slicedPeople = people.slice(0, returnedCount);
  const isTruncated = truncated || totalMatching > returnedCount;

  const peopleMapped = slicedPeople.map((p: any) => {
    const outboundTimes = [p.lastSentEmail, p.lastSentText, p.lastOutgoingCall]
      .filter(Boolean)
      .map((t) => new Date(t).getTime());
    const lastOutbound = outboundTimes.length > 0 ? new Date(Math.max(...outboundTimes)).toISOString() : null;

    return {
      id: p.id,
      name: p.name || [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unnamed",
      created: p.created,
      created_via: p.createdVia || "Unknown",
      stage: p.stage || "Unknown",
      source: p.source || "Unknown",
      assigned_to: p.assignedTo || "Unknown",
      assigned_user_id: p.assignedUserId || null,
      last_activity: p.lastActivity || null,
      last_communication: p.lastCommunication || null,
      last_outbound_contact: lastOutbound,
      days_since_activity: getDaysSinceCentral(p.lastActivity),
      days_since_outbound_contact: getDaysSinceCentral(lastOutbound),
      contacted: p.contacted ? 1 : 0,
    };
  });

  return {
    report_type: "search_people",
    generated_at: new Date().toISOString(),
    total_matching: totalMatching,
    returned: returnedCount,
    truncated: isTruncated,
    query_echo: {
      endpoint: "GET /v1/people",
      params: input,
      cutoff_computed: last_activity_before || null,
      timezone: "America/Chicago",
    },
    people: peopleMapped,
  };
}

// Excluded users configuration for agent performance reporting
export const EXCLUDED_AGENT_REPORTING_NAMES = new Set(["matt smith"]);
export const EXCLUDED_AGENT_REPORTING_USER_IDS = new Set<number>();

export function isExcludedReportingUser(userId?: number | null, userName?: string | null): boolean {
  if (userId && EXCLUDED_AGENT_REPORTING_USER_IDS.has(userId)) {
    return true;
  }
  if (userName && EXCLUDED_AGENT_REPORTING_NAMES.has(userName.trim().toLowerCase())) {
    return true;
  }
  return false;
}

// 2. get_agent_leaderboard
async function handleGetAgentLeaderboard(input: any, apiKey: string) {
  const { stage, stale_days = 14, source } = input;
  const daysVal = Number(stale_days) || 14;

  const { isoStr } = getCentralDateCutoff(daysVal);
  const cutoffTime = new Date(isoStr).getTime();

  // 1. Fetch active agents and resolve Matt Smith's User ID dynamically
  const usersRes = await fubFetch("https://api.followupboss.com/v1/users?limit=100", apiKey);
  if (!usersRes.ok) throw new Error("Failed to fetch FUB agent list.");
  const usersData = await usersRes.json();
  const allUsers: any[] = usersData?.users ?? [];

  for (const u of allUsers) {
    if (u.name && u.name.trim().toLowerCase() === "matt smith") {
      EXCLUDED_AGENT_REPORTING_USER_IDS.add(u.id);
    }
  }

  // Filter roster for reportable agents (permanently exclude Matt Smith)
  const agentsRoster = allUsers.filter(
    (u: any) => u.name && !isExcludedReportingUser(u.id, u.name)
  );

  // 2. Fetch leads in scope (paginating up to 10 pages for accuracy)
  const peopleParams = new URLSearchParams();
  peopleParams.append("limit", "100");
  peopleParams.append("fields", "id,assignedUserId,assignedTo,lastActivity,lastCommunication,lastSentEmail,lastSentText,lastOutgoingCall,contacted");
  if (stage) peopleParams.append("stage", stage);
  if (source) peopleParams.append("source", source);

  const peopleRes = await fubPaginate(
    `https://api.followupboss.com/v1/people?${peopleParams.toString()}`,
    apiKey,
    "people",
    10
  );

  // Deduplicate leads by FUB person ID
  const uniqueLeadsMap = new Map<number, any>();
  for (const item of peopleRes.items) {
    if (item.id && !uniqueLeadsMap.has(item.id)) {
      uniqueLeadsMap.set(item.id, item);
    }
  }
  const uniqueLeads = Array.from(uniqueLeadsMap.values());

  // 3. Separate leads into Reportable Agent Leads vs Shared Pond / Owner Assigned
  let reportableAgentLeadsCount = 0;
  let sharedPondOwnerAssignedCount = 0;

  const leadsByAgent = new Map<number, any[]>();
  for (const l of uniqueLeads) {
    const uid = l.assignedUserId;
    if (isExcludedReportingUser(uid, l.assignedTo)) {
      sharedPondOwnerAssignedCount++;
    } else if (uid) {
      reportableAgentLeadsCount++;
      const list = leadsByAgent.get(uid) ?? [];
      list.push(l);
      leadsByAgent.set(uid, list);
    }
  }

  // 4. Compute stats per reportable agent (Matt Smith excluded from agent dataset)
  const agentRollups = agentsRoster.map((u: any) => {
    const agentLeads = leadsByAgent.get(u.id) ?? [];
    const totalInScope = agentLeads.length;

    let staleByActivity = 0;
    let staleByOutboundContact = 0;
    let neverContacted = 0;

    for (const l of agentLeads) {
      // Stale by activity
      const activityTime = l.lastActivity ? new Date(l.lastActivity).getTime() : 0;
      if (activityTime === 0 || activityTime < cutoffTime) {
        staleByActivity += 1;
      }

      // Outbound contact timestamps
      const outboundTimes = [l.lastSentEmail, l.lastSentText, l.lastOutgoingCall]
        .filter(Boolean)
        .map((t) => new Date(t).getTime());
      const maxOutbound = outboundTimes.length > 0 ? Math.max(...outboundTimes) : 0;

      if (maxOutbound === 0 || maxOutbound < cutoffTime) {
        staleByOutboundContact += 1;
      }

      // Never contacted
      if (maxOutbound === 0 || !l.contacted) {
        neverContacted += 1;
      }
    }

    const pctStaleActivity = totalInScope > 0 ? Number(((staleByActivity / totalInScope) * 100).toFixed(1)) : 0;
    const pctStaleOutbound = totalInScope > 0 ? Number(((staleByOutboundContact / totalInScope) * 100).toFixed(1)) : 0;

    return {
      user_id: u.id,
      name: u.name,
      total_in_scope: totalInScope,
      stale_by_activity: staleByActivity,
      stale_by_outbound_contact: staleByOutboundContact,
      pct_stale_by_activity: pctStaleActivity,
      pct_stale_by_outbound_contact: pctStaleOutbound,
      never_contacted: neverContacted,
      denominator_context: `${staleByOutboundContact} of ${totalInScope} leads`,
    };
  }).filter((a: any) => a.total_in_scope > 0)
    .sort((a: any, b: any) => b.stale_by_outbound_contact - a.stale_by_outbound_contact);

  const isTruncated = peopleRes.truncated || peopleRes.total > uniqueLeads.length;

  return {
    report_type: "agent_leaderboard",
    generated_at: new Date().toISOString(),
    stale_definition: {
      days: daysVal,
      cutoff: isoStr,
      basis: "lastActivity and lastOutboundContact reported separately",
    },
    exclusion_note: "Matt Smith is excluded from agent performance reporting because owner-assigned pond leads do not represent individual agent follow-up activity.",
    pond_summary: {
      reportable_agent_leads: reportableAgentLeadsCount,
      shared_pond_owner_assigned: sharedPondOwnerAssignedCount,
      excluded_reporting_users: ["Matt Smith"],
    },
    total_matching_leads: peopleRes.total,
    records_reviewed: peopleRes.items.length,
    unique_records_processed: uniqueLeads.length,
    truncated: isTruncated,
    is_incomplete: isTruncated,
    warning_message: isTruncated
      ? `⚠️ Partial Dataset Notice: Report reflects the first ${uniqueLeads.length} unique leads (of ${peopleRes.total} total matching CRM records). Rankings and team-wide percentages reflect this sample only.`
      : undefined,
    agents: agentRollups,
  };
}

// 3. get_pipeline_summary
async function handleGetPipelineSummary(input: any, apiKey: string) {
  const { pipeline_id, assigned_user_id, include_deals = false } = input;

  const [stagesR, pipelinesR, dealsRes] = await Promise.all([
    fubFetch("https://api.followupboss.com/v1/stages?limit=100", apiKey).then((r) => r.json()),
    fubFetch("https://api.followupboss.com/v1/pipelines?limit=50", apiKey).then((r) => r.json()),
    fubPaginate("https://api.followupboss.com/v1/deals", apiKey, "deals", 3),
  ]);

  const stages = stagesR?.stages ?? [];
  const pipelines = pipelinesR?.pipelines ?? [];

  const pipelineMap = new Map<number, string>();
  for (const p of pipelines) {
    pipelineMap.set(p.id, p.name);
  }

  const stageMap = new Map<number, { name: string; pipelineId?: number }>();
  for (const s of stages) {
    stageMap.set(s.id, { name: s.name, pipelineId: s.pipelineId });
  }

  const aggregation: Record<string, { stageName: string; pipelineName: string; count: number; totalValue: number }> = {};
  const matchingDeals: any[] = [];

  for (const d of dealsRes.items) {
    if (pipeline_id && String(d.pipelineId) !== String(pipeline_id)) continue;
    if (assigned_user_id && String(d.userId) !== String(assigned_user_id)) continue;

    const sInfo = stageMap.get(d.stageId);
    const stageName = sInfo?.name || d.stage?.name || `Stage #${d.stageId}`;
    const pipelineName = pipelineMap.get(d.pipelineId) || `Pipeline #${d.pipelineId}`;

    const key = `${d.pipelineId}-${stageName}`;
    if (!aggregation[key]) {
      aggregation[key] = {
        stageName,
        pipelineName,
        count: 0,
        totalValue: 0,
      };
    }
    aggregation[key].count += 1;
    aggregation[key].totalValue += Number(d.price) || 0;

    if (include_deals) {
      matchingDeals.push({
        id: d.id,
        name: d.name,
        price: Number(d.price) || 0,
        stage: stageName,
        pipeline: pipelineName,
        assigned_user_id: d.userId,
      });
    }
  }

  const breakdown = Object.values(aggregation).map((a) => ({
    pipeline: a.pipelineName,
    stage: a.stageName,
    count: a.count,
    total_value: a.totalValue,
    average_value: a.count > 0 ? Math.round(a.totalValue / a.count) : 0,
  }));

  const totalCount = breakdown.reduce((sum, item) => sum + item.count, 0);
  const totalValue = breakdown.reduce((sum, item) => sum + item.total_value, 0);

  return {
    report_type: "pipeline_summary",
    generated_at: new Date().toISOString(),
    total_deals_count: totalCount,
    total_deals_value: totalValue,
    average_deal_value: totalCount > 0 ? Math.round(totalValue / totalCount) : 0,
    truncated: dealsRes.truncated,
    stages_breakdown: breakdown,
    ...(include_deals ? { deals: matchingDeals } : {}),
  };
}

// 4. get_lead_sources
async function handleGetLeadSources(input: any, apiKey: string) {
  const { created_after, created_before, stage } = input;

  if (!created_after || !created_before) {
    throw new Error("Parameters created_after and created_before are required for get_lead_sources.");
  }

  // Calculate cutoff for stale definition (14 days ago)
  const { isoStr } = getCentralDateCutoff(14);
  const cutoffTime = new Date(isoStr).getTime();

  const queryParams = new URLSearchParams();
  queryParams.append("createdAfter", created_after);
  queryParams.append("createdBefore", created_before);
  queryParams.append("fields", "id,source,stage,lastActivity,lastSentEmail,lastSentText,lastOutgoingCall");

  const peopleRes = await fubPaginate(
    `https://api.followupboss.com/v1/people?${queryParams.toString()}`,
    apiKey,
    "people",
    3
  );

  let leads = peopleRes.items;
  if (stage) {
    leads = leads.filter((l) => l.stage && l.stage.toLowerCase() === stage.toLowerCase());
  }

  const sourceAggregation: Record<string, { total: number; stale: number; stages: Record<string, number> }> = {};

  for (const l of leads) {
    const src = l.source || "Unknown";
    const stg = l.stage || "Unknown";

    if (!sourceAggregation[src]) {
      sourceAggregation[src] = { total: 0, stale: 0, stages: {} };
    }
    sourceAggregation[src].total += 1;
    sourceAggregation[src].stages[stg] = (sourceAggregation[src].stages[stg] || 0) + 1;

    // Check if stale
    const actTime = l.lastActivity ? new Date(l.lastActivity).getTime() : 0;
    if (actTime === 0 || actTime < cutoffTime) {
      sourceAggregation[src].stale += 1;
    }
  }

  const sourcesList = Object.entries(sourceAggregation).map(([source, data]) => {
    const staleRate = data.total > 0 ? Number(((data.stale / data.total) * 100).toFixed(1)) : 0;
    return {
      source,
      totalCount: data.total,
      staleCount: data.stale,
      stale_rate: staleRate,
      denominator_context: `${data.stale} of ${data.total} leads`,
      stageBreakdown: data.stages,
    };
  }).sort((a, b) => b.totalCount - a.totalCount);

  return {
    report_type: "lead_sources",
    generated_at: new Date().toISOString(),
    total_leads_in_scope: peopleRes.total,
    records_reviewed: leads.length,
    truncated: peopleRes.truncated,
    stale_cutoff: isoStr,
    sources: sourcesList,
  };
}

// Define tools schemas available to Claude
const TOOLS = [
  {
    name: "search_people",
    description: "Search and retrieve a list of contacts/leads from Follow Up Boss. Allows sorting, filtering, and paging with a hard ceiling of 500 records. Evaluates outbound contacts and passive activity metrics.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "Exact stage name (e.g. Lead, A - Hot (0-3 months), D - Cold (12+ months))" },
        source: { type: "string", description: "Filter leads by marketing source" },
        assigned_user_id: { type: "integer", description: "Agent ID filter" },
        assigned_to: { type: "string", description: "Agent name filter" },
        last_activity_before: { type: "string", description: "ISO date format (YYYY-MM-DD HH:MM:SS) to match leads who had no activity since this cutoff" },
        last_activity_after: { type: "string", description: "ISO date format" },
        last_communication_before: { type: "string", description: "Filter client-side for leads whose last communication is older than this timestamp" },
        contacted: { type: "boolean", description: "Match contacted status" },
        tags: { type: "string", description: "Comma-separated tag list (OR matches)" },
        include_trash: { type: "boolean", description: "Whether to include trash (default false)" },
        sort: { type: "string", description: "Sort field (e.g. -lastActivity, -created). Defaults to -lastActivity." },
        limit: { type: "integer", description: "Maximum records to return (default 100, max 500)" },
      },
    },
  },
  {
    name: "get_agent_leaderboard",
    description: "Get per-agent totals and ratios of stale and never-contacted leads in central time timezone. Scopes list and computes percentages dynamically.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "Optional exact stage filter" },
        stale_days: { type: "integer", description: "Cutoff window for stale classification (default 14 days)" },
        source: { type: "string", description: "Optional marketing source filter" },
      },
    },
  },
  {
    name: "get_pipeline_summary",
    description: "Get deal counts and values aggregated by pipeline and stage. Returns totals and breakdowns without full row list by default.",
    input_schema: {
      type: "object",
      properties: {
        pipeline_id: { type: "string", description: "Optional numeric pipeline filter" },
        assigned_user_id: { type: "integer", description: "Filter deals assigned to specific agent" },
        include_deals: { type: "boolean", description: "Return deal records list (default false)" },
      },
    },
  },
  {
    name: "get_lead_sources",
    description: "Break down leads created within a date range by marketing source, reporting total count, stale counts, stale percentages, and stages distribution.",
    input_schema: {
      type: "object",
      properties: {
        created_after: { type: "string", description: "ISO-8601 UTC date (e.g. 2026-07-01T00:00:00Z)" },
        created_before: { type: "string", description: "ISO-8601 UTC date (e.g. 2026-07-16T23:59:59Z)" },
        stage: { type: "string", description: "Optional stage filter" },
      },
      required: ["created_after", "created_before"],
    },
  },
];

// ---------------- Netlify Handler ----------------

export async function handler(event: any, context: any) {
  const requestOrigin = event.headers.origin || event.headers.Origin || "";
  const allowedOrigins = [
    "https://calendar-hub-craft.lovable.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173"
  ];
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // 1. Load keys and check variables
  const fubApiKey = process.env.FUB_API_KEY || process.env.FUB;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!fubApiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "FUB_API_KEY is not configured on the server." }),
    };
  }
  if (!anthropicApiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
    };
  }
  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Supabase environment variables are missing on the server." }),
    };
  }

  // 2. Validate Supabase JWT token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized: Missing authorization header." }),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized: Invalid token." }),
    };
  }

  // 3. Verify user has admin role
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to retrieve user roles." }),
    };
  }

  const isAdmin = (rolesData ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: "Forbidden: Admin role check failed." }),
    };
  }

  // 4. Accept chat history
  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body." }),
    };
  }

  const { messages, action, toolName, input } = requestBody;

  // Trigger stage caching at startup/request time
  await getStages(fubApiKey);

  const systemPrompt = `You are an operational CRM reporting analyst for Matt Smith Real Estate Group (MSREG), operating in Rolla, St. Robert, and Lake of the Ozarks.

AGENT REPORTING EXCLUSION: Matt Smith is the team owner and the default assigned user for shared pond leads. Never include Matt Smith in agent performance rankings, agent averages, agent percentages, or agent comparison tables. Do not remove his assigned leads from account-wide totals. When relevant, report them separately as Shared Pond / Owner Assigned. All exclusion calculations are performed by application code. Never attempt to restore, estimate, or recalculate Matt Smith’s agent row.

DATA BOUNDARIES & AUTHORITATIVE DATA:
- Report ONLY information explicitly contained in tool results.
- All counts, ratios, calculations, percentages, agent names, stages, sources, and totals provided by tools are authoritative.
- NEVER invent, infer, or fabricate unsupported metrics including:
  * Text response times or average call response times
  * Lead conversion rates or closing percentages
  * Contact attempt counts
  * Lead totals or agent rankings not in tool results
  * Historical trends or hourly comparisons
  unless explicitly provided by a tool or deterministically calculated in application code.
- NEVER recount large result sets or change rounding. Do NOT recalculate numbers provided by tools.

UNSUPPORTED QUESTIONS:
- If a user asks for data that cannot be calculated from current tools (such as actual message-by-message response times, text response rates, or hourly SLAs), respond clearly with:
  "I cannot calculate actual text or call response times from current data because individual message-level timestamps are not available to this report."
- Then offer the closest supported reports (e.g. leads with no outbound contact in 14 days, agent leaderboards by stale lead count, or never-contacted leads).

TRUNCATION & DATA LIMITS:
- When a tool result contains \`truncated: true\`, state clearly:
  "⚠️ Note: This report reflects a partial dataset (showing first X matching records of Y total leads)."
- Never present partial-dataset calculations as complete team totals without stating the dataset boundary.

REPORTING STYLE:
- Lead with the single most important operational finding.
- Provide clean, compact Markdown tables for numbers.
- Explain what the numbers mean operationally and identify follow-up opportunities.
- Avoid generic motivational language or repeating the user's question.
- Keep explanations professional, clear, and business-focused.

STAGE DEFINITIONS (Time-to-Transaction Bands):
  Lead                    — not yet triaged
  A - Hot (0-3 months)    — expected to transact within 3 months
  B - Warm (3-6 months)   — expected to transact in 3-6 months
  C - Watch (6-12 months) — expected to transact in 6-12 months
  D - Cold (12+ months)   — expected to transact in 12+ months (NOT "uninterested")

ACTIVITY VS CONTACT DEFINITIONS:
  last_activity          includes passive/automated events (saved searches, property views, IDX visits, imports). Never describe passive activity as agent follow-up.
  last_outbound_contact  most recent human agent-initiated outbound call, text, or email.
  never_contacted        leads with zero outbound contact recorded.
  contacted_then_dropped leads with prior contact whose last outbound contact is older than the stale threshold.`;

  // Action A: Client-orchestrated Chat Proxy (Sends payload directly to Claude)
  if (action === "chat") {
    if (!Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "messages array is required for action chat." }),
      };
    }

    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          tools: TOOLS,
          messages: messages,
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: `Anthropic API error: ${errText}` }),
        };
      }

      const result = await claudeRes.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message || String(err) }),
      };
    }
  }

  // Action B: Client-orchestrated Tool Proxy (Executes specific tool server-side)
  if (action === "tool") {
    if (!toolName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "toolName is required for action tool." }),
      };
    }

    try {
      let toolResultData;
      if (toolName === "search_people") {
        toolResultData = await handleSearchPeople(input, fubApiKey);
      } else if (toolName === "get_agent_leaderboard") {
        toolResultData = await handleGetAgentLeaderboard(input, fubApiKey);
      } else if (toolName === "get_pipeline_summary") {
        toolResultData = await handleGetPipelineSummary(input, fubApiKey);
      } else if (toolName === "get_lead_sources") {
        toolResultData = await handleGetLeadSources(input, fubApiKey);
      } else {
        throw new Error(`Tool ${toolName} is not defined.`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result: toolResultData }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message || String(err) }),
      };
    }
  }

  // Fallback: Synchronous Agentic Loop (the old behaviour)
  if (!Array.isArray(messages)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "messages array is required." }),
    };
  }

  const currentMessages = [...messages];
  let iterations = 0;
  let finalResponseText = "";

  try {
    while (iterations < 5) {
      iterations++;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: systemPrompt,
          tools: TOOLS,
          messages: currentMessages,
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: `Anthropic API error (${claudeRes.status}): ${errText}` }),
        };
      }

      const result = (await claudeRes.json()) as any;

      currentMessages.push({
        role: "assistant",
        content: result.content,
      });

      if (result.stop_reason !== "tool_use") {
        const textBlock = result.content.find((c: any) => c.type === "text");
        finalResponseText = textBlock ? textBlock.text : "";
        break;
      }

      const toolUses = result.content.filter((c: any) => c.type === "tool_use");
      
      const toolResults = await Promise.all(
        toolUses.map(async (toolUse: any) => {
          const { name, input, id: toolUseId } = toolUse;
          let toolResultData;

          try {
            if (name === "search_people") {
              toolResultData = await handleSearchPeople(input, fubApiKey);
            } else if (name === "get_agent_leaderboard") {
              toolResultData = await handleGetAgentLeaderboard(input, fubApiKey);
            } else if (name === "get_pipeline_summary") {
              toolResultData = await handleGetPipelineSummary(input, fubApiKey);
            } else if (name === "get_lead_sources") {
              toolResultData = await handleGetLeadSources(input, fubApiKey);
            } else {
              throw new Error(`Tool ${name} is not defined.`);
            }
          } catch (err: any) {
            toolResultData = {
              error: err.message || String(err),
              details: {
                endpoint: name,
                params: input,
              },
            };
          }

          return {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: JSON.stringify(toolResultData),
          };
        })
      );

      const toolResultsContent = toolResults;

      currentMessages.push({
        role: "user",
        content: toolResultsContent,
      });
    }

    if (!finalResponseText && currentMessages.length > 0) {
      const lastAssMessage = currentMessages[currentMessages.length - 1];
      if (lastAssMessage.role === "assistant") {
        const textBlock = lastAssMessage.content?.find?.((c: any) => c.type === "text");
        finalResponseText = textBlock ? textBlock.text : "Tool execution completed. Limit reached.";
      } else {
        finalResponseText = "Tool execution loop completed without returning text response.";
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: finalResponseText }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
}
