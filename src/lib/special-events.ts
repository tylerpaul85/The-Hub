import { format, parseISO } from "date-fns";

export type SpecialEventType = "internal" | "community" | "sponsorship";
export type CapacityMode = "none" | "simple" | "group";
export type SignupStatus = "confirmed" | "waitlist" | "cancelled";

export type SpecialEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm:ss or HH:mm
  end_time: string | null; // HH:mm:ss or HH:mm
  location: string | null;
  event_type: SpecialEventType;
  cover_image_url: string | null;
  requires_rsvp: boolean;
  allows_committee: boolean;
  capacity_mode: CapacityMode;
  max_capacity: number | null;
  enable_waitlist: boolean;
  max_groups: number | null;
  max_per_group: number | null;
  google_calendar_id: string | null;
  google_event_id: string | null;
  sync_google_calendar: boolean;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SpecialEventGroup = {
  id: string;
  event_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export type SpecialEventSignup = {
  id: string;
  event_id: string;
  user_id: string | null;
  agent_name?: string | null;
  agent_email?: string | null;
  group_id: string | null;
  status: SignupStatus;
  notes: string | null;
  google_calendar_synced: boolean;
  created_at: string;
  updated_at: string;
};

export type SpecialEventCommittee = {
  id: string;
  event_id: string;
  user_id: string | null;
  agent_name?: string | null;
  agent_email?: string | null;
  notes: string | null;
  created_at: string;
};

export type SpecialEventProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export const SPECIAL_EVENT_TYPE_LABELS: Record<SpecialEventType, string> = {
  internal: "Internal Event",
  community: "Community Event",
  sponsorship: "Sponsorship",
};

export const SPECIAL_EVENT_TYPE_BADGES: Record<SpecialEventType, string> = {
  internal: "bg-gold/15 text-gold border-gold/30",
  community: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  sponsorship: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export const CAPACITY_MODE_LABELS: Record<CapacityMode, string> = {
  none: "No Capacity Limit",
  simple: "Individual Spots Cap",
  group: "Group / Team Cap (e.g. Golf Tournament)",
};

/** Format time string (e.g. "18:00:00" -> "6:00 PM") */
export function formatEventTime(timeStr: string | null): string {
  if (!timeStr) return "";
  try {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1] || "0", 10);
    const d = new Date();
    d.setHours(hours, mins, 0, 0);
    return format(d, "h:mm a");
  } catch {
    return timeStr;
  }
}

/** Format full event date and time string */
export function formatEventDateTime(
  eventDate: string,
  startTime: string | null,
  endTime: string | null,
): string {
  try {
    const d = parseISO(eventDate);
    const dateFormatted = format(d, "EEEE, MMMM d, yyyy");
    if (!startTime) return dateFormatted;
    const s = formatEventTime(startTime);
    if (!endTime) return `${dateFormatted} at ${s}`;
    const e = formatEventTime(endTime);
    return `${dateFormatted} · ${s} – ${e}`;
  } catch {
    return eventDate;
  }
}

/** Build Google Calendar one-click web link */
export function buildGoogleCalendarUrl(event: SpecialEvent): string {
  const dateClean = event.event_date.replace(/-/g, "");
  let startIso = `${dateClean}`;
  let endIso = `${dateClean}`;

  if (event.start_time) {
    const st = event.start_time.replace(/:/g, "").slice(0, 6).padEnd(6, "0");
    startIso = `${dateClean}T${st}`;
    if (event.end_time) {
      const et = event.end_time.replace(/:/g, "").slice(0, 6).padEnd(6, "0");
      endIso = `${dateClean}T${et}`;
    } else {
      // Default 1 hour later
      const hours = parseInt(event.start_time.slice(0, 2), 10) + 1;
      const hStr = String(hours % 24).padStart(2, "0");
      const et = `${hStr}${event.start_time.slice(3, 5)}00`;
      endIso = `${dateClean}T${et}`;
    }
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${startIso}/${endIso}`,
    details: event.description || "",
    location: event.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Generate and trigger download of .ics calendar file */
export function downloadIcsFile(event: SpecialEvent): void {
  const dateClean = event.event_date.replace(/-/g, "");
  let startStr = `VALUE=DATE:${dateClean}`;
  let endStr = `VALUE=DATE:${dateClean}`;

  if (event.start_time) {
    const st = event.start_time.replace(/:/g, "").slice(0, 6).padEnd(6, "0");
    startStr = `${dateClean}T${st}`;
    if (event.end_time) {
      const et = event.end_time.replace(/:/g, "").slice(0, 6).padEnd(6, "0");
      endStr = `${dateClean}T${et}`;
    } else {
      const hours = parseInt(event.start_time.slice(0, 2), 10) + 1;
      const hStr = String(hours % 24).padStart(2, "0");
      endStr = `${dateClean}T${hStr}${event.start_time.slice(3, 5)}00`;
    }
  }

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Matt Smith Real Estate Group//Special Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:special-event-${event.id}@mattsmithrealestategroup.com`,
    `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
    `DTSTART;${startStr}`,
    `DTEND;${endStr}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
    `LOCATION:${event.location || ""}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Export Event Attendees to CSV */
export function exportAttendeesCsv(
  event: SpecialEvent,
  signups: SpecialEventSignup[],
  profiles: SpecialEventProfile[],
  groups: SpecialEventGroup[],
): void {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  const headers = [
    "Attendee Name",
    "Email",
    "Status",
    "Group / Team",
    "Notes",
    "Signed Up At",
  ];

  const rows = signups.map((s) => {
    const p = s.user_id ? profileMap.get(s.user_id) : undefined;
    const name = p
      ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
      : s.agent_name || s.agent_email || "Unknown";
    const email = p?.email || s.agent_email || "";
    const groupName = s.group_id ? groupMap.get(s.group_id) || "Assigned Group" : "—";
    const status = s.status === "confirmed" ? "Confirmed" : s.status === "waitlist" ? "Waitlist" : "Cancelled";
    const notes = s.notes || "";
    const signedUpAt = s.created_at ? format(new Date(s.created_at), "yyyy-MM-dd HH:mm") : "";

    return [
      `"${name.replace(/"/g, '""')}"`,
      `"${email.replace(/"/g, '""')}"`,
      `"${status}"`,
      `"${groupName.replace(/"/g, '""')}"`,
      `"${notes.replace(/"/g, '""')}"`,
      `"${signedUpAt}"`,
    ].join(",");
  });

  const csvContent = [
    `"Event: ${event.title.replace(/"/g, '""')}"`,
    `"Date: ${event.event_date}"`,
    `"Location: ${(event.location || "").replace(/"/g, '""')}"`,
    "",
    headers.join(","),
    ...rows,
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Attendees.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Export Event Committee to CSV */
export function exportCommitteeCsv(
  event: SpecialEvent,
  committee: SpecialEventCommittee[],
  profiles: SpecialEventProfile[],
): void {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const headers = ["Volunteer Name", "Email", "Notes", "Joined Committee At"];

  const rows = committee.map((c) => {
    const p = c.user_id ? profileMap.get(c.user_id) : undefined;
    const name = p
      ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
      : c.agent_name || c.agent_email || "Unknown";
    const email = p?.email || c.agent_email || "";
    const notes = c.notes || "";
    const joinedAt = c.created_at ? format(new Date(c.created_at), "yyyy-MM-dd HH:mm") : "";

    return [
      `"${name.replace(/"/g, '""')}"`,
      `"${email.replace(/"/g, '""')}"`,
      `"${notes.replace(/"/g, '""')}"`,
      `"${joinedAt}"`,
    ].join(",");
  });

  const csvContent = [
    `"Committee Roster: ${event.title.replace(/"/g, '""')}"`,
    `"Date: ${event.event_date}"`,
    "",
    headers.join(","),
    ...rows,
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Committee.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
