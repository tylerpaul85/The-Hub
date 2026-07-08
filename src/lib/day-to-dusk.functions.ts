import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WEBHOOK_URL =
  "https://project--99af75db-2b9c-4961-9fe4-dcfbcccedaea.lovable.app/api/public/webhooks/instantdeco";

const inputSchema = z.object({
  job_id: z.string().uuid(),
  source_image_url: z.string().url(),
  sky_style: z.string().min(1).max(64),
  num_images: z.number().int().min(1).max(8).optional(),
});

export const convertDayToDusk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { job_id, source_image_url, sky_style } = data;
    const num_images = data.num_images ?? 1;

    const { data: job, error: fetchErr } = await supabase
      .from("staging_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!job) throw new Error("Staging job not found");

    await supabase
      .from("staging_jobs")
      .update({
        status: "processing",
        prompt: `Day to ${sky_style} conversion`,
        room_type: "exterior",
        style: sky_style,
        source_image_url,
        error_message: null,
      })
      .eq("id", job_id);

    const apiKey = process.env.INSTANTDECO_API_KEY;
    if (!apiKey) {
      await supabase
        .from("staging_jobs")
        .update({ status: "error", error_message: "INSTANTDECO_API_KEY not configured" })
        .eq("id", job_id);
      throw new Error("INSTANTDECO_API_KEY not configured");
    }

    try {
      const resp = await fetch("https://app.instantdeco.ai/api/1.1/wf/request_v2", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transformation_type: "day_to_dusk",
          sky_style,
          img_url: source_image_url,
          num_images,
          high_details_resolution: true,
          webhook_url: `${WEBHOOK_URL}?job_id=${job_id}`,
        }),
      });

      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(`InstantDecoAI ${resp.status}: ${text.slice(0, 500)}`);
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        /* non-JSON ok if 200 */
      }
      const requestId =
        parsed?.request_id ??
        parsed?.response?.request_id ??
        parsed?.data?.request_id ??
        null;

      const { data: updated, error: updErr } = await supabase
        .from("staging_jobs")
        .update({ instantdeco_request_id: requestId ? String(requestId) : null })
        .eq("id", job_id)
        .select("*")
        .single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[day-to-dusk] failed", { job_id, message });
      const { data: updated } = await supabase
        .from("staging_jobs")
        .update({ status: "error", error_message: message.slice(0, 1000) })
        .eq("id", job_id)
        .select("*")
        .single();
      return updated ?? { id: job_id, status: "error", error_message: message };
    }
  });
