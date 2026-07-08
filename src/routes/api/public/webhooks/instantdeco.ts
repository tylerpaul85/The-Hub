import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook endpoint for InstantDecoAI async job completion.
 *
 * Public URL (use this when calling InstantDecoAI's `webhook_url`):
 *   https://project--99af75db-2b9c-4961-9fe4-dcfbcccedaea.lovable.app/api/public/webhooks/instantdeco
 *
 * InstantDecoAI POSTs a JSON body containing a `request_id` we issued when
 * creating the job, plus the generated image URLs. We match the request_id
 * back to the corresponding `staging_jobs` row and mark it done.
 *
 * Always returns 200 so InstantDecoAI does not retry endlessly, even on
 * internal failures (those are logged and recorded on the job row).
 */

type AnyRecord = Record<string, unknown>;

function pickString(obj: AnyRecord | undefined, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

const isHttpUrl = (v: unknown): v is string =>
  typeof v === "string" && /^https?:\/\//i.test(v);

function collectImageUrls(payload: AnyRecord): string[] {
  const urls: string[] = [];

  const push = (val: unknown) => {
    if (isHttpUrl(val)) {
      urls.push(val);
    } else if (val && typeof val === "object") {
      const u = pickString(
        val as AnyRecord,
        "url",
        "image_url",
        "output_url",
        "output",
        "src",
      );
      if (u && isHttpUrl(u)) urls.push(u);
    }
  };

  // Per InstantDecoAI docs the success webhook is
  // `{ "output": "https://...", "status": "succeeded", "request_id": "..." }`
  // The `output` key is the primary source — only treat it as a URL when it
  // actually looks like one (on failure it can be a literal like "base64").
  const singleKeys = ["output", "image_url", "output_url", "url"];
  for (const k of singleKeys) {
    const v = payload[k];
    if (isHttpUrl(v)) urls.push(v);
  }

  const arrayCandidates: unknown[] = [
    payload.images,
    payload.results,
    payload.outputs,
    (payload.response as AnyRecord | undefined)?.images,
    (payload.response as AnyRecord | undefined)?.results,
    (payload.response as AnyRecord | undefined)?.outputs,
    (payload.data as AnyRecord | undefined)?.images,
    (payload.data as AnyRecord | undefined)?.results,
    (payload.data as AnyRecord | undefined)?.outputs,
  ];
  for (const c of arrayCandidates) {
    if (Array.isArray(c)) c.forEach(push);
  }

  // Nested single keys
  for (const nest of [payload.response, payload.data] as Array<
    AnyRecord | undefined
  >) {
    if (!nest || typeof nest !== "object") continue;
    for (const k of singleKeys) {
      const v = nest[k];
      if (isHttpUrl(v)) urls.push(v);
    }
  }

  return Array.from(new Set(urls));
}

export const Route = createFileRoute("/api/public/webhooks/instantdeco")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const queryJobId = url.searchParams.get("job_id");
        const rawBody = await request.text();

        console.log("[instantdeco-webhook] FULL RAW BODY:", rawBody);

        console.log("[instantdeco-webhook] POST received", {
          queryJobId,
          contentType: request.headers.get("content-type"),
          bodyLength: rawBody.length,
          rawBody: rawBody.slice(0, 4000),
        });

        let payload: AnyRecord = {};
        try {
          payload = JSON.parse(rawBody) as AnyRecord;
        } catch {
          console.error("[instantdeco-webhook] invalid JSON body", {
            queryJobId,
            rawBody: rawBody.slice(0, 1000),
          });
          return new Response("ok", { status: 200 });
        }

        console.log("[instantdeco-webhook] parsed payload structure", {
          topLevelKeys: Object.keys(payload),
          payload,
        });

        const requestId =
          pickString(payload, "request_id", "requestId", "id") ??
          pickString(payload.data as AnyRecord | undefined, "request_id", "requestId", "id") ??
          pickString(payload.response as AnyRecord | undefined, "request_id", "requestId", "id");

        const status = (
          pickString(payload, "status", "state") ??
          pickString(payload.data as AnyRecord | undefined, "status", "state") ??
          ""
        ).toLowerCase();

        const errorMessage =
          pickString(payload, "error", "error_message", "message") ??
          pickString(payload.data as AnyRecord | undefined, "error", "error_message", "message");

        const urls = collectImageUrls(payload);

        console.log("[instantdeco-webhook] extracted", {
          requestId,
          status,
          errorMessage,
          urlCount: urls.length,
          urls,
        });

        if (urls.length === 0) {
          console.warn(
            "[instantdeco-webhook] no image URLs extracted — full payload for inspection:",
            JSON.stringify(payload).slice(0, 4000),
          );
        }

        if (!requestId) {
          console.error("[instantdeco-webhook] missing request_id in payload", {
            queryJobId,
            payload,
          });
          // Fall back to query-string job_id if InstantDecoAI omits request_id
          if (!queryJobId) {
            return new Response("ok", { status: 200 });
          }
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const lookup = supabaseAdmin
            .from("staging_jobs")
            .select("id, status");
          const { data: job, error: findErr } = await (requestId
            ? lookup.eq("instantdeco_request_id", requestId)
            : lookup.eq("id", queryJobId!)
          ).maybeSingle();

          if (findErr) {
            console.error("[instantdeco-webhook] lookup failed", findErr.message);
            return new Response("ok", { status: 200 });
          }
          if (!job) {
            console.error("[instantdeco-webhook] no job found", { requestId, queryJobId });
            return new Response("ok", { status: 200 });
          }

          const successStatuses = new Set([
            "succeeded",
            "success",
            "complete",
            "completed",
            "done",
            "ok",
          ]);
          const failureStatuses = new Set([
            "error",
            "failed",
            "failure",
            "fail",
          ]);

          const isExplicitSuccess = successStatuses.has(status);
          const isFailure =
            failureStatuses.has(status) ||
            (!!errorMessage && !isExplicitSuccess);

          if (isFailure || (!isExplicitSuccess && urls.length === 0)) {
            const msg =
              errorMessage ??
              (urls.length === 0
                ? `InstantDecoAI returned no image URLs (status: ${status || "unknown"})`
                : `InstantDecoAI reported status: ${status}`);
            const { error: updErr } = await supabaseAdmin
              .from("staging_jobs")
              .update({
                status: "error",
                error_message: msg.slice(0, 1000),
              })
              .eq("id", job.id);
            if (updErr) {
              console.error(
                "[instantdeco-webhook] error-update failed",
                updErr.message,
              );
            }
            return new Response("ok", { status: 200 });
          }

          const { error: updErr } = await supabaseAdmin
            .from("staging_jobs")
            .update({
              status: "done",
              result_urls: urls,
              error_message: null,
            })
            .eq("id", job.id);

          if (updErr) {
            console.error("[instantdeco-webhook] success-update failed", updErr.message);
          }
        } catch (err) {
          console.error(
            "[instantdeco-webhook] unexpected error",
            err instanceof Error ? err.message : String(err),
          );
        }

        return new Response("ok", { status: 200 });
      },

      // Some providers send a GET to verify the URL is reachable.
      GET: async () =>
        new Response("InstantDecoAI webhook is live", { status: 200 }),
    },
  },
});
