export type RockStatus = "on_track" | "off_track" | "complete";
export type IssueStatus = "pending" | "open" | "solved" | "tabled" | "converted";

export type Member = { id: string; email: string; first_name: string | null; last_name: string | null };

export function displayName(m?: { email: string; first_name?: string | null; last_name?: string | null } | null): string {
  if (!m) return "Unknown";
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return full || m.email;
}

export function mentionHandle(m: { email: string; first_name?: string | null; last_name?: string | null }): string {
  const full = [m.first_name, m.last_name].filter(Boolean).join("");
  if (full) return full.replace(/[^A-Za-z0-9]/g, "");
  return (m.email.split("@")[0] || "user").replace(/[^A-Za-z0-9]/g, "");
}

export const ROCK_STATUS_LABEL: Record<RockStatus, string> = {
  on_track: "On Track",
  off_track: "Off Track",
  complete: "Complete",
};

export const ROCK_STATUS_CLASS: Record<RockStatus, string> = {
  on_track: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  off_track: "bg-destructive/15 text-destructive border-destructive/30",
  complete: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export function currentQuarter(d = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export type Rock = {
  id: string;
  title: string;
  owner: string;
  quarter: string;
  due_date: string | null;
  status: RockStatus;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type Todo = {
  id: string;
  title: string;
  owner: string;
  due_date: string;
  completed: boolean;
  meeting_id: string | null;
  issue_id: string | null;
  created_at: string;
};

export type Issue = {
  id: string;
  title: string;
  description: string | null;
  submitted_by: string;
  status: IssueStatus;
  outcome_note: string | null;
  meeting_id: string | null;
  converted_rock_id: string | null;
  created_at: string;
};

export type IssueNote = {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type IssuePriority = {
  meeting_id: string;
  issue_id: string;
  rank: number;
};

export type MeetingRating = {
  meeting_id: string;
  user_id: string;
  rating: number;
};

export type Meeting = {
  id: string;
  meeting_date: string;
  attendees: string[];
  segue: string | null;
  headlines: string | null;
  conclude_notes: string | null;
  meeting_rating: number | null;
  status: "in_progress" | "completed";
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
};

export type GoalDirection = "higher_is_better" | "lower_is_better";

export type Measurable = {
  id: string;
  label: string;
  weekly_target: string;
  sort_order: number;
  goal_direction: GoalDirection;
};

// Parse a goal cell that may be a number, percentage ("80%"), currency ("$50"),
// or a non-numeric word ("Yes"). Returns null when no number can be derived.
export function goalToNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[,$%]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Returns true when the actual value hits the goal given direction.
// Returns null when goal is not numerically comparable.
export function isGoalHit(actual: number, goal: string, direction: GoalDirection): boolean | null {
  const g = goalToNumber(goal);
  if (g === null) return null;
  return direction === "lower_is_better" ? actual <= g : actual >= g;
}
