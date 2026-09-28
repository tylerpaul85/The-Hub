// ==============================================================================
// FOLLOW UP BOSS API CLIENT
// Features: Exponential backoff on 429, X-System-Key rate-limit doubling,
// X-RateLimit-Remaining cooldown, keyset pagination, and incremental sync.
// ==============================================================================

import { ANONYMIZED_AGENT_LABEL, isExcludedAgent } from "./config";
import type { TimelineActivity } from "./types";

const FUB_BASE_URL = "https://api.followupboss.com/v1";

interface FubFetchOptions {
  retries?: number;
  timeoutMs?: number;
}

export function getFubApiKey(): string {
  const key = process.env.FUB_API_KEY || process.env.FUB;
  if (!key) {
    throw new Error(
      "Follow Up Boss API key is not configured. Please set FUB_API_KEY or FUB.",
    );
  }
  return key;
}

export function getFubSystemKey(): string | undefined {
  return process.env.FUB_SYSTEM_KEY || undefined;
}

/**
 * Robust fetch wrapper for Follow Up Boss with rate limiting, retries, and backoff.
 */
export async function fubFetch(
  endpointOrFullUrl: string,
  options: FubFetchOptions = {},
): Promise<Response> {
  const { retries = 1, timeoutMs = 6000 } = options;
  const apiKey = getFubApiKey();
  const systemKey = getFubSystemKey();

  const url = endpointOrFullUrl.startsWith("http")
    ? endpointOrFullUrl
    : `${FUB_BASE_URL}${endpointOrFullUrl.startsWith("/") ? "" : "/"}${endpointOrFullUrl}`;

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    Accept: "application/json",
    "X-System": "MSREG-Agent-Audit",
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
      throw new Error(
        "Follow Up Boss API authentication failed (401). Check FUB_API_KEY.",
      );
    }
    if (res.status === 403) {
      // Return response so caller can inspect or catch permission denial gracefully
      return res;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 2;
      console.warn(
        `[FUB Rate Limit 429] Context: ${limitContext}. Retry-After: ${retryAfter}s. Retries left: ${retries}`,
      );
      if (retries > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfter * 1000 + 500),
        );
        return fubFetch(endpointOrFullUrl, {
          ...options,
          retries: retries - 1,
        });
      } else {
        throw new Error(
          `Follow Up Boss rate limit exceeded (429). Context: ${limitContext}.`,
        );
      }
    }

    if (res.status >= 500) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fubFetch(endpointOrFullUrl, {
          ...options,
          retries: retries - 1,
        });
      }
      throw new Error(
        `Follow Up Boss API server error (${res.status}) on ${url}.`,
      );
    }

    // Cooldown if rate limit is running low (< 15 remaining in 10s window)
    if (remaining && remaining < 15) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return res;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      if (retries > 0) {
        return fubFetch(endpointOrFullUrl, {
          ...options,
          retries: retries - 1,
        });
      }
      throw new Error(
        `Follow Up Boss API request timed out after ${timeoutMs / 1000}s.`,
      );
    }
    throw err;
  }
}

/**
 * Keyset / cursor pagination with fallback to offset pagination.
 */
export async function fubPaginate(
  endpointOrFullUrl: string,
  collectionKey: string,
  maxPages = 2,
): Promise<{ items: any[]; total: number; truncated: boolean }> {
  const out: any[] = [];
  let nextUrl: string | null = endpointOrFullUrl;
  let total = 0;
  let pagesFetched = 0;

  while (nextUrl && pagesFetched < maxPages) {
    const sep = nextUrl.includes("?") ? "&" : "?";
    let url = nextUrl;
    if (!url.includes("limit=")) {
      url = `${nextUrl}${sep}limit=100`;
    }

    const res = await fubFetch(url);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `FUB API error GET ${url} (${res.status}): ${errText.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as any;
    if (!data) break;

    const items = data[collectionKey] ?? [];
    out.push(...items);
    total = data?._metadata?.total ?? total;
    pagesFetched++;

    // Keyset pagination: prefer nextLink (full URL)
    let nextCandidate: string | null = data?._metadata?.nextLink || null;

    // If next cursor is present
    if (!nextCandidate && data?._metadata?.next) {
      const cursor = data._metadata.next;
      const baseSep = endpointOrFullUrl.includes("?") ? "&" : "?";
      nextCandidate = `${endpointOrFullUrl}${baseSep}next=${encodeURIComponent(cursor)}`;
    }

    // Offset fallback
    if (!nextCandidate && items.length === 100 && total > out.length) {
      const currentOffset =
        data?._metadata?.offset ?? (pagesFetched - 1) * 100;
      const nextOffset = currentOffset + 100;
      const baseWithoutOffset = endpointOrFullUrl.replace(/[&?]offset=\d+/, "");
      const newSep = baseWithoutOffset.includes("?") ? "&" : "?";
      nextCandidate = `${baseWithoutOffset}${newSep}offset=${nextOffset}`;
    }

    nextUrl = nextCandidate;
    if (items.length < 100) break;
  }

  return {
    items: out,
    total,
    truncated: total > out.length,
  };
}

// ------------------------------------------------------------------------------
// FUB Entity Sync Helpers
// ------------------------------------------------------------------------------

export async function fetchFubUsers() {
  const res = await fubFetch("/users?limit=100");
  if (!res.ok) throw new Error(`Failed to fetch FUB users: ${res.status}`);
  const data = await res.json();
  return (data?.users ?? []).filter((u: any) => u.id && u.name);
}

export async function fetchFubLeads(
  updatedAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-updated");
  params.append(
    "fields",
    "id,name,firstName,lastName,stage,source,assignedUserId,assignedTo,price,contacted,tags,created,updated,lastActivity,lastCommunication,lastSentEmail,lastSentText,lastOutgoingCall",
  );
  if (updatedAfter) {
    params.append("updatedAfter", updatedAfter);
  }

  return fubPaginate(`/people?${params.toString()}`, "people", maxPages);
}

export async function fetchFubNotes(
  createdAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-created");
  if (createdAfter) {
    params.append("createdAfter", createdAfter);
  }

  return fubPaginate(`/notes?${params.toString()}`, "notes", maxPages);
}

export async function fetchFubCalls(
  createdAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-created");
  if (createdAfter) {
    params.append("createdAfter", createdAfter);
  }

  return fubPaginate(`/calls?${params.toString()}`, "calls", maxPages);
}

export async function fetchFubTextMessages(
  createdAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-created");
  if (createdAfter) {
    params.append("createdAfter", createdAfter);
  }

  try {
    const res = await fubPaginate(
      `/textMessages?${params.toString()}`,
      "textMessages",
      maxPages,
    );
    return res;
  } catch (err: any) {
    console.warn("[fub-client] textMessages endpoint returned error:", err.message);
    return { items: [], total: 0, truncated: false };
  }
}

export async function fetchFubEmails(
  createdAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-created");
  if (createdAfter) {
    params.append("createdAfter", createdAfter);
  }

  try {
    const res = await fubPaginate(`/emails?${params.toString()}`, "emails", maxPages);
    return res;
  } catch (err: any) {
    console.warn("[fub-client] emails endpoint returned error:", err.message);
    return { items: [], total: 0, truncated: false };
  }
}

export async function fetchFubTasks(
  updatedAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-updated");
  if (updatedAfter) {
    params.append("updatedAfter", updatedAfter);
  }

  return fubPaginate(`/tasks?${params.toString()}`, "tasks", maxPages);
}

export async function fetchFubAppointments(
  updatedAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-updated");
  if (updatedAfter) {
    params.append("updatedAfter", updatedAfter);
  }

  return fubPaginate(`/appointments?${params.toString()}`, "appointments", maxPages);
}

export async function fetchFubDeals(
  updatedAfter?: string,
  maxPages = 2,
) {
  const params = new URLSearchParams();
  params.append("limit", "100");
  params.append("sort", "-updated");
  if (updatedAfter) {
    params.append("updatedAfter", updatedAfter);
  }

  return fubPaginate(`/deals?${params.toString()}`, "deals", maxPages);
}

// ------------------------------------------------------------------------------
// Chronological Timeline Builder
// ------------------------------------------------------------------------------

export interface LeadActivitiesPayload {
  calls?: any[];
  notes?: any[];
  texts?: any[];
  emails?: any[];
  tasks?: any[];
  appointments?: any[];
  stageHistory?: any[];
  agentName?: string;
}

/**
 * Builds a sanitized, chronological timeline for a sampled lead.
 * Replaces the actual agent's name with "Agent A" to eliminate bias.
 * Formats every activity with an ID, timestamp, type, speaker, and content.
 */
export function buildSanitizedLeadTimeline(
  payload: LeadActivitiesPayload,
  anonymizeTo: string = ANONYMIZED_AGENT_LABEL,
): TimelineActivity[] {
  const activities: TimelineActivity[] = [];
  const realAgentName = payload.agentName?.trim().toLowerCase();

  const resolveSpeaker = (
    userName?: string | null,
    direction?: string | null,
  ): string => {
    if (direction === "inbound" || direction === "incoming") {
      return "Client";
    }
    if (direction === "outbound" || direction === "outgoing") {
      return anonymizeTo;
    }
    if (userName) {
      if (realAgentName && userName.trim().toLowerCase().includes(realAgentName)) {
        return anonymizeTo;
      }
      if (isExcludedAgent(userName)) {
        return "Team Owner / Lead Router";
      }
      return anonymizeTo;
    }
    return "Agent";
  };

  // 1. Calls
  for (const c of payload.calls ?? []) {
    activities.push({
      id: `call_${c.fub_id || c.id}`,
      timestamp: c.fub_created_at || c.created_at || new Date().toISOString(),
      type: "call",
      direction: c.direction,
      speaker: resolveSpeaker(c.user_name, c.direction),
      content: `Call (${c.duration || 0}s duration, outcome: ${c.outcome || "none"})${c.note ? ` - Note: "${c.note}"` : ""}`,
    });
  }

  // 2. Text Messages
  for (const t of payload.texts ?? []) {
    activities.push({
      id: `text_${t.fub_id || t.id}`,
      timestamp: t.fub_created_at || t.created_at || new Date().toISOString(),
      type: "text",
      direction: t.direction,
      speaker: resolveSpeaker(t.user_name, t.direction),
      content: t.body || "[Empty text message]",
    });
  }

  // 3. Emails
  for (const e of payload.emails ?? []) {
    activities.push({
      id: `email_${e.fub_id || e.id}`,
      timestamp: e.fub_created_at || e.created_at || new Date().toISOString(),
      type: "email",
      direction: e.direction,
      speaker: resolveSpeaker(e.user_name, e.direction),
      subject: e.subject,
      content: `${e.subject ? `Subject: ${e.subject}\n` : ""}${e.body || "[No content]"}`,
    });
  }

  // 4. Notes
  for (const n of payload.notes ?? []) {
    activities.push({
      id: `note_${n.fub_id || n.id}`,
      timestamp: n.fub_created_at || n.created_at || new Date().toISOString(),
      type: "note",
      speaker: resolveSpeaker(n.user_name, "internal"),
      subject: n.subject,
      content: `${n.subject ? `Subject: ${n.subject}\n` : ""}${n.body || "[No content]"}`,
    });
  }

  // 5. Tasks
  for (const tk of payload.tasks ?? []) {
    if (tk.is_completed || tk.completed_at) {
      activities.push({
        id: `task_${tk.fub_id || tk.id}`,
        timestamp: tk.completed_at || tk.fub_updated_at || new Date().toISOString(),
        type: "task",
        speaker: anonymizeTo,
        content: `Completed Task: "${tk.name}"${tk.type ? ` (${tk.type})` : ""}`,
      });
    }
  }

  // 6. Appointments
  for (const a of payload.appointments ?? []) {
    activities.push({
      id: `appt_${a.fub_id || a.id}`,
      timestamp: a.start_time || a.fub_created_at || new Date().toISOString(),
      type: "appointment",
      speaker: resolveSpeaker(a.user_name, "internal"),
      content: `Appointment: "${a.title || "Meeting"}" (Time: ${a.start_time || "N/A"})${a.outcome ? ` - Outcome: ${a.outcome}` : ""}`,
    });
  }

  // 7. Stage History
  for (const s of payload.stageHistory ?? []) {
    activities.push({
      id: `stage_${s.id || s.fub_event_id}`,
      timestamp: s.fub_created_at || s.created_at || new Date().toISOString(),
      type: "stage_change",
      speaker: resolveSpeaker(s.changed_by_user_name, "internal"),
      content: `Stage changed from "${s.from_stage || "None"}" to "${s.to_stage}"`,
    });
  }

  // Sort chronologically ascending
  activities.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return activities;
}
