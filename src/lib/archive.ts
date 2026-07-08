export const ARCHIVE_CONTENT_TYPES = [
  "Social Graphic",
  "Flyer",
  "Email Template",
  "Video",
  "Photo",
  "Print Piece",
  "Ad Creative",
  "Story",
  "Other",
] as const;
export type ArchiveContentType = (typeof ARCHIVE_CONTENT_TYPES)[number];

export const ARCHIVE_PLATFORMS = ["YouTube", "Meta", "Mailchimp", "Blog"] as const;
export type ArchivePlatform = (typeof ARCHIVE_PLATFORMS)[number];

export const ARCHIVE_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "type", label: "Content type" },
  { value: "agent", label: "Agent name" },
] as const;
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number]["value"];

export interface ArchiveItem {
  id: string;
  title: string;
  file_url: string | null;
  file_path: string | null;
  drive_url: string | null;
  file_type: string | null;
  content_type: string;
  platforms: string[];
  agent_name: string | null;
  listing_address: string | null;
  date_created: string;
  campaign_tag: string | null;
  notes: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  brand: "LOZ" | "PP" | "AON" | "MSREG ALL";
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isImage(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  return /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(fileType);
}

export function isPdf(fileType: string | null | undefined): boolean {
  return !!fileType && /pdf/i.test(fileType);
}

// Free total storage available for the bucket (visual indicator only).
export const ARCHIVE_STORAGE_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB
