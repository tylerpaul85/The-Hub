import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

export const Route = createFileRoute("/api/public/hooks/scorecard-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify shared secret to prevent unauthorized invocation.
        // Set CRON_HOOK_SECRET in your hosting environment and pass it
        // as an Authorization: Bearer <secret> header from your cron trigger.
        const hookSecret = process.env.CRON_HOOK_SECRET;
        if (hookSecret) {
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) {
            return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          // Timing-safe comparison to prevent timing attacks
          const a = Buffer.from(token);
          const b = Buffer.from(hookSecret);
          if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("send_scorecard_weekly_reminders");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, notified: data ?? 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
