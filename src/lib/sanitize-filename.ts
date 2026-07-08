// Sanitize a file name for safe use as a Supabase storage key.
// Keeps only [A-Za-z0-9-_], replaces whitespace with "-", drops everything else,
// preserves the extension, and prepends a short unique id to avoid collisions.
export function sanitizeFilename(name: string): string {
  const trimmed = (name ?? "file").trim();
  const dot = trimmed.lastIndexOf(".");
  const rawBase = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const rawExt = dot > 0 ? trimmed.slice(dot + 1) : "";
  const base = rawBase
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"`’]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80) || "file";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return ext ? `${base}.${ext}` : base;
}

// Build a unique storage key under an optional prefix.
export function makeStorageKey(prefix: string, originalName: string): string {
  const safe = sanitizeFilename(originalName);
  const uid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const clean = prefix.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/${Date.now()}-${uid}-${safe}` : `${Date.now()}-${uid}-${safe}`;
}

// Strip query string then test extension. Signed URLs include ?token=...
// which breaks naive `/\.(png|jpe?g)$/i` checks.
export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0].split("#")[0];
  return /\.(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(path);
}
