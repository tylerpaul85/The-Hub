import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  title: z.string(),
  brand: z.string().nullable().optional(),
  platforms: z.array(z.string()),
  status: z.string(),
  scheduled_date: z.string(),
  scheduled_time: z.string(),
  priority: z.string(),
  notes: z.string().nullable().optional(),
});

const InputSchema = z.object({
  scope: z.enum(["week", "month"]),
  rangeStart: z.string(),
  rangeEnd: z.string(),
  currentDate: z.string(),
  emptyDays: z.array(z.string()),
  holidays: z.array(z.object({ date: z.string(), name: z.string() })),
  items: z.array(ItemSchema),
});


export type Recommendation = {
  title: string;
  description: string;
  category: "Gap" | "Variety" | "Timing" | "Opportunity";
  suggested_date?: string | null;
};

export const analyzeCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const system = `You are an experienced real estate social media strategist reviewing a marketing team's content calendar.

BRAND / PAGE CONTEXT (critical):
- Each content item has a "brand" field representing which Facebook page(s) it posts to.
- "LOZ" = the MSREG LOZ Facebook page.
- "PP" = the MSREG PP Facebook page.
- LOZ and PP are TWO SEPARATE pages, each needing its own steady stream of content.
- "MSREG ALL" means the post goes to BOTH MSREG pages (LOZ and PP).
- When identifying content gaps, treat LOZ and PP as distinct audiences. An item branded "MSREG ALL" counts as content for both LOZ and PP. An item branded "LOZ" only feeds LOZ; an item branded "PP" only feeds PP.
- "AON" content has already been filtered out and is not in your data. Do NOT mention AON, do NOT recommend anything about AON, and do NOT ask about it. It is handled separately.

WHAT TO RECOMMEND (content substance only):
Focus exclusively on the SUBSTANCE of the content — what is being posted and what is missing in terms of topics, themes, and ideas. Examples of good recommendations:
- Content topics or themes that are absent and should be added (e.g. "no neighborhood spotlights for LOZ this month").
- Seasonal moments, local events, or holidays the team may not be planning for that fit the brand.
- Balance/variety suggestions tied to subject matter (e.g. "lots of listing promos on PP, consider adding more educational/buyer-tip content").
- Page-specific gaps (e.g. "LOZ has 8 posts but PP only has 2 — PP needs more dedicated content or MSREG ALL posts").

WHAT NOT TO RECOMMEND (do NOT do these):
- Do NOT comment on posting TIMES, time of day, or scheduling cadence.
- Do NOT comment on posting FREQUENCY (how often things post, daily/weekly rhythm).
- Do NOT recommend changing when something is posted.
- Do NOT recommend spacing posts out or clustering them.
- The "Timing" category is essentially off-limits unless it's about a missed seasonal/event content opportunity (in which case prefer "Opportunity" or "Gap").

Be specific. Reference actual dates, brands (LOZ / PP / MSREG ALL), and platforms from the data.

Respond ONLY with a JSON array. No preamble, no markdown code fences, no explanatory text.
Each item must have this shape: { "title": string, "description": string, "category": "Gap"|"Variety"|"Timing"|"Opportunity", "suggested_date"?: "YYYY-MM-DD" }`;

    const userPayload = {
      scope: data.scope,
      range: { start: data.rangeStart, end: data.rangeEnd },
      current_date: data.currentDate,
      empty_days: data.emptyDays,
      holidays: data.holidays,
      items: data.items,
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system,
        messages: [
          { role: "user", content: `Here is the content calendar data to analyze:\n\n${JSON.stringify(userPayload, null, 2)}\n\nReturn ONLY the JSON array.` },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    const content = json.content?.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("") ?? "";

    let recommendations: Recommendation[] = [];
    const tryParse = (s: string) => {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return null;
    };

    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed = tryParse(cleaned);
    if (!parsed) {
      // Extract first [...] block from the text.
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start !== -1 && end > start) parsed = tryParse(cleaned.slice(start, end + 1));
    }
    if (Array.isArray(parsed)) {
      recommendations = parsed.filter(
        (r) => r && typeof r.title === "string" && typeof r.description === "string",
      );
    }

    if (recommendations.length === 0) {
      console.error("[analyze-calendar] no recs parsed", {
        stop_reason: json.stop_reason,
        preview: content.slice(0, 400),
      });
    }


    return { recommendations, generatedAt: new Date().toISOString() };
  });

