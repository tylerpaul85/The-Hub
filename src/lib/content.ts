export const PLATFORMS = ["YouTube", "Meta", "Mailchimp", "Blog"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_CHIP: Record<string, string> = {
  YouTube: "bg-red-500/15 text-red-300 border-red-500/30",
  Meta: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  // Legacy keys for any historical chips still in flight
  "Meta PP": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Meta LOZ": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  Mailchimp: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Blog: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export const BRANDS = ["LOZ", "PP", "AON", "MSREG ALL"] as const;
export type Brand = (typeof BRANDS)[number];

// String-keyed so any legacy values still render with a chip during transition.
export const BRAND_STYLES: Record<string, string> = {
  LOZ: "bg-indigo-400/15 text-indigo-300 border-indigo-400/40",
  PP: "bg-gold/15 text-gold border-gold/40",
  "MSREG ALL": "bg-purple-400/15 text-purple-300 border-purple-400/40",
  AON: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  // Legacy fallbacks
  "MSREG LOZ": "bg-indigo-400/15 text-indigo-300 border-indigo-400/40",
  "MSREG PP": "bg-gold/15 text-gold border-gold/40",
  MSREG: "bg-purple-400/15 text-purple-300 border-purple-400/40",
};

export const STATUSES = ["draft", "in_review", "needs_revision", "pending_re_approval", "approved", "scheduled", "published"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  in_review: "In Review",
  needs_revision: "Needs Revision",
  pending_re_approval: "Pending Re-Approval",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
};

export const STATUS_CLASS: Record<Status, string> = {
  draft: "bg-status-draft/25 text-status-draft border-status-draft/50",
  in_review: "bg-status-review/25 text-status-review border-status-review/50",
  needs_revision: "bg-destructive/20 text-destructive border-destructive/50",
  pending_re_approval: "bg-[oklch(0.72_0.18_55)]/20 text-[oklch(0.82_0.18_55)] border-[oklch(0.72_0.18_55)]/50",
  approved: "bg-status-approved/25 text-status-approved border-status-approved/50",
  scheduled: "bg-status-scheduled/25 text-status-scheduled border-status-scheduled/50",
  published: "bg-status-published/25 text-status-published border-status-published/50",
};

export const PRIORITY_BORDER: Record<Priority, string> = {
  urgent: "border-l-[3px] border-l-[oklch(0.62_0.22_25)]",
  high: "border-l-[3px] border-l-[oklch(0.72_0.18_55)]",
  normal: "border-l-[3px] border-l-gold",
  low: "border-l-[3px] border-l-[oklch(0.6_0.02_260)]",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export interface ContentItem {
  id: string;
  title: string;
  caption: string | null;
  platforms: string[];
  status: Status;
  scheduled_at: string;
  link: string | null;
  priority: Priority;
  notes: string | null;
  thumbnail_url: string | null;
  image_urls: string[] | null;
  target_publish_date: string | null;
  revision_note: string | null;
  created_by: string | null;
  created_at: string;
  brand: Brand;
  canva_link: string | null;
  description: string | null;
  blog_content: string | null;
  blog_doc_link: string | null;
  youtube_thumbnail_url: string | null;
  youtube_video_title: string | null;
  email_subject_line: string | null;
  meta_media_link: string | null;
  meta_copy: string | null;
}

export const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22
export const QUARTERS = [0, 15, 30, 45] as const;
export const SLOT_HEIGHT_PX = 14; // per 15-minute slot (compact)

export function snapTo15(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export const VIDEO_STAGES = ["idea", "scheduled", "ready_to_edit", "ready_to_post"] as const;
export type VideoStage = (typeof VIDEO_STAGES)[number];
export const VIDEO_STAGE_LABEL: Record<VideoStage, string> = {
  idea: "Idea",
  scheduled: "Scheduled",
  ready_to_edit: "Ready to Edit",
  ready_to_post: "Ready to Post",
};
