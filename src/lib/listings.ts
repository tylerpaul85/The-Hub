import { differenceInDays, parseISO } from "date-fns";

// ─── Status ──────────────────────────────────────────────────────────────────

export const LISTING_STATUSES = ["active", "under_contract", "sold"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  active: "Active",
  under_contract: "Under Contract",
  sold: "Sold",
};

export const LISTING_STATUS_CLASS: Record<ListingStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  under_contract: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sold: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── Post type ───────────────────────────────────────────────────────────────

export const POST_TYPES = ["active", "repost_60", "repost_90", "repost_120", "under_contract", "manual"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  active: "Just Listed",
  repost_60: "60-Day Repost",
  repost_90: "90-Day Repost",
  repost_120: "120-Day Repost",
  under_contract: "Under Contract",
  manual: "Manual Post",
};

export const POST_TYPE_CLASS: Record<PostType, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  repost_60: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  repost_90: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  repost_120: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  under_contract: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  manual: "bg-muted text-muted-foreground border-border",
};

// ─── Post status ─────────────────────────────────────────────────────────────

export const POST_STATUSES = ["scheduled", "posted", "cancelled"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  scheduled: "Scheduled",
  posted: "Posted",
  cancelled: "Cancelled",
};

export const POST_STATUS_CLASS: Record<PostStatus, string> = {
  scheduled: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  posted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── Data types ───────────────────────────────────────────────────────────────

export type Listing = {
  id: string;
  address: string;
  agent_id: string | null;
  agent_name: string | null;
  mls_id: string | null;
  list_price: number | null;
  list_date: string;    // ISO date YYYY-MM-DD
  post_date: string;    // When listing goes live / initial post date
  post_time: string;    // HH:MM:SS
  canva_link: string | null;
  status: ListingStatus;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ListingGraphic = {
  id: string;
  listing_id: string;
  image_url: string;
  label: string | null;
  created_at: string;
};

export type ListingCopy = {
  id: string;
  listing_id: string;
  social_media_copy: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingPost = {
  id: string;
  listing_id: string;
  scheduled_date: string;
  post_type: PostType;
  graphic_url: string | null;
  copy: string | null;
  calendar_entry_id: string | null;
  status: PostStatus;
  created_at: string;
};

export type ListingVideo = {
  id: string;
  listing_id: string;
  drive_url: string;
  label: string | null;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function calcDaysListed(listDate: string): number {
  try {
    return differenceInDays(new Date(), parseISO(listDate));
  } catch {
    return 0;
  }
}

export function formatPrice(price: number | null): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

export type CsvParseResult = {
  valid: ParsedListing[];
  errors: { row: number; message: string }[];
};

export type ParsedListing = {
  address: string;
  agent_name: string;
  mls_id: string | null;
  list_price: number | null;
  list_date: string;
  status: ListingStatus;
};

export function parseCsvListings(csv: string): CsvParseResult {
  const valid: ParsedListing[] = [];
  const errors: { row: number; message: string }[] = [];

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { valid, errors };

  // Detect header row
  const firstLower = lines[0].toLowerCase();
  const hasHeader = firstLower.includes("address") || firstLower.includes("agent") || firstLower.includes("mls");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i++) {
    const rawRow = i + (hasHeader ? 2 : 1);
    const cols = splitCsvRow(dataLines[i]);

    const [rawAddress, rawAgent, rawMls, rawPrice, rawDate, rawStatus] = cols;

    const address = (rawAddress ?? "").trim();
    const agentName = (rawAgent ?? "").trim();
    const mlsId = (rawMls ?? "").trim() || null;
    const rawPriceStr = (rawPrice ?? "").trim().replace(/[$,\s]/g, "");
    const listPrice = rawPriceStr ? parseFloat(rawPriceStr) : null;
    const listDate = parseFlexDate(rawDate ?? "");
    const rawStatusStr = ((rawStatus ?? "").trim().toLowerCase().replace(/\s+/g, "_")) as string;
    const status: ListingStatus = LISTING_STATUSES.includes(rawStatusStr as ListingStatus)
      ? (rawStatusStr as ListingStatus)
      : "active";

    if (!address) {
      errors.push({ row: rawRow, message: "Address is required" });
      continue;
    }
    if (!agentName) {
      errors.push({ row: rawRow, message: `Row ${rawRow}: Agent name is required` });
      continue;
    }
    if (!listDate) {
      errors.push({ row: rawRow, message: `Row ${rawRow}: Invalid or missing list date` });
      continue;
    }

    valid.push({ address, agent_name: agentName, mls_id: mlsId, list_price: listPrice, list_date: listDate, status });
  }

  return { valid, errors };
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseFlexDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  // Try Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
