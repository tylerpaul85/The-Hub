import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SyncEventSchema = z.object({
  eventId: z.string().uuid(),
  organizerEmail: z.string().email().optional(),
});

export const syncEventToGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SyncEventSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const canManage = (roleRows ?? []).some(
      (r: any) => r.role === "admin" || r.role === "marketing_coordinator",
    );
    if (!canManage) throw new Error("Forbidden: Admin or Marketing Coordinator required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Fetch event
    const { data: event, error: evErr } = await sb
      .from("special_events")
      .select("*")
      .eq("id", data.eventId)
      .single();
    if (evErr || !event) throw new Error(evErr?.message || "Event not found");

    // Fetch confirmed attendees
    const { data: signups = [] } = await sb
      .from("special_event_signups")
      .select("user_id, status")
      .eq("event_id", data.eventId)
      .eq("status", "confirmed");

    const userIds = signups.map((s: any) => s.user_id);
    let attendeeEmails: string[] = [];
    if (userIds.length > 0) {
      const { data: userProfiles = [] } = await sb
        .from("profiles")
        .select("email")
        .in("id", userIds);
      attendeeEmails = userProfiles.map((p: any) => p.email).filter(Boolean);
    }

    const keyString = process.env.GOOGLE_SA_KEY_JSON;
    if (!keyString) {
      return {
        synced: false,
        warning: "Missing Google Service Account key in environment variables (GOOGLE_SA_KEY_JSON).",
      };
    }

    let key: any;
    try {
      key = JSON.parse(keyString);
    } catch {
      try {
        key = JSON.parse(keyString.replace(/\\n/g, "\n"));
      } catch {
        throw new Error("Failed to parse GOOGLE_SA_KEY_JSON environment variable.");
      }
    }

    const { google } = await import("googleapis");
    const organizer = data.organizerEmail || "marketing@mattsmithrealestategroup.com";

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ["https://www.googleapis.com/auth/calendar"],
      organizer,
    );

    const calendar = google.calendar({ version: "v3", auth });

    // Construct start & end dates
    const dateStr = event.event_date;
    const startTimeStr = event.start_time ? event.start_time.slice(0, 5) : "09:00";
    const endTimeStr = event.end_time ? event.end_time.slice(0, 5) : "10:00";

    const startDateTime = `${dateStr}T${startTimeStr}:00`;
    const endDateTime = `${dateStr}T${endTimeStr}:00`;

    const gcalPayload: any = {
      summary: event.title,
      description: event.description || "",
      location: event.location || "",
      start: {
        dateTime: `${startDateTime}-05:00`, // Central Time offset
        timeZone: "America/Chicago",
      },
      end: {
        dateTime: `${endDateTime}-05:00`,
        timeZone: "America/Chicago",
      },
      attendees: attendeeEmails.map((email) => ({ email })),
    };

    let googleEventId = event.google_event_id;

    try {
      if (googleEventId) {
        // Update existing event
        const res = await calendar.events.update({
          calendarId: "primary",
          eventId: googleEventId,
          requestBody: gcalPayload,
          sendUpdates: "all",
        });
        googleEventId = res.data.id || googleEventId;
      } else {
        // Create new event
        const res = await calendar.events.insert({
          calendarId: "primary",
          requestBody: gcalPayload,
          sendUpdates: "all",
        });
        googleEventId = res.data.id || null;
      }

      // Update Supabase event row
      await sb
        .from("special_events")
        .update({
          google_event_id: googleEventId,
          sync_google_calendar: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      // Mark signups as synced
      if (userIds.length > 0) {
        await sb
          .from("special_event_signups")
          .update({ google_calendar_synced: true })
          .eq("event_id", event.id)
          .in("user_id", userIds);
      }

      return {
        synced: true,
        googleEventId,
        attendeesCount: attendeeEmails.length,
      };
    } catch (err: any) {
      console.error("[special-events] Google Calendar sync error:", err);
      return {
        synced: false,
        warning: `Google Calendar API error: ${err.message || String(err)}`,
      };
    }
  });
