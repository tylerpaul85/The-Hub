export const EVENT_TYPES = [
  "Open House",
  "Broker Tour",
  "Client Appreciation",
  "Team Meeting",
  "Homebuyer Seminar",
  "Community Sponsorship",
  "Holiday Party",
  "Other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_CLASS: Record<EventType, string> = {
  "Open House": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Broker Tour": "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "Client Appreciation": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Team Meeting": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  "Homebuyer Seminar": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Community Sponsorship": "bg-teal-500/15 text-teal-400 border-teal-500/30",
  "Holiday Party": "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "Other": "bg-muted text-muted-foreground border-border",
};

export const NEEDS_LISTING: EventType[] = ["Open House", "Broker Tour"];

export const DEFAULT_CHECKLIST = [
  "Venue booked",
  "Invites sent",
  "Signage ordered",
  "Refreshments confirmed",
  "Social graphics ready",
  "Photographer scheduled",
  "Follow up email drafted",
];

export type SlotType = "Save the Date" | "Promotion" | "Reminder" | "Day Of" | "Recap";

export const SUGGESTION_OFFSETS: { type: SlotType; days: number }[] = [
  { type: "Save the Date", days: -14 },
  { type: "Promotion", days: -7 },
  { type: "Reminder", days: -1 },
  { type: "Day Of", days: 0 },
  { type: "Recap", days: 2 },
];

export type EventRow = {
  id: string;
  name: string;
  type: EventType;
  event_date: string;
  event_time: string | null;
  location: string | null;
  hosts: string[];
  headcount: number | null;
  budget: number | null;
  notes: string | null;
  linked_listing: string | null;
  created_by: string | null;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  event_id: string;
  label: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
};

export type Suggestion = {
  id: string;
  event_id: string;
  slot_type: SlotType;
  suggested_date: string;
  status: "pending" | "approved" | "dismissed";
  content_id: string | null;
};

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
