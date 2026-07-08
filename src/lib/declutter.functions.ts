import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INTENSITY_PROMPTS: Record<string, string> = {
  light:
    "Remove obvious clutter, trash, and visible mess from this room while keeping furniture and main decor intact. Keep the space looking natural and lived-in.",
  medium:
    "Remove clutter, personal items, mess, and unnecessary objects from this room. Clean it up significantly while preserving the core furniture and room layout.",
  heavy:
    "Remove almost all clutter, personal items, furniture clutter, and mess. Make the room look clean, minimal, and staged. Preserve walls, floors, and major architectural features.",
};

function buildPrompt(intensity: string): string {
  return (
    INTENSITY_PROMPTS[intensity?.toLowerCase()] ??
    INTENSITY_PROMPTS.medium
  );
}

const inputSchema = z.object({
  job_id: z.string().uuid(),
  source_image_url: z.string().url(),
  intensity: z.enum(["light", "medium", "heavy"]),
  num_images: z.number().int().min(1).max(8).optional(),
});

export const declutterRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { job_id, source_image_url, intensity } = data;
    const num_images = data.num_images ?? 3;

    const { data: job, error: fetchErr } = await supabase
      .from("staging_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!job) throw new Error("Staging job not found");

    const prompt = buildPrompt(intensity);

    await supabase
      .from("staging_jobs")
      .update({
        status: "processing",
        prompt,
        room_type: "interior",
        style: intensity,
        source_image_url,
      })
      .eq("id", job_id);

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      await supabase
        .from("staging_jobs")
        .update({ status: "error", error_message: "FAL_KEY not configured" })
        .eq("id", job_id);
      throw new Error("FAL_KEY not configured");
    }

    try {
      const resp = await fetch("https://fal.run/fal-ai/flux-kontext/dev", {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: source_image_url,
          prompt,
          num_images,
          guidance_scale: 2.5,
          num_inference_steps: 40,
          output_format: "jpeg",
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`fal.ai ${resp.status}: ${text.slice(0, 500)}`);
      }

      const result = (await resp.json()) as {
        images?: Array<{ url: string }>;
        data?: { images?: Array<{ url: string }> };
      };
      const images = result.images ?? result.data?.images ?? [];
      const urls = images.map((i) => i.url).filter(Boolean);

      if (urls.length === 0) throw new Error("fal.ai returned no images");

      const { data: updated, error: updErr } = await supabase
        .from("staging_jobs")
        .update({ status: "done", result_urls: urls, error_message: null })
        .eq("id", job_id)
        .select("*")
        .single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[declutter] failed", { job_id, message });
      const { data: updated } = await supabase
        .from("staging_jobs")
        .update({ status: "error", error_message: message.slice(0, 1000) })
        .eq("id", job_id)
        .select("*")
        .single();
      return updated ?? { id: job_id, status: "error", error_message: message };
    }
  });
