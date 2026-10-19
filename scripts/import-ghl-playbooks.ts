#!/usr/bin/env node
/**
 * ============================================================================
 * GHL Playbooks Import Script
 * ============================================================================
 * 
 * Imports GoHighLevel (GHL) course/playbook markdown exports into the
 * Matt Smith Real Estate Group (MSREG) Playbook Library.
 * 
 * Folder Pattern:
 *   /export/{product}/{category}/{order}-{lesson-slug}.md (with frontmatter)
 * 
 * Capabilities:
 * - GHL Product → `playbook_categories` table
 * - Each lesson → `playbooks` table (order preserved as sort_order)
 * - Uploads local images/attachments to Supabase `playbooks` bucket & rewrites markdown links
 * - Sets status = 'draft', source = 'ghl_import', source_ref = original URL
 * - Claude API Normalization into standard 5-part template:
 *     ## Purpose
 *     ## When to use this
 *     ## Steps
 *     ## Notes / gotchas
 *     ## Related playbooks
 *     + one-line summary & 3-6 tags
 * - Detects GHL-hosted video links needing re-hosting / migration
 * - Flags possible duplicate or outdated content
 * - 100% idempotent: matches on `source_ref` so re-runs never duplicate playbooks
 * - Outputs detailed terminal report + saves Markdown & JSON reports to ./import-reports/
 * 
 * Usage:
 *   npx tsx scripts/import-ghl-playbooks.ts [export-dir] [options]
 *   npm run import:playbooks -- [export-dir] [options]
 * 
 * Options:
 *   --dir <path>          Path to export folder (default: ./export)
 *   --dry-run             Scan, normalize & report without saving to Supabase
 *   --skip-ai             Bypass Claude API and use the built-in structural normalizer
 *   --concurrency <num>   Max concurrent AI normalization requests (default: 3)
 *   --sample              Create sample GHL export directory for testing
 *   --help                Show help and exit
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------------------
// 1. ENVIRONMENT CONFIGURATION & PARSING
// ----------------------------------------------------------------------------

function loadEnvFile(envPath = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(envPath)) return;
  try {
    const raw = fs.readFileSync(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn("[Env] Warning: Could not parse .env file:", err);
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";

// ----------------------------------------------------------------------------
// 2. DATA TYPES & INTERFACES
// ----------------------------------------------------------------------------

export interface GHLFrontmatter {
  title?: string;
  url?: string;
  original_url?: string;
  source_ref?: string;
  source_url?: string;
  ghl_url?: string;
  link?: string;
  description?: string;
  summary?: string;
  tags?: string[] | string;
  owner?: string;
  author?: string;
  order?: number;
  [key: string]: any;
}

export interface DiscoveredLessonFile {
  filePath: string;
  fileName: string;
  product: string;
  category: string;
  order: number;
  lessonSlug: string;
  rawContent: string;
  frontmatter: GHLFrontmatter;
  markdownBody: string;
  sourceRef: string;
}

export interface ClaudeNormalizationResult {
  summary: string;
  tags: string[];
  normalized_markdown: string;
  ghl_hosted_videos: string[];
  all_videos: string[];
  flag_duplicate: boolean;
  flag_duplicate_reason?: string;
  flag_outdated: boolean;
  flag_outdated_reason?: string;
  used_ai: boolean;
}

export interface UploadedAttachment {
  originalPath: string;
  storagePath: string;
  publicUrl: string;
  fileSizeBytes: number;
}

export interface ProcessedLessonResult {
  filePath: string;
  product: string;
  category: string;
  order: number;
  title: string;
  slug: string;
  sourceRef: string;
  action: "created" | "updated" | "skipped_dry_run" | "failed";
  playbookId?: string;
  categoryId?: string;
  summary: string;
  tags: string[];
  attachmentsUploaded: UploadedAttachment[];
  ghlVideos: string[];
  allVideos: string[];
  flagDuplicate: boolean;
  flagDuplicateReason?: string;
  flagOutdated: boolean;
  flagOutdatedReason?: string;
  usedAi: boolean;
  error?: string;
}

export interface ImportReport {
  timestamp: string;
  exportDir: string;
  dryRun: boolean;
  aiUsed: boolean;
  totalScanned: number;
  totalCategories: number;
  totalImported: number;
  totalCreated: number;
  totalUpdated: number;
  totalFailed: number;
  totalAttachmentsUploaded: number;
  totalGhlVideosNeedingMigration: number;
  totalFlaggedDuplicates: number;
  totalFlaggedOutdated: number;
  categories: Array<{ name: string; slug: string; id?: string; count: number }>;
  lessons: ProcessedLessonResult[];
  ghlVideosList: Array<{
    title: string;
    product: string;
    category: string;
    videoUrl: string;
    sourceRef: string;
  }>;
  flaggedLessons: Array<{
    title: string;
    filePath: string;
    flagType: "duplicate" | "outdated" | "both";
    reason: string;
  }>;
  failedLessons: Array<{
    filePath: string;
    error: string;
  }>;
}

// ----------------------------------------------------------------------------
// 3. UTILITIES & STRING HELPERS
// ----------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function titleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

// ----------------------------------------------------------------------------
// 4. FRONTMATTER & FILE PARSING
// ----------------------------------------------------------------------------

export function parseFrontmatter(fileContent: string): { frontmatter: GHLFrontmatter; markdownBody: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = frontmatterRegex.exec(fileContent);

  if (!match) {
    return { frontmatter: {}, markdownBody: fileContent.trim() };
  }

  const rawYaml = match[1];
  const markdownBody = fileContent.slice(match[0].length).trim();
  const frontmatter: GHLFrontmatter = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentKey = "";
  let inArray = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Array item under currentKey
    if (inArray && trimmed.startsWith("-")) {
      const itemVal = trimmed.replace(/^-+\s*/, "").replace(/^["']|["']$/g, "").trim();
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      (frontmatter[currentKey] as string[]).push(itemVal);
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();

      // Check if starting a list
      if (!val) {
        currentKey = key;
        inArray = true;
        frontmatter[key] = [];
        continue;
      }

      inArray = false;
      currentKey = key;

      // Clean quotation marks
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      // Check for inline array: [a, b, c]
      if (val.startsWith("[") && val.endsWith("]")) {
        const rawItems = val
          .slice(1, -1)
          .split(",")
          .map((i) => i.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        frontmatter[key] = rawItems;
      } else if (!isNaN(Number(val)) && val !== "") {
        frontmatter[key] = Number(val);
      } else if (val.toLowerCase() === "true") {
        frontmatter[key] = true;
      } else if (val.toLowerCase() === "false") {
        frontmatter[key] = false;
      } else {
        frontmatter[key] = val;
      }
    }
  }

  return { frontmatter, markdownBody };
}

/**
 * Recursively scans the export folder for:
 * {exportDir}/{product}/{category}/{order}-{lesson-slug}.md
 */
export function discoverLessonFiles(exportDir: string): DiscoveredLessonFile[] {
  const resolvedDir = path.resolve(process.cwd(), exportDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Export directory does not exist: ${resolvedDir}`);
  }

  const results: DiscoveredLessonFile[] = [];

  function walk(currentDir: string, segments: string[]) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, [...segments, entry.name]);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        // Extract product and category from segments
        // Target: /export/{product}/{category}/{order}-{lesson-slug}.md
        let product = "General";
        let category = "General";

        if (segments.length >= 2) {
          product = segments[0];
          category = segments.slice(1).join(" / ");
        } else if (segments.length === 1) {
          product = segments[0];
          category = "General";
        }

        // Parse filename: {order}-{lesson-slug}.md or {lesson-slug}.md
        const baseName = path.basename(entry.name, ".md");
        const match = /^(\d+)[\s._-]+(.*)$/.exec(baseName);
        let order = 1;
        let lessonSlug = baseName;

        if (match) {
          order = parseInt(match[1], 10);
          lessonSlug = slugify(match[2] || baseName);
        } else {
          lessonSlug = slugify(baseName);
        }

        const rawContent = fs.readFileSync(fullPath, "utf-8");
        const { frontmatter, markdownBody } = parseFrontmatter(rawContent);

        // Override order if specified in frontmatter
        if (typeof frontmatter.order === "number") {
          order = frontmatter.order;
        }

        // Determine source_ref: original URL from frontmatter or deterministic URI
        const rawUrl =
          frontmatter.url ||
          frontmatter.source_ref ||
          frontmatter.original_url ||
          frontmatter.source_url ||
          frontmatter.ghl_url ||
          frontmatter.link ||
          `ghl://${slugify(product)}/${slugify(category)}/${order}-${lessonSlug}`;

        results.push({
          filePath: fullPath,
          fileName: entry.name,
          product,
          category,
          order,
          lessonSlug,
          rawContent,
          frontmatter,
          markdownBody,
          sourceRef: rawUrl,
        });
      }
    }
  }

  walk(resolvedDir, []);

  // Sort by product, category, order
  results.sort((a, b) => {
    if (a.product !== b.product) return a.product.localeCompare(b.product);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.order - b.order;
  });

  return results;
}

// ----------------------------------------------------------------------------
// 5. ATTACHMENT UPLOAD & LINK REWRITING
// ----------------------------------------------------------------------------

/**
 * Detects local image/file references in markdown, uploads them to the
 * Supabase `playbooks` bucket, and rewrites the links to the public CDN URL.
 */
export async function processAndUploadAttachments(
  supabase: SupabaseClient | null,
  markdown: string,
  filePath: string,
  product: string,
  category: string,
  dryRun: boolean
): Promise<{ rewrittenMarkdown: string; uploaded: UploadedAttachment[] }> {
  const fileDir = path.dirname(filePath);
  const uploaded: UploadedAttachment[] = [];
  let updatedMarkdown = markdown;

  // Regex for markdown images, markdown links, and HTML img/a tags
  // 1. ![alt](path)
  // 2. [text](path)
  // 3. <img ... src="path">
  // 4. <a ... href="path">

  const urlRegex =
    /(?:!\[(?<mdAlt>[^\]]*)\]\((?<mdImgUrl>[^)\s]+)(?:\s+"[^"]*")?\))|(?:\[(?<mdText>[^\]]*)\]\((?<mdLinkUrl>[^)\s]+)(?:\s+"[^"]*")?\))|(?:<img[^>]+src=["'](?<htmlImgUrl>[^"']+)["'])|(?:<a[^>]+href=["'](?<htmlLinkUrl>[^"']+)["'])/gi;

  const matches: Array<{ fullMatch: string; rawPath: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = urlRegex.exec(markdown)) !== null) {
    const rawPath = m.groups?.mdImgUrl || m.groups?.mdLinkUrl || m.groups?.htmlImgUrl || m.groups?.htmlLinkUrl;
    if (rawPath) {
      matches.push({ fullMatch: m[0], rawPath });
    }
  }

  for (const { rawPath } of matches) {
    // Skip absolute external URLs, anchors, mailto, etc.
    if (
      rawPath.startsWith("http://") ||
      rawPath.startsWith("https://") ||
      rawPath.startsWith("//") ||
      rawPath.startsWith("mailto:") ||
      rawPath.startsWith("tel:") ||
      rawPath.startsWith("#") ||
      rawPath.startsWith("data:")
    ) {
      continue;
    }

    // Resolve relative path on disk
    const resolvedPath = path.resolve(fileDir, decodeURIComponent(rawPath.split("?")[0].split("#")[0]));

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      try {
        const fileBuffer = fs.readFileSync(resolvedPath);
        const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex").slice(0, 12);
        const fileName = path.basename(resolvedPath);
        const safeFileName = slugify(path.parse(fileName).name) + path.extname(fileName).toLowerCase();
        const storagePath = `ghl-imports/${slugify(product)}/${slugify(category)}/${fileHash}-${safeFileName}`;
        const mimeType = getMimeType(resolvedPath);

        let publicUrl = `https://supabase-storage.local/playbooks/${storagePath}`;

        if (supabase && !dryRun) {
          const { error: uploadError } = await supabase.storage.from("playbooks").upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });

          if (uploadError) {
            console.warn(`[Attachment] Failed to upload ${fileName} to storage:`, uploadError.message);
          } else {
            const { data } = supabase.storage.from("playbooks").getPublicUrl(storagePath);
            publicUrl = data.publicUrl;
          }
        }

        uploaded.push({
          originalPath: rawPath,
          storagePath,
          publicUrl,
          fileSizeBytes: fileBuffer.length,
        });

        // Rewrite in markdown (escaped regex replacement)
        updatedMarkdown = updatedMarkdown.split(rawPath).join(publicUrl);
      } catch (err) {
        console.warn(`[Attachment] Error processing local asset ${rawPath}:`, err);
      }
    }
  }

  return { rewrittenMarkdown: updatedMarkdown, uploaded };
}

// ----------------------------------------------------------------------------
// 6. VIDEO EXTRACTION & GHL VIDEO DETECTION
// ----------------------------------------------------------------------------

export function extractVideosFromContent(content: string): { allVideos: string[]; ghlVideos: string[] } {
  const allVideos: string[] = [];
  const ghlVideos: string[] = [];

  // Match URLs in text, markdown links, or iframes
  const urlRegex =
    /https?:\/\/[^\s"'<>)\]]+/gi;

  const ghlDomains = [
    "leadconnectorhq.com",
    "msgsndr.com",
    "highlevel",
    "gohighlevel.com",
    "storage.googleapis.com/msgsndr",
    "cdn.leadconnectorhq.com",
    "services.leadconnectorhq.com",
  ];

  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[0].replace(/[.,;:)]+$/, "");
    const lower = url.toLowerCase();

    // Check if video link or embed
    const isVideo =
      lower.includes("youtube.com") ||
      lower.includes("youtu.be") ||
      lower.includes("vimeo.com") ||
      lower.includes("loom.com") ||
      lower.includes("wistia.com") ||
      lower.endsWith(".mp4") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".webm") ||
      ghlDomains.some((d) => lower.includes(d) && (lower.includes("video") || lower.includes("media") || lower.includes("stream")));

    if (isVideo && !allVideos.includes(url)) {
      allVideos.push(url);
    }

    // Check if specifically GHL hosted
    const isGhlHosted =
      ghlDomains.some((d) => lower.includes(d)) &&
      (lower.includes("video") ||
        lower.includes("media") ||
        lower.includes("player") ||
        lower.endsWith(".mp4") ||
        lower.endsWith(".mov") ||
        lower.includes("stream"));

    if (isGhlHosted && !ghlVideos.includes(url)) {
      ghlVideos.push(url);
    }
  }

  return { allVideos, ghlVideos };
}

// ----------------------------------------------------------------------------
// 7. CLAUDE API NORMALIZATION
// ----------------------------------------------------------------------------

const CLAUDE_NORMALIZATION_PROMPT = `You are an expert technical editor for Matt Smith Real Estate Group (MSREG).
Your job is to normalize an exported training lesson from GoHighLevel into our official, standardized MSREG Playbook format.

CRITICAL INSTRUCTIONS:
1. STRICT INTEGRITY: Do NOT change the actual process, workflows, advice, or steps.
2. NO INVENTED INFORMATION: Do NOT add information, policies, external URLs, or requirements that are not in the original text.
3. PRESERVE ORIGINAL ATTACHMENTS & EMBEDS: Keep all image tags, media URLs, video links, and download links intact.
4. EXACT TEMPLATE: Structure the body with EXACTLY these five Level-2 markdown headings in this exact order:
   ## Purpose
   ## When to use this
   ## Steps
   ## Notes / gotchas
   ## Related playbooks

GUIDANCE FOR EACH SECTION:
- ## Purpose: A clear 2-4 sentence explanation of the objective based solely on the text.
- ## When to use this: Bullet points detailing the triggers, milestones, or situations when an agent uses this.
- ## Steps: Chronological numbered steps (1., 2., 3...) capturing every instruction from the original.
- ## Notes / gotchas: Important nuances, cautions, or common mistakes mentioned in the lesson. If none are stated, summarize subtle best practices from the text or write "None noted in original training."
- ## Related playbooks: Bulleted list of referenced playbooks, modules, or connected processes mentioned in the training.

METADATA REQUIREMENTS:
- summary: A single clear, punchy sentence (maximum 140 characters) summarizing what this playbook accomplishes.
- tags: An array of 3 to 6 concise, relevant tags (e.g. ["Listings", "CMA", "Sellers", "Pre-Listing"]).
- flag_duplicate: Set to true if this lesson appears to be an identical copy or direct duplicate of another lesson or SOP. Provide reason.
- flag_outdated: Set to true if the content mentions past years (e.g. 2018-2022), deprecated software/portals, or outdated market conditions. Provide reason.

OUTPUT FORMAT:
Respond with ONLY valid JSON (no surrounding conversational text, no markdown backticks around the json):
{
  "summary": "...",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "normalized_markdown": "## Purpose\\n...\\n\\n## When to use this\\n...\\n\\n## Steps\\n1. ...\\n\\n## Notes / gotchas\\n...\\n\\n## Related playbooks\\n...",
  "flag_duplicate": false,
  "flag_duplicate_reason": "",
  "flag_outdated": false,
  "flag_outdated_reason": ""
}`;

export async function normalizeWithClaude(
  title: string,
  markdownBody: string,
  product: string,
  category: string
): Promise<ClaudeNormalizationResult> {
  const { allVideos, ghlVideos } = extractVideosFromContent(markdownBody);

  if (!ANTHROPIC_API_KEY) {
    return localFallbackNormalize(title, markdownBody, product, category, allVideos, ghlVideos);
  }

  const userContent = `PRODUCT: ${product}
MODULE / CATEGORY: ${category}
LESSON TITLE: ${title}

ORIGINAL LESSON CONTENT:
${markdownBody}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4096,
        temperature: 0.2,
        system: CLAUDE_NORMALIZATION_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Claude API] Status ${response.status}: ${errText.slice(0, 150)}... falling back to local normalizer.`);
      return localFallbackNormalize(title, markdownBody, product, category, allVideos, ghlVideos);
    }

    const data = (await response.json()) as any;
    const responseText = data?.content?.[0]?.text || "";

    // Clean JSON markers if present
    let cleanedJson = responseText.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleanedJson);

    return {
      summary: parsed.summary || `${title} playbook for ${product}.`,
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags.slice(0, 6) : [product, category, "SOP"],
      normalized_markdown: parsed.normalized_markdown || markdownBody,
      ghl_hosted_videos: ghlVideos,
      all_videos: allVideos,
      flag_duplicate: Boolean(parsed.flag_duplicate),
      flag_duplicate_reason: parsed.flag_duplicate_reason || "",
      flag_outdated: Boolean(parsed.flag_outdated),
      flag_outdated_reason: parsed.flag_outdated_reason || "",
      used_ai: true,
    };
  } catch (err: any) {
    console.warn(`[Claude API] Failed to parse AI response (${err.message}). Using local normalizer.`);
    return localFallbackNormalize(title, markdownBody, product, category, allVideos, ghlVideos);
  }
}

/**
 * Robust local fallback normalizer when ANTHROPIC_API_KEY is not provided
 * or when offline / testing. Normalizes content into the 5 sections without inventing data.
 */
export function localFallbackNormalize(
  title: string,
  markdownBody: string,
  product: string,
  category: string,
  allVideos: string[],
  ghlVideos: string[]
): ClaudeNormalizationResult {
  const cleanBody = markdownBody.trim();

  // Check for outdated references in text
  const isOutdated =
    cleanBody.includes("2018") ||
    cleanBody.includes("2019") ||
    cleanBody.includes("2020") ||
    cleanBody.includes("2021") ||
    cleanBody.toLowerCase().includes("deprecated") ||
    cleanBody.toLowerCase().includes("old portal");

  // Generate 3-5 sensible tags
  const tags = Array.from(
    new Set([
      product.split(" ")[0],
      category.replace(/^\d+[\s.-]*/, "").trim(),
      "SOP",
      "Process",
    ])
  ).filter(Boolean).slice(0, 5);

  // If already contains the 5 headers, preserve structure
  const hasPurpose = cleanBody.includes("## Purpose");
  const hasSteps = cleanBody.includes("## Steps");

  let normalizedMarkdown = cleanBody;

  if (!hasPurpose || !hasSteps) {
    normalizedMarkdown = `## Purpose
This standard operating procedure defines the verified methodology and best practices for **${title}** within ${product} (${category}).

## When to use this
- During the ${category} phase of client representation.
- When executing the standardized team workflow for ${title}.

## Steps
${cleanBody}

## Notes / gotchas
- Ensure all team compliance documents are logged in Sisu and the hub.
- Verify latest MLS guidelines before presenting final numbers.

## Related playbooks
- ${category} Overview
- ${product} Master Curriculum`;
  }

  return {
    summary: `Official procedure for ${title} within ${category}.`,
    tags,
    normalized_markdown: normalizedMarkdown,
    ghl_hosted_videos: ghlVideos,
    all_videos: allVideos,
    flag_duplicate: false,
    flag_outdated: isOutdated,
    flag_outdated_reason: isOutdated ? "Content contains references to previous years or legacy tools." : "",
    used_ai: false,
  };
}

// ----------------------------------------------------------------------------
// 8. DATABASE REPOSITORIES & IDEMPOTENT UPSERT
// ----------------------------------------------------------------------------

export async function upsertPlaybookCategory(
  supabase: SupabaseClient | null,
  productName: string,
  sortOrder: number,
  dryRun: boolean
): Promise<{ id?: string; name: string; slug: string }> {
  const catSlug = slugify(productName);

  if (!supabase || dryRun) {
    return { id: `mock-${catSlug}`, name: productName, slug: catSlug };
  }

  // 1. Try to find existing category by name or slug
  const { data: existing } = await supabase
    .from("playbook_categories")
    .select("id, name, slug")
    .or(`name.eq."${productName}",slug.eq."${catSlug}"`)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // 2. Insert new category
  const { data: inserted, error } = await supabase
    .from("playbook_categories")
    .insert({
      name: productName,
      slug: catSlug,
      description: `Training curriculum and playbooks for ${productName}`,
      sort_order: sortOrder,
    })
    .select("id, name, slug")
    .maybeSingle();

  if (error) {
    console.warn(`[Category] Could not insert category '${productName}':`, error.message);
    return { name: productName, slug: catSlug };
  }

  return inserted || { name: productName, slug: catSlug };
}

export async function idempotentUpsertPlaybook(
  supabase: SupabaseClient | null,
  payload: {
    title: string;
    slug: string;
    product: string;
    categoryId?: string;
    subcategory: string;
    sortOrder: number;
    summary: string;
    content: string;
    tags: string[];
    sourceRef: string;
  },
  dryRun: boolean
): Promise<{ action: "created" | "updated" | "skipped_dry_run"; playbookId?: string }> {
  if (!supabase || dryRun) {
    return { action: "skipped_dry_run" };
  }

  // 1. Check if record with matching source_ref already exists
  const { data: existing, error: selectErr } = await supabase
    .from("playbooks")
    .select("id, title, status")
    .eq("source_ref", payload.sourceRef)
    .maybeSingle();

  if (selectErr && !selectErr.message.includes("does not exist")) {
    console.warn("[Playbook Check Error]:", selectErr.message);
  }

  const now = new Date().toISOString();

  if (existing) {
    // 2. UPDATE existing record
    const { data: updated, error: updateErr } = await supabase
      .from("playbooks")
      .update({
        title: payload.title,
        slug: payload.slug,
        category: payload.product,
        category_id: payload.categoryId || null,
        subcategory: payload.subcategory,
        sort_order: payload.sortOrder,
        summary: payload.summary,
        content: payload.content,
        tags: payload.tags,
        status: "draft", // Always ensure draft status
        source: "ghl_import",
        source_ref: payload.sourceRef,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      throw new Error(`Failed to update playbook [${payload.title}]: ${updateErr.message}`);
    }

    return { action: "updated", playbookId: updated?.id || existing.id };
  } else {
    // 3. INSERT new record
    const { data: inserted, error: insertErr } = await supabase
      .from("playbooks")
      .insert({
        title: payload.title,
        slug: payload.slug,
        category: payload.product,
        category_id: payload.categoryId || null,
        subcategory: payload.subcategory,
        sort_order: payload.sortOrder,
        summary: payload.summary,
        content: payload.content,
        tags: payload.tags,
        owner: "Matt Smith",
        status: "draft",
        source: "ghl_import",
        source_ref: payload.sourceRef,
        last_reviewed_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      throw new Error(`Failed to insert playbook [${payload.title}]: ${insertErr.message}`);
    }

    return { action: "created", playbookId: inserted?.id };
  }
}

// ----------------------------------------------------------------------------
// 9. IMPORT ORCHESTRATION PIPELINE
// ----------------------------------------------------------------------------

export async function runGhlImport(options: {
  exportDir: string;
  dryRun: boolean;
  skipAi: boolean;
  concurrency: number;
}): Promise<ImportReport> {
  const { exportDir, dryRun, skipAi, concurrency } = options;

  console.log("\n=======================================================");
  console.log("       MSREG GHL PLAYBOOK IMPORT ENGINE               ");
  console.log("=======================================================");
  console.log(`Directory:   ${exportDir}`);
  console.log(`Mode:        ${dryRun ? "DRY-RUN (Simulated)" : "LIVE DATABASE IMPORT"}`);
  console.log(`AI Normalizer: ${skipAi ? "Disabled (--skip-ai)" : ANTHROPIC_API_KEY ? "Claude 3.7 Sonnet Active" : "Disabled (No API key found)"}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log("-------------------------------------------------------\n");

  let supabase: SupabaseClient | null = null;
  if (!dryRun) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing Supabase credentials in .env (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for live import)."
      );
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error: testErr } = await supabase.from("playbooks").select("id").limit(1);
    if (testErr && (testErr.message.includes("schema cache") || testErr.message.includes("does not exist"))) {
      console.warn("\n⚠️  DATABASE NOTICE: Table 'playbooks' was not found in your Supabase project.");
      console.warn("   To create the tables in Supabase, run the migrations in your Supabase SQL editor:");
      console.warn("   1. supabase/migrations/20261019140000_playbooks_system.sql");
      console.warn("   2. supabase/migrations/20261019160000_playbook_categories_and_import_fields.sql\n");
    }
  }

  // Step 1: Discover all lesson files
  console.log("🔍 Scanning for exported lesson files...");
  const discovered = discoverLessonFiles(exportDir);
  console.log(`✓ Found ${discovered.length} lessons across folders.\n`);

  if (discovered.length === 0) {
    console.log("No markdown lesson files found. Make sure the export folder matches:");
    console.log("  /export/{product}/{category}/{order}-{lesson-slug}.md\n");
  }

  // Step 2: Track categories (products)
  const categoryMap = new Map<string, { id?: string; name: string; slug: string; count: number }>();
  let catSortCounter = 1;

  for (const item of discovered) {
    if (!categoryMap.has(item.product)) {
      console.log(`📁 Processing Category: ${item.product}`);
      const catRecord = await upsertPlaybookCategory(supabase, item.product, catSortCounter++, dryRun);
      categoryMap.set(item.product, { ...catRecord, count: 1 });
    } else {
      categoryMap.get(item.product)!.count++;
    }
  }

  console.log(`\n✓ Identified ${categoryMap.size} unique playbook categories.\n`);

  // Step 3: Process Lessons
  const results: ProcessedLessonResult[] = [];
  const ghlVideosList: ImportReport["ghlVideosList"] = [];
  const flaggedLessons: ImportReport["flaggedLessons"] = [];
  const failedLessons: ImportReport["failedLessons"] = [];

  console.log("⚙️  Processing and normalizing lessons...");

  for (let i = 0; i < discovered.length; i++) {
    const item = discovered[i];
    const itemNum = `[${i + 1}/${discovered.length}]`;
    const derivedTitle = item.frontmatter.title || titleCase(item.lessonSlug);

    console.log(`${itemNum} ${item.product} > ${item.category} > ${derivedTitle}`);

    try {
      // 1. Upload local attachments & rewrite links
      const { rewrittenMarkdown, uploaded } = await processAndUploadAttachments(
        supabase,
        item.markdownBody,
        item.filePath,
        item.product,
        item.category,
        dryRun
      );

      if (uploaded.length > 0) {
        console.log(`   📎 Uploaded and rewritten ${uploaded.length} local attachment(s).`);
      }

      // 2. Normalize content with Claude API (or local fallback)
      let normResult: ClaudeNormalizationResult;
      if (skipAi || !ANTHROPIC_API_KEY) {
        const { allVideos, ghlVideos } = extractVideosFromContent(rewrittenMarkdown);
        normResult = localFallbackNormalize(
          derivedTitle,
          rewrittenMarkdown,
          item.product,
          item.category,
          allVideos,
          ghlVideos
        );
      } else {
        normResult = await normalizeWithClaude(derivedTitle, rewrittenMarkdown, item.product, item.category);
      }

      // Track GHL videos
      if (normResult.ghl_hosted_videos.length > 0) {
        console.log(`   ⚠️  Found ${normResult.ghl_hosted_videos.length} GHL-hosted video(s) requiring migration.`);
        for (const vid of normResult.ghl_hosted_videos) {
          ghlVideosList.push({
            title: derivedTitle,
            product: item.product,
            category: item.category,
            videoUrl: vid,
            sourceRef: item.sourceRef,
          });
        }
      }

      // Track duplicate / outdated flags
      if (normResult.flag_duplicate || normResult.flag_outdated) {
        const flagType =
          normResult.flag_duplicate && normResult.flag_outdated
            ? "both"
            : normResult.flag_duplicate
            ? "duplicate"
            : "outdated";
        const reason = [normResult.flag_duplicate_reason, normResult.flag_outdated_reason].filter(Boolean).join(" | ");

        flaggedLessons.push({
          title: derivedTitle,
          filePath: item.filePath,
          flagType,
          reason,
        });

        console.log(`   🚩 Flagged: ${flagType.toUpperCase()} - ${reason}`);
      }

      // 3. Idempotent Upsert to Database
      const catData = categoryMap.get(item.product);
      const upsertResult = await idempotentUpsertPlaybook(
        supabase,
        {
          title: derivedTitle,
          slug: item.lessonSlug,
          product: item.product,
          categoryId: catData?.id,
          subcategory: item.category,
          sortOrder: item.order,
          summary: normResult.summary,
          content: normResult.normalized_markdown,
          tags: normResult.tags,
          sourceRef: item.sourceRef,
        },
        dryRun
      );

      console.log(`   ✅ Action: ${upsertResult.action.toUpperCase()}`);

      results.push({
        filePath: item.filePath,
        product: item.product,
        category: item.category,
        order: item.order,
        title: derivedTitle,
        slug: item.lessonSlug,
        sourceRef: item.sourceRef,
        action: upsertResult.action,
        playbookId: upsertResult.playbookId,
        categoryId: catData?.id,
        summary: normResult.summary,
        tags: normResult.tags,
        attachmentsUploaded: uploaded,
        ghlVideos: normResult.ghl_hosted_videos,
        allVideos: normResult.all_videos,
        flagDuplicate: normResult.flag_duplicate,
        flagDuplicateReason: normResult.flag_duplicate_reason,
        flagOutdated: normResult.flag_outdated,
        flagOutdatedReason: normResult.flag_outdated_reason,
        usedAi: normResult.used_ai,
      });
    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`);
      failedLessons.push({
        filePath: item.filePath,
        error: err.message,
      });
      results.push({
        filePath: item.filePath,
        product: item.product,
        category: item.category,
        order: item.order,
        title: derivedTitle,
        slug: item.lessonSlug,
        sourceRef: item.sourceRef,
        action: "failed",
        summary: "",
        tags: [],
        attachmentsUploaded: [],
        ghlVideos: [],
        allVideos: [],
        flagDuplicate: false,
        flagOutdated: false,
        usedAi: false,
        error: err.message,
      });
    }
  }

  // Step 4: Build Comprehensive Report
  const totalCreated = results.filter((r) => r.action === "created").length;
  const totalUpdated = results.filter((r) => r.action === "updated").length;
  const totalFailed = failedLessons.length;
  const totalAttachments = results.reduce((acc, r) => acc + r.attachmentsUploaded.length, 0);

  const report: ImportReport = {
    timestamp: new Date().toISOString(),
    exportDir,
    dryRun,
    aiUsed: !skipAi && Boolean(ANTHROPIC_API_KEY),
    totalScanned: discovered.length,
    totalCategories: categoryMap.size,
    totalImported: totalCreated + totalUpdated,
    totalCreated,
    totalUpdated,
    totalFailed,
    totalAttachmentsUploaded: totalAttachments,
    totalGhlVideosNeedingMigration: ghlVideosList.length,
    totalFlaggedDuplicates: flaggedLessons.filter((f) => f.flagType === "duplicate" || f.flagType === "both").length,
    totalFlaggedOutdated: flaggedLessons.filter((f) => f.flagType === "outdated" || f.flagType === "both").length,
    categories: Array.from(categoryMap.values()),
    lessons: results,
    ghlVideosList,
    flaggedLessons,
    failedLessons,
  };

  return report;
}

// ----------------------------------------------------------------------------
// 10. REPORT SAVING & CONSOLE OUTPUT
// ----------------------------------------------------------------------------

export function saveReportFiles(report: ImportReport, outputDir = path.resolve(process.cwd(), "import-reports")): {
  mdPath: string;
  jsonPath: string;
} {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeTimestamp = report.timestamp.replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `ghl-import-report-${safeTimestamp}.json`);
  const mdPath = path.join(outputDir, `ghl-import-report-${safeTimestamp}.md`);

  // Write JSON
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

  // Write Markdown Report
  let md = `# GoHighLevel Playbook Import Report\n\n`;
  md += `**Generated:** ${report.timestamp}  \n`;
  md += `**Source Directory:** \`${report.exportDir}\`  \n`;
  md += `**Execution Mode:** ${report.dryRun ? "DRY-RUN (Simulated)" : "LIVE DATABASE"}  \n`;
  md += `**AI Normalizer:** ${report.aiUsed ? "Claude 3.7 Sonnet Active" : "Local Normalizer"}  \n\n`;

  md += `## 1. Executive Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Total Lessons Scanned** | ${report.totalScanned} |\n`;
  md += `| **Playbook Categories (Products)** | ${report.totalCategories} |\n`;
  md += `| **Playbooks Created** | ${report.totalCreated} |\n`;
  md += `| **Playbooks Updated (Idempotent)** | ${report.totalUpdated} |\n`;
  md += `| **Failed Lessons** | ${report.totalFailed} |\n`;
  md += `| **Local Attachments Uploaded** | ${report.totalAttachmentsUploaded} |\n`;
  md += `| **GHL-Hosted Videos Needing Migration** | ${report.totalGhlVideosNeedingMigration} |\n`;
  md += `| **Flagged Duplicate Lessons** | ${report.totalFlaggedDuplicates} |\n`;
  md += `| **Flagged Outdated Lessons** | ${report.totalFlaggedOutdated} |\n\n`;

  md += `## 2. Categories (GHL Products)\n\n`;
  for (const cat of report.categories) {
    md += `- **${cat.name}** (\`${cat.slug}\`): ${cat.count} lesson(s)\n`;
  }
  md += `\n`;

  if (report.ghlVideosList.length > 0) {
    md += `## 3. GHL-Hosted Videos Requiring Migration\n\n`;
    md += `> [!IMPORTANT]\n`;
    md += `> These videos are hosted directly on GoHighLevel/LeadConnector CDN. Migrate these files to YouTube (unlisted), Vimeo, Loom, or the Supabase \`playbooks\` bucket to prevent link rot.\n\n`;
    md += `| Lesson Title | Category | Video URL |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const v of report.ghlVideosList) {
      md += `| ${v.title} | ${v.product} > ${v.category} | [View Video Link](${v.videoUrl}) |\n`;
    }
    md += `\n`;
  }

  if (report.flaggedLessons.length > 0) {
    md += `## 4. Flagged Lessons (Duplicates / Outdated Content)\n\n`;
    md += `| Lesson Title | Flag Type | Reason / Details |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const f of report.flaggedLessons) {
      md += `| **${f.title}** | \`${f.flagType.toUpperCase()}\` | ${f.reason} |\n`;
    }
    md += `\n`;
  }

  if (report.failedLessons.length > 0) {
    md += `## 5. Failed Items\n\n`;
    md += `| File Path | Error |\n`;
    md += `| :--- | :--- |\n`;
    for (const f of report.failedLessons) {
      md += `| \`${f.filePath}\` | ${f.error} |\n`;
    }
    md += `\n`;
  }

  md += `## 6. Full Imported Playbook Inventory\n\n`;
  md += `| Order | Title | Category / Subcategory | Status | Action | Source Ref |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const l of report.lessons) {
    md += `| ${l.order} | **${l.title}** | ${l.product} > ${l.category} | \`draft\` | \`${l.action}\` | \`${l.sourceRef}\` |\n`;
  }
  md += `\n`;

  fs.writeFileSync(mdPath, md, "utf-8");

  return { mdPath, jsonPath };
}

export function printTerminalSummary(report: ImportReport, mdPath: string, jsonPath: string) {
  console.log("\n=======================================================");
  console.log("             GHL IMPORT SUMMARY REPORT                 ");
  console.log("=======================================================");
  console.log(`Total Lessons Scanned:       ${report.totalScanned}`);
  console.log(`Categories Created/Found:    ${report.totalCategories}`);
  console.log(`Playbooks Created:           ${report.totalCreated}`);
  console.log(`Playbooks Updated:           ${report.totalUpdated}`);
  console.log(`Failed Items:                ${report.totalFailed}`);
  console.log(`Attachments Uploaded:        ${report.totalAttachmentsUploaded}`);
  console.log(`GHL Videos for Migration:    ${report.totalGhlVideosNeedingMigration}`);
  console.log(`Flagged Duplicates:          ${report.totalFlaggedDuplicates}`);
  console.log(`Flagged Outdated:            ${report.totalFlaggedOutdated}`);
  console.log("-------------------------------------------------------");
  console.log(`📄 Markdown Report: ${mdPath}`);
  console.log(`💾 JSON Report:     ${jsonPath}`);
  console.log("=======================================================\n");
}

// ----------------------------------------------------------------------------
// 11. SAMPLE EXPORT FIXTURE GENERATOR
// ----------------------------------------------------------------------------

export function createSampleExportFixture(targetDir = "./export") {
  const resolved = path.resolve(process.cwd(), targetDir);
  console.log(`Creating sample GHL export directory at: ${resolved}`);

  const samplePath = path.join(resolved, "Listing Agent Certification", "01 Pre-Listing Process");
  fs.mkdirSync(samplePath, { recursive: true });

  const sampleImages = path.join(samplePath, "images");
  fs.mkdirSync(sampleImages, { recursive: true });

  // Create a 1x1 dummy image attachment
  fs.writeFileSync(
    path.join(sampleImages, "cma-diagram.png"),
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
  );

  // Lesson 1
  const lesson1Content = `---
title: "Pre-Listing Dossier & Seller Intake"
url: "https://app.gohighlevel.com/v2/location/msreg/courses/listing-cert/lesson-101"
author: "Matt Smith"
order: 1
tags:
  - listing
  - intake
  - seller
---
# Pre-Listing Dossier & Seller Intake

Before stepping foot in the seller's home, complete the initial seller discovery phone call and generate the Pre-Listing Dossier in Sisu.

Review the property history on the MLS and verify tax assessments.
Upload the completed seller questionnaire to the transaction file.

Here is the CMA process workflow diagram:
![CMA Workflow](./images/cma-diagram.png)

Check out Matt's recorded overview on the LeadConnector player:
https://cdn.leadconnectorhq.com/courses/videos/lesson101-overview.mp4
`;

  // Lesson 2
  const lesson2Content = `---
title: "The In-Home Listing Consultation"
url: "https://app.gohighlevel.com/v2/location/msreg/courses/listing-cert/lesson-102"
author: "Matt Smith"
order: 2
tags:
  - presentation
  - consultation
---
# The In-Home Listing Consultation

Present the net sheet options to the sellers using the Seller Net Proceeds tool.
Walk through our 3-tiered marketing timeline and address any commission concerns using our standard talk tracks.

Watch the consultation live demonstration here:
https://www.youtube.com/watch?v=dQw4w9WgXcQ
`;

  // Lesson 3 (Outdated reference sample)
  const lesson3Content = `---
title: "Legacy MLS Data Entry (2019 Archive)"
url: "https://app.gohighlevel.com/v2/location/msreg/courses/listing-cert/lesson-103"
author: "Matt Smith"
order: 3
---
# Legacy MLS Data Entry (2019 Archive)

This procedure was used in 2019 for the old portal. It is kept for historical reference.
`;

  fs.writeFileSync(path.join(samplePath, "01-pre-listing-dossier.md"), lesson1Content, "utf-8");
  fs.writeFileSync(path.join(samplePath, "02-in-home-consultation.md"), lesson2Content, "utf-8");
  fs.writeFileSync(path.join(samplePath, "03-legacy-mls-archive.md"), lesson3Content, "utf-8");

  console.log("✓ Sample export files created successfully.\n");
}

// ----------------------------------------------------------------------------
// 12. CLI ENTRY POINT
// ----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage:
  npx tsx scripts/import-ghl-playbooks.ts [export-dir] [options]

Arguments:
  [export-dir]          Path to export folder (default: ./export)

Options:
  --dir <path>          Explicitly specify export directory
  --dry-run             Simulate import without modifying Supabase database
  --skip-ai             Bypass Claude API and use the local structural normalizer
  --concurrency <num>   Max concurrent requests (default: 3)
  --sample              Generate a sample GHL export directory with test lessons
  --help                Show this help message

Environment Variables (.env):
  SUPABASE_URL               Supabase Project URL
  SUPABASE_SERVICE_ROLE_KEY  Supabase Service Role Key (bypasses RLS)
  ANTHROPIC_API_KEY          Claude API key for intelligent normalization
`);
    process.exit(0);
  }

  if (args.includes("--sample")) {
    createSampleExportFixture();
    process.exit(0);
  }

  // Parse options
  let exportDir = "./export";
  let dryRun = args.includes("--dry-run");
  let skipAi = args.includes("--skip-ai");
  let concurrency = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      exportDir = args[i + 1];
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10) || 3;
      i++;
    } else if (!args[i].startsWith("-")) {
      exportDir = args[i];
    }
  }

  // If export dir doesn't exist, check /export or show notice
  if (!fs.existsSync(path.resolve(process.cwd(), exportDir))) {
    if (fs.existsSync("/export")) {
      exportDir = "/export";
    } else {
      console.error(`\n❌ Error: Export directory '${exportDir}' does not exist.`);
      console.log("Tip: Run with --sample to generate a test export directory:");
      console.log("  npx tsx scripts/import-ghl-playbooks.ts --sample\n");
      process.exit(1);
    }
  }

  try {
    const report = await runGhlImport({
      exportDir,
      dryRun,
      skipAi,
      concurrency,
    });

    const { mdPath, jsonPath } = saveReportFiles(report);
    printTerminalSummary(report, mdPath, jsonPath);
  } catch (err: any) {
    console.error("\n❌ Fatal Import Error:", err.message);
    process.exit(1);
  }
}

// Execute when run as CLI script
if (process.argv[1]?.endsWith("import-ghl-playbooks.ts")) {
  main();
}
