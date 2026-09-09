export type VendorRegion = "st_robert_rolla" | "lake_of_the_ozarks" | string;
export type VendorStatus = "active" | "flagged" | "archived";
export type VendorRequestType = "add" | "remove" | "flag";
export type VendorRequestStatus = "pending" | "approved" | "rejected";

export interface VendorCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface Vendor {
  id: string;
  category_id: string;
  region: VendorRegion;
  name: string;
  primary_contact: string | null;
  phone: string;
  email: string | null;
  website: string | null;
  specialty_notes: string | null;
  is_preferred: boolean;
  status: VendorStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Join helper
  category?: VendorCategory;
}

export interface VendorRequest {
  id: string;
  request_type: VendorRequestType;
  status: VendorRequestStatus;
  vendor_id: string | null;
  vendor_name: string;
  region: VendorRegion | null;
  category_id: string | null;
  primary_contact: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  specialty_notes: string | null;
  reason: string;
  agent_name: string;
  agent_email: string;
  user_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const VENDOR_REGIONS: { key: string; label: string; shortLabel: string }[] = [
  { key: "st_robert_rolla", label: "St. Robert / Rolla Region", shortLabel: "St. Robert / Rolla" },
  { key: "lake_of_the_ozarks", label: "Lake of the Ozarks Region", shortLabel: "Lake of the Ozarks" },
];

export function getRegionLabel(regionKey: string): string {
  const match = VENDOR_REGIONS.find((r) => r.key === regionKey);
  return match ? match.label : regionKey;
}

export function getRegionShortLabel(regionKey: string): string {
  const match = VENDOR_REGIONS.find((r) => r.key === regionKey);
  return match ? match.shortLabel : regionKey;
}

/**
 * Clean and format phone number for clickable display (e.g. 573-555-1234)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Filter vendors helper
 */
export function filterVendors(
  vendors: Vendor[],
  query: string,
  regionFilter: string,
  categoryFilter: string,
): Vendor[] {
  const q = query.trim().toLowerCase();

  return vendors.filter((v) => {
    // Region filter
    if (regionFilter !== "all" && v.region !== regionFilter) {
      return false;
    }

    // Category filter
    if (categoryFilter !== "all" && v.category_id !== categoryFilter) {
      return false;
    }

    // Query filter
    if (q) {
      const matchName = v.name.toLowerCase().includes(q);
      const matchContact = (v.primary_contact || "").toLowerCase().includes(q);
      const matchPhone = v.phone.toLowerCase().includes(q);
      const matchEmail = (v.email || "").toLowerCase().includes(q);
      const matchNotes = (v.specialty_notes || "").toLowerCase().includes(q);
      const matchCat = (v.category?.name || "").toLowerCase().includes(q);

      if (!matchName && !matchContact && !matchPhone && !matchEmail && !matchNotes && !matchCat) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Export Vendors to CSV string
 */
export function exportVendorsToCsv(vendors: Vendor[], categories: VendorCategory[]): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const headers = [
    "Region",
    "Category",
    "Vendor Name",
    "Primary Contact",
    "Phone",
    "Email",
    "Website",
    "Specialty / Notes",
    "Is Preferred",
    "Status",
  ];

  const rows = vendors.map((v) => {
    const regionName = getRegionShortLabel(v.region);
    const catName = catMap.get(v.category_id) || v.category?.name || "Other";
    return [
      `"${regionName.replace(/"/g, '""')}"`,
      `"${catName.replace(/"/g, '""')}"`,
      `"${v.name.replace(/"/g, '""')}"`,
      `"${(v.primary_contact || "").replace(/"/g, '""')}"`,
      `"${v.phone.replace(/"/g, '""')}"`,
      `"${(v.email || "").replace(/"/g, '""')}"`,
      `"${(v.website || "").replace(/"/g, '""')}"`,
      `"${(v.specialty_notes || "").replace(/"/g, '""')}"`,
      v.is_preferred ? "Yes" : "No",
      v.status,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}
