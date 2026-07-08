import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WEBHOOK_URL =
  "https://project--99af75db-2b9c-4961-9fe4-dcfbcccedaea.lovable.app/api/public/webhooks/instantdeco";

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const inputSchema = z.object({
  job_id: z.string().uuid(),
  source_image_url: z.string().url(),
  room_type: z.string().min(1).max(64),
  style: z.string().min(1).max(64),
  num_images: z.number().int().min(1).max(8).optional(),
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const stageRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { job_id, source_image_url, room_type, style } = data;
    const num_images = data.num_images ?? 2;

    const { data: job, error: fetchErr } = await supabase
      .from("staging_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!job) throw new Error("Staging job not found");

    const prompt = `Furnish this ${room_type.replace(/_/g, " ")} in ${style} style.`;

    await supabase
      .from("staging_jobs")
      .update({
        status: "processing",
        prompt,
        room_type,
        style,
        source_image_url,
        error_message: null,
        result_urls: null,
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

    const requestBody = {
      transformation_type: "furnish",
      design: style,
      room_type,
      block_element: "wall,floor,ceiling,windowpane,door",
      img_url: source_image_url,
      num_images,
      high_details_resolution: true,
      // Webhook still required by InstantDecoAI; it updates the row we poll below.
      webhook_url: `${WEBHOOK_URL}?job_id=${job_id}`,
    };

    console.log("[stage-room] → InstantDecoAI request", { job_id, body: requestBody });

    let requestId: string | null = null;
    try {
      const resp = await fetch("https://app.instantdeco.ai/api/1.1/wf/request_v2", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const text = await resp.text();
      console.log("[stage-room] ← InstantDecoAI response", {
        job_id,
        status: resp.status,
        ok: resp.ok,
        bodyPreview: text.slice(0, 2000),
      });
      if (!resp.ok) {
        throw new Error(`InstantDecoAI ${resp.status}: ${text.slice(0, 500)}`);
      }
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {}
      requestId =
        parsed?.request_id ??
        parsed?.response?.request_id ??
        parsed?.data?.request_id ??
        null;
      console.log("[stage-room] extracted request_id", { job_id, requestId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[stage-room] submit failed", { job_id, message });
      const { data: errJob } = await supabase
        .from("staging_jobs")
        .update({ status: "error", error_message: message.slice(0, 1000) })
        .eq("id", job_id)
        .select("*")
        .single();
      return errJob ?? { id: job_id, status: "error", error_message: message };
    }

    await supabase
      .from("staging_jobs")
      .update({ instantdeco_request_id: requestId ? String(requestId) : null })
      .eq("id", job_id);

    // Poll the staging_jobs row — the webhook handler flips it to done/error
    // when InstantDecoAI calls back. This gives the UI a single round-trip.
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let pollCount = 0;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      pollCount += 1;
      const { data: current, error: pollErr } = await supabase
        .from("staging_jobs")
        .select("*")
        .eq("id", job_id)
        .single();
      if (pollErr) {
        console.error("[stage-room] poll error", { job_id, message: pollErr.message });
        continue;
      }
      if (current.status === "done" || current.status === "error") {
        console.log("[stage-room] poll complete", {
          job_id,
          pollCount,
          status: current.status,
          resultCount: Array.isArray(current.result_urls) ? current.result_urls.length : 0,
        });
        return current;
      }
    }

    console.warn("[stage-room] poll timeout", { job_id, requestId, pollCount });
    const { data: timedOut } = await supabase
      .from("staging_jobs")
      .update({
        status: "error",
        error_message: `Timed out waiting for InstantDecoAI after ${Math.round(POLL_TIMEOUT_MS / 1000)}s`,
      })
      .eq("id", job_id)
      .eq("status", "processing")
      .select("*")
      .maybeSingle();
    if (timedOut) return timedOut;
    // If status changed between the last poll and now, return latest
    const { data: latest } = await supabase
      .from("staging_jobs")
      .select("*")
      .eq("id", job_id)
      .single();
    return latest;
  });
