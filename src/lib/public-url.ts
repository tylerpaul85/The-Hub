// Public agent-facing pages always live on the stable published domain,
// regardless of whether the admin is viewing the preview or the published app.
export const PUBLIC_SITE_URL = "https://calendar-hub-craft.lovable.app";

export function publicUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_SITE_URL}${p}`;
}
