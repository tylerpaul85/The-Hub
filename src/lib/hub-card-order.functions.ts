import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SETTINGS_PATH = "settings/agent-hub-card-order.json";
const BUCKET = "toolbox";

export interface HubCardConfigItem {
  id: string;
  sortOrder: number;
  visible: boolean;
  badgeOverride?: string;
}

export interface HubCardSettingsPayload {
  order: string[];
  hiddenIds: string[];
  badgeOverrides: Record<string, string>;
  updatedAt?: string;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getPublicHubCardSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<HubCardSettingsPayload> => {
    try {
      const sb = await admin();
      const { data, error } = await sb.storage.from(BUCKET).download(SETTINGS_PATH);
      if (error || !data) {
        return {
          order: [],
          hiddenIds: [],
          badgeOverrides: {},
        };
      }
      const text = await data.text();
      const parsed = JSON.parse(text);
      return {
        order: Array.isArray(parsed.order) ? parsed.order : [],
        hiddenIds: Array.isArray(parsed.hiddenIds) ? parsed.hiddenIds : [],
        badgeOverrides:
          typeof parsed.badgeOverrides === "object" && parsed.badgeOverrides !== null
            ? parsed.badgeOverrides
            : {},
        updatedAt: parsed.updated_at || parsed.updatedAt,
      };
    } catch {
      return {
        order: [],
        hiddenIds: [],
        badgeOverrides: {},
      };
    }
  },
);

const saveValidator = (d: {
  order: string[];
  hiddenIds?: string[];
  badgeOverrides?: Record<string, string>;
}) =>
  z
    .object({
      order: z.array(z.string()),
      hiddenIds: z.array(z.string()).optional(),
      badgeOverrides: z.record(z.string(), z.string()).optional(),
    })
    .parse(d);

export const saveHubCardSettings = createServerFn({ method: "POST" })
  .validator(saveValidator)
  .handler(async ({ data }) => {
    const sb = await admin();
    const payload = {
      order: data.order,
      hiddenIds: data.hiddenIds ?? [],
      badgeOverrides: data.badgeOverrides ?? {},
      updated_at: new Date().toISOString(),
    };

    const jsonBuffer = Buffer.from(JSON.stringify(payload, null, 2));
    const { error } = await sb.storage.from(BUCKET).upload(SETTINGS_PATH, jsonBuffer, {
      upsert: true,
      contentType: "application/json",
    });

    if (error) {
      throw new Error(`Failed to save hub card settings: ${error.message}`);
    }

    return { success: true, payload };
  });
