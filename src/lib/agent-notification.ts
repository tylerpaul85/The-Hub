import type { SupabaseClient } from "@supabase/supabase-js";

export interface Agent {
  id: string;
  name: string;
  email: string | null;
}

export function resolveAgent(
  agentName: string | null | undefined,
  agents: Agent[]
): Agent | null {
  if (!agentName) return null;
  const target = agentName.trim().toLowerCase();

  // 1. Exact match
  const exact = agents.find((a) => a.name.trim().toLowerCase() === target);
  if (exact) return exact;

  // 2. Middle initials stripped (e.g., "Tasha D McBride" -> "Tasha McBride")
  const stripInitials = (s: string) =>
    s.replace(/\b[a-z]\b\.?/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
  const targetNoInitials = stripInitials(target);
  const withoutInitialsMatch = agents.find(
    (a) => stripInitials(a.name) === targetNoInitials
  );
  if (withoutInitialsMatch) return withoutInitialsMatch;

  // 3. Known name pairs / nicknames
  const nicknames: Record<string, string[]> = {
    mike: ["michael"],
    michael: ["mike"],
    joe: ["joseph"],
    joseph: ["joe"],
    dan: ["daniel"],
    daniel: ["dan"],
    chris: ["christopher", "christina"],
  };

  const targetParts = target.split(/\s+/);
  const targetFirst = targetParts[0];
  const targetLast = targetParts[targetParts.length - 1];

  for (const a of agents) {
    const aParts = a.name.toLowerCase().trim().split(/\s+/);
    const aFirst = aParts[0];
    const aLast = aParts[aParts.length - 1];

    if (aLast === targetLast) {
      if (aFirst === targetFirst) return a;
      if (
        nicknames[targetFirst]?.includes(aFirst) ||
        nicknames[aFirst]?.includes(targetFirst)
      ) {
        return a;
      }
    }
  }

  // 4. Token containment (e.g. "Luis Aparicio" within "Luis Padilla Aparicio")
  const containsMatch = agents.find((a) => {
    const aLower = a.name.toLowerCase();
    return targetParts.every((part) => part.length > 1 && aLower.includes(part));
  });
  if (containsMatch) return containsMatch;

  return null;
}

export function generateEmailHtml(opts: {
  agentName: string;
  address: string;
  status: "scheduled" | "published";
  scheduledAt?: string | null;
  canvaLink?: string | null;
  websiteLink?: string | null;
}) {
  const isScheduled = opts.status === "scheduled";
  const badgeText = isScheduled ? "SCHEDULED" : "LIVE NOW";
  const badgeBg = isScheduled ? "#0284c7" : "#059669";
  const headline = isScheduled
    ? "Your Listing Post Has Been Scheduled"
    : "Your Listing Is Live on Social Media!";
  const subtext = isScheduled
    ? `A social media post for your listing at <strong>${opts.address}</strong> has been scheduled to post on social media.`
    : `Great news! A social media post for your listing at <strong>${opts.address}</strong> just went live on social media.`;

  const scheduledDateFormatted = opts.scheduledAt
    ? new Date(opts.scheduledAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "Upcoming on Content Calendar";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #334155; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: ${badgeBg}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">
                ${badgeText}
              </span>
              <h1 style="margin: 16px 0 0; font-size: 22px; font-weight: 700; color: #f8fafc; line-height: 1.3;">
                ${headline}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Hi ${opts.agentName},
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                ${subtext}
              </p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px;">
                      Property Address
                    </div>
                    <div style="font-size: 17px; font-weight: 700; color: #f1f5f9; margin-bottom: 14px;">
                      ${opts.address}
                    </div>
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px;">
                      ${isScheduled ? "Target Post Time" : "Status"}
                    </div>
                    <div style="font-size: 14px; color: #e2e8f0; font-weight: 500;">
                      ${isScheduled ? scheduledDateFormatted : "Published to Social Media"}
                    </div>
                  </td>
                </tr>
              </table>
              ${
                opts.websiteLink
                  ? `<div style="margin-bottom: 20px;">
                      <a href="${opts.websiteLink}" target="_blank" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                        View Listing Page
                      </a>
                    </div>`
                  : ""
              }
              <p style="margin: 28px 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                This is an automated notification from the MSREG Marketing Hub. If you have questions about this post, please contact the marketing team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © Matt Smith Real Estate Group · Marketing Hub
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface ProcessNotificationResult {
  ok: boolean;
  skipped?: boolean;
  sent?: boolean;
  reason?: string;
  agent_email?: string;
  agent_name?: string;
  resend_id?: string;
  agent_notified_at?: string;
  error?: string;
}

export async function processPostNotification(
  supabase: SupabaseClient<any, any, any>,
  params: {
    contentItemId: string;
    targetStatus?: string;
    oldStatus?: string;
    mockResendSend?: (payload: any) => Promise<{ ok: boolean; id?: string; error?: string }>;
  }
): Promise<ProcessNotificationResult> {
  const { contentItemId, targetStatus } = params;

  // 1. Fetch current content_item row
  const { data: item, error: itemErr } = await supabase
    .from("content_items")
    .select("id, status, scheduled_at, agent_notified_at, title, canva_link, link")
    .eq("id", contentItemId)
    .maybeSingle();

  if (itemErr) throw new Error(itemErr.message);
  if (!item) return { ok: false, error: "Content item not found" };

  // 2. HARD IDEMPOTENCY GUARD: Never send twice
  if (item.agent_notified_at) {
    return {
      ok: true,
      skipped: true,
      reason: "Agent already notified",
      agent_notified_at: item.agent_notified_at,
    };
  }

  // 3. Status Transition Verification
  const currentStatus = (targetStatus || item.status) as "scheduled" | "published";
  if (currentStatus !== "scheduled" && currentStatus !== "published") {
    return {
      ok: true,
      skipped: true,
      reason: `Status is '${currentStatus}', not scheduled or published`,
    };
  }

  // 4. Find linked listing via listing_posts
  const { data: postRow, error: postErr } = await supabase
    .from("listing_posts")
    .select("id, listing_id, post_type")
    .eq("calendar_entry_id", contentItemId)
    .maybeSingle();

  if (postErr) throw new Error(postErr.message);

  if (!postRow || !postRow.listing_id) {
    await supabase.from("agent_notification_logs").insert({
      content_item_id: contentItemId,
      post_status: currentStatus,
      notification_type: currentStatus,
      status: "skipped",
      error_message: "Post is not tied to a listing (general content calendar post)",
    });
    return { ok: true, skipped: true, reason: "Not a listing post" };
  }

  // 5. Fetch listing details
  const { data: listing, error: listErr } = await supabase
    .from("listings")
    .select("id, address, agent_name, agent_id, canva_link, website_link")
    .eq("id", postRow.listing_id)
    .single();

  if (listErr || !listing) {
    await supabase.from("agent_notification_logs").insert({
      content_item_id: contentItemId,
      listing_id: postRow.listing_id,
      post_status: currentStatus,
      notification_type: currentStatus,
      status: "failed",
      error_message: `Failed to find listing with ID ${postRow.listing_id}`,
    });
    return { ok: false, error: "Listing not found" };
  }

  // 6. Resolve agent email from toolbox_agents
  const { data: agents } = await supabase
    .from("toolbox_agents")
    .select("id, name, email");

  let matchedAgent: Agent | null = null;
  if (listing.agent_id && agents) {
    matchedAgent = agents.find((a: Agent) => a.id === listing.agent_id) ?? null;
  }
  if (!matchedAgent && listing.agent_name && agents) {
    matchedAgent = resolveAgent(listing.agent_name, agents);
  }

  if (!matchedAgent || !matchedAgent.email) {
    const errReason = `Could not resolve agent email for listing agent "${listing.agent_name || "Unknown"}"`;
    await supabase.from("agent_notification_logs").insert({
      content_item_id: contentItemId,
      listing_id: listing.id,
      agent_name: listing.agent_name,
      post_status: currentStatus,
      notification_type: currentStatus,
      status: "failed",
      error_message: errReason,
    });
    return { ok: false, error: errReason };
  }

  const recipientEmail =
    process.env.TEST_NOTIFICATION_EMAIL || matchedAgent.email;

  // 7. Compose Email
  const isScheduled = currentStatus === "scheduled";
  const emailSubject = isScheduled
    ? `Social Media Post Scheduled: ${listing.address}`
    : `Social Media Post Live: ${listing.address}`;

  const emailHtml = generateEmailHtml({
    agentName: matchedAgent.name,
    address: listing.address,
    status: currentStatus,
    scheduledAt: item.scheduled_at,
    canvaLink: listing.canva_link || item.canva_link,
    websiteLink: listing.website_link || item.link,
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "MSREG Hub <notifications@msreginternal.com>";

  let resendId: string | null = null;

  // 8. Dispatch Email (via mock or real Resend)
  if (params.mockResendSend) {
    const mockRes = await params.mockResendSend({
      from: fromEmail,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
    });
    if (!mockRes.ok) {
      await supabase.from("agent_notification_logs").insert({
        content_item_id: contentItemId,
        listing_id: listing.id,
        agent_name: matchedAgent.name,
        agent_email: recipientEmail,
        post_status: currentStatus,
        notification_type: currentStatus,
        status: "failed",
        error_message: mockRes.error || "Mock Resend send failed",
      });
      return { ok: false, error: mockRes.error };
    }
    resendId = mockRes.id ?? `mock_${Date.now()}`;
  } else {
    if (!resendApiKey) {
      const noKeyErr = "Missing RESEND_API_KEY environment secret";
      await supabase.from("agent_notification_logs").insert({
        content_item_id: contentItemId,
        listing_id: listing.id,
        agent_name: matchedAgent.name,
        agent_email: recipientEmail,
        post_status: currentStatus,
        notification_type: currentStatus,
        status: "failed",
        error_message: noKeyErr,
      });
      return { ok: false, error: noKeyErr };
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      const errorDetail =
        resendData?.message ||
        resendData?.error ||
        `Resend API error status ${resendRes.status}`;
      await supabase.from("agent_notification_logs").insert({
        content_item_id: contentItemId,
        listing_id: listing.id,
        agent_name: matchedAgent.name,
        agent_email: recipientEmail,
        post_status: currentStatus,
        notification_type: currentStatus,
        status: "failed",
        error_message: errorDetail,
        metadata: resendData,
      });
      return { ok: false, error: errorDetail };
    }
    resendId = resendData?.id ?? null;
  }

  // 9. Atomic Update: Mark agent_notified_at = now()
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("content_items")
    .update({ agent_notified_at: nowIso })
    .eq("id", contentItemId)
    .is("agent_notified_at", null);

  if (updateErr) {
    await supabase.from("agent_notification_logs").insert({
      content_item_id: contentItemId,
      listing_id: listing.id,
      agent_name: matchedAgent.name,
      agent_email: recipientEmail,
      post_status: currentStatus,
      notification_type: currentStatus,
      status: "sent_db_update_failed",
      resend_id: resendId,
      error_message: `Email sent (${resendId}) but setting agent_notified_at failed: ${updateErr.message}`,
    });
    return {
      ok: true,
      sent: true,
      reason: "Email sent but DB update failed",
      resend_id: resendId ?? undefined,
    };
  }

  // 10. Record Successful Notification Log
  await supabase.from("agent_notification_logs").insert({
    content_item_id: contentItemId,
    listing_id: listing.id,
    agent_name: matchedAgent.name,
    agent_email: recipientEmail,
    post_status: currentStatus,
    notification_type: currentStatus,
    status: "sent",
    resend_id: resendId,
  });

  return {
    ok: true,
    sent: true,
    agent_email: recipientEmail,
    agent_name: matchedAgent.name,
    resend_id: resendId ?? undefined,
    agent_notified_at: nowIso,
  };
}
