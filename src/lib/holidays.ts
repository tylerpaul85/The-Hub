// Holiday data for calendar banners
export type HolidayType = "federal" | "realestate" | "social";

export interface Holiday {
  name: string;
  type: HolidayType;
}

// Helpers for floating holidays
const nthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number) => {
  // month: 0-11, weekday: 0=Sun..6=Sat, n: 1..5
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
};

const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Fixed-date holidays: month (0-11), day, name, type
const FIXED: Array<{ m: number; d: number; name: string; type: HolidayType }> = [
  { m: 0, d: 1, name: "New Year's Day", type: "federal" },
  { m: 5, d: 19, name: "Juneteenth", type: "federal" },
  { m: 6, d: 4, name: "Independence Day", type: "federal" },
  { m: 10, d: 11, name: "Veterans Day", type: "federal" },
  { m: 11, d: 25, name: "Christmas Day", type: "federal" },
  // Social / fun
  { m: 1, d: 14, name: "Valentine's Day", type: "social" },
  { m: 2, d: 17, name: "St. Patrick's Day", type: "social" },
  { m: 9, d: 31, name: "Halloween", type: "social" },
  { m: 8, d: 29, name: "National Coffee Day", type: "social" },
  { m: 0, d: 4, name: "National Trivia Day", type: "social" },
  { m: 6, d: 17, name: "World Emoji Day", type: "social" },
  { m: 7, d: 8, name: "International Cat Day", type: "social" },
  { m: 7, d: 26, name: "National Dog Day", type: "social" },
  { m: 3, d: 22, name: "Earth Day", type: "social" },
  // Real estate fixed
  { m: 5, d: 6, name: "National Moving Day", type: "realestate" },
];

// Month-long observances: only show on day 1
const MONTHLY: Record<number, Array<{ name: string; type: HolidayType }>> = {
  3: [{ name: "Fair Housing Month", type: "realestate" }],
  5: [{ name: "National Homeownership Month", type: "realestate" }],
};

export function getHolidaysForDate(date: Date): Holiday[] {
  const out: Holiday[] = [];
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  // Month-long observances on the 1st
  if (d === 1 && MONTHLY[m]) {
    out.push(...MONTHLY[m]);
  }

  // Fixed
  for (const h of FIXED) {
    if (h.m === m && h.d === d) out.push({ name: h.name, type: h.type });
  }

  // Floating federal
  // MLK Day — 3rd Monday of January
  if (sameDay(date, nthWeekdayOfMonth(y, 0, 1, 3))) out.push({ name: "Martin Luther King Jr. Day", type: "federal" });
  // Presidents Day — 3rd Monday of February
  if (sameDay(date, nthWeekdayOfMonth(y, 1, 1, 3))) out.push({ name: "Presidents Day", type: "federal" });
  // Memorial Day — last Monday of May
  if (sameDay(date, lastWeekdayOfMonth(y, 4, 1))) out.push({ name: "Memorial Day", type: "federal" });
  // Labor Day — 1st Monday of September
  if (sameDay(date, nthWeekdayOfMonth(y, 8, 1, 1))) out.push({ name: "Labor Day", type: "federal" });
  // Columbus Day — 2nd Monday of October
  if (sameDay(date, nthWeekdayOfMonth(y, 9, 1, 2))) out.push({ name: "Columbus Day", type: "federal" });
  // Thanksgiving — 4th Thursday of November
  if (sameDay(date, nthWeekdayOfMonth(y, 10, 4, 4))) out.push({ name: "Thanksgiving Day", type: "federal" });

  // Floating social / real estate
  // Mother's Day — 2nd Sunday of May
  if (sameDay(date, nthWeekdayOfMonth(y, 4, 0, 2))) out.push({ name: "Mother's Day", type: "social" });
  // Father's Day — 3rd Sunday of June
  if (sameDay(date, nthWeekdayOfMonth(y, 5, 0, 3))) out.push({ name: "Father's Day", type: "social" });
  // Small Business Saturday — Saturday after Thanksgiving
  const thx = nthWeekdayOfMonth(y, 10, 4, 4);
  const sbs = new Date(thx); sbs.setDate(thx.getDate() + 2);
  if (sameDay(date, sbs)) out.push({ name: "Small Business Saturday", type: "social" });
  // Black Friday
  const bf = new Date(thx); bf.setDate(thx.getDate() + 1);
  if (sameDay(date, bf)) out.push({ name: "Black Friday", type: "social" });
  // National Open House Day — 1st Saturday of May (NAR observance)
  if (sameDay(date, nthWeekdayOfMonth(y, 4, 6, 1))) out.push({ name: "National Open House Day", type: "realestate" });

  return out;
}

export const HOLIDAY_TYPE_CLASS: Record<HolidayType, string> = {
  federal: "bg-gold/20 text-gold border-gold/40",
  realestate: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  social: "bg-muted/60 text-muted-foreground border-border",
};

export const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  federal: "Federal",
  realestate: "Real Estate",
  social: "Social",
};
