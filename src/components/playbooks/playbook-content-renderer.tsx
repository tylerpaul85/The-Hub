import React from "react";
import { Film, ExternalLink, Play } from "lucide-react";

interface PlaybookContentRendererProps {
  content: string;
}

// Inline formatting (bold, italic, code, links, images)
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentText = text;
  let keyIdx = 0;

  while (currentText.length > 0) {
    const boldMatch = currentText.match(/\*\*(.*?)\*\*/);
    const codeMatch = currentText.match(/`(.*?)`/);
    const italicMatch = currentText.match(/\*(.*?)\*/);
    const linkMatch = currentText.match(/\[(.*?)\]\((.*?)\)/);

    const matches = [
      boldMatch && { index: boldMatch.index!, type: "bold", text: boldMatch[0], content: boldMatch[1] },
      codeMatch && { index: codeMatch.index!, type: "code", text: codeMatch[0], content: codeMatch[1] },
      italicMatch && { index: italicMatch.index!, type: "italic", text: italicMatch[0], content: italicMatch[1] },
      linkMatch && { index: linkMatch.index!, type: "link", text: linkMatch[0], label: linkMatch[1], href: linkMatch[2] },
    ].filter(Boolean) as Array<any>;

    if (matches.length === 0) {
      parts.push(currentText);
      break;
    }

    matches.sort((a, b) => a.index - b.index);
    const firstMatch = matches[0];

    if (firstMatch.index > 0) {
      parts.push(currentText.substring(0, firstMatch.index));
    }

    if (firstMatch.type === "bold") {
      parts.push(<strong key={keyIdx++} className="font-bold text-foreground">{firstMatch.content}</strong>);
    } else if (firstMatch.type === "code") {
      parts.push(
        <code key={keyIdx++} className="bg-surface-2 border border-border/80 px-1.5 py-0.5 rounded text-xs font-mono text-gold font-semibold shadow-xs">
          {firstMatch.content}
        </code>
      );
    } else if (firstMatch.type === "italic") {
      parts.push(<em key={keyIdx++} className="italic text-foreground/85">{firstMatch.content}</em>);
    } else if (firstMatch.type === "link") {
      parts.push(
        <a
          key={keyIdx++}
          href={firstMatch.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline font-semibold hover:text-accent/80 transition-colors inline-flex items-center gap-0.5"
        >
          <span>{firstMatch.label}</span>
          <ExternalLink className="h-3 w-3 inline" />
        </a>
      );
    }

    currentText = currentText.substring(firstMatch.index + firstMatch.text.length);
  }

  return parts;
}

// Helper to extract video embed source
function getVideoEmbed(url: string): { type: "youtube" | "vimeo" | "loom" | "direct"; embedUrl: string } | null {
  const cleanUrl = url.trim();

  // YouTube
  const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0`,
    };
  }

  // Vimeo
  const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // Loom
  const loomMatch = cleanUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return {
      type: "loom",
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  // Direct storage / video file
  if (
    cleanUrl.includes(".supabase.co/storage/") ||
    cleanUrl.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)
  ) {
    return {
      type: "direct",
      embedUrl: cleanUrl,
    };
  }

  return null;
}

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`#]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function extractHeadings(markdown: string): HeadingItem[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const headings: HeadingItem[] = [];
  const slugCounts = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const cleanText = rawText.replace(/[*_`]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
      let slug = slugifyHeading(cleanText);
      if (!slug) slug = `section-${headings.length + 1}`;

      const count = slugCounts.get(slug) || 0;
      slugCounts.set(slug, count + 1);
      const uniqueId = count > 0 ? `${slug}-${count + 1}` : slug;

      headings.push({
        id: uniqueId,
        text: cleanText,
        level,
      });
    }
  }
  return headings;
}

export function PlaybookContentRenderer({ content }: PlaybookContentRendererProps) {
  if (!content || !content.trim()) {
    return <p className="text-sm text-muted-foreground italic">No content written yet.</p>;
  }

  const blocks = content.split(/\n\n+/);
  const headingSlugCounts = new Map<string, number>();

  return (
    <div className="space-y-4 text-foreground/90 leading-relaxed text-sm">
      {blocks.map((rawBlock, idx) => {
        const block = rawBlock.trim();
        if (!block) return null;

        // 1. Standalone Video Embed syntax: [video: URL] or raw video URL on a single line
        const explicitVideoMatch = block.match(/^\[video:\s*(https?:\/\/[^\s]+)\]$/i);
        const singleUrlMatch = block.match(/^https?:\/\/[^\s]+$/i);
        const testVideoUrl = explicitVideoMatch ? explicitVideoMatch[1] : (singleUrlMatch ? block : null);

        if (testVideoUrl) {
          const videoInfo = getVideoEmbed(testVideoUrl);
          if (videoInfo) {
            return (
              <div key={idx} className="my-5 rounded-2xl overflow-hidden border border-border/80 bg-surface-2 shadow-lg">
                <div className="px-4 py-2.5 bg-surface-1 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 capitalize">
                    <Film className="h-3.5 w-3.5 text-accent" /> {videoInfo.type} Video Embed
                  </span>
                  <a
                    href={testVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground text-[11px] inline-flex items-center gap-1"
                  >
                    Open Source <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative aspect-video w-full bg-black/40">
                  {videoInfo.type === "direct" ? (
                    <video
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain"
                      src={videoInfo.embedUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <iframe
                      src={videoInfo.embedUrl}
                      title="Playbook Video Embed"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  )}
                </div>
              </div>
            );
          }
        }

        // 2. Image: ![alt](url)
        const imageMatch = block.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imageMatch) {
          const alt = imageMatch[1];
          const src = imageMatch[2];
          return (
            <figure key={idx} className="my-4 space-y-1.5 text-center">
              <div className="rounded-2xl overflow-hidden border border-border/80 bg-surface-2 shadow-md inline-block max-w-full">
                <img src={src} alt={alt} className="max-h-[500px] w-auto object-contain mx-auto" />
              </div>
              {alt ? <figcaption className="text-xs text-muted-foreground italic">{alt}</figcaption> : null}
            </figure>
          );
        }

        // 3. Blockquote: > quote text
        if (block.startsWith(">")) {
          const quoteLines = block.split("\n").map((l) => l.replace(/^>\s?/, ""));
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-gold bg-gold/5 rounded-r-xl p-4 my-3 text-sm text-foreground/90 italic shadow-xs"
            >
              {quoteLines.map((line, qIdx) => (
                <p key={qIdx} className={qIdx > 0 ? "mt-1.5" : ""}>
                  {parseInline(line)}
                </p>
              ))}
            </blockquote>
          );
        }

        // 4. Headers: #, ##, ###, ####
        if (block.startsWith("#")) {
          const headerMatch = block.match(/^(#{1,6})\s+(.*)$/);
          if (headerMatch) {
            const level = headerMatch[1].length;
            const headingText = headerMatch[2];
            const cleanText = headingText.replace(/[*_`]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
            let baseSlug = slugifyHeading(cleanText);
            if (!baseSlug) baseSlug = `section-${idx}`;
            const count = headingSlugCounts.get(baseSlug) || 0;
            headingSlugCounts.set(baseSlug, count + 1);
            const headingId = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug;

            const HeadingTag = `h${level}` as any;
            const classNames =
              level === 1
                ? "scroll-mt-24 text-2xl font-extrabold tracking-tight mt-7 mb-3 text-foreground border-b border-border/60 pb-2"
                : level === 2
                ? "scroll-mt-24 text-lg font-bold tracking-tight mt-6 mb-2.5 text-foreground/90 border-b border-border/40 pb-1"
                : level === 3
                ? "scroll-mt-24 text-base font-bold tracking-tight mt-4 mb-2 text-gold"
                : "scroll-mt-24 text-sm font-semibold mt-3 mb-1 text-foreground/80";

            return (
              <HeadingTag key={idx} id={headingId} className={classNames}>
                {parseInline(headingText)}
              </HeadingTag>
            );
          }
        }

        // 5. Code block: ```
        if (block.startsWith("```")) {
          const lines = block.split("\n");
          const code = lines.slice(1, lines.length - (lines[lines.length - 1] === "```" ? 1 : 0)).join("\n");
          return (
            <pre
              key={idx}
              className="bg-surface-2 p-4 rounded-xl overflow-x-auto my-3 border border-border/80 text-xs font-mono text-foreground/95 shadow-inner"
            >
              <code>{code}</code>
            </pre>
          );
        }

        // 6. Tables: | col1 | col2 |
        if (block.includes("|") && block.split("\n").length >= 2) {
          const lines = block.split("\n");
          const rows = lines.map((line) =>
            line
              .split("|")
              .map((cell) => cell.trim())
              .filter((_, i, arr) => i > 0 && i < arr.length - 1)
          );

          if (lines[1]?.includes("-") && lines[1]?.includes("|")) {
            const headerRow = rows[0];
            const bodyRows = rows.slice(2);

            return (
              <div key={idx} className="my-4 border border-border/70 rounded-xl bg-surface-1 overflow-hidden shadow-xs">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/80">
                        {headerRow.map((cell, cIdx) => (
                          <th key={cIdx} className="p-3 font-bold text-muted-foreground uppercase tracking-wider">
                            {parseInline(cell)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {bodyRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-surface-2/40 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-3 text-foreground/90 font-medium">
                              {parseInline(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
        }

        // 7. Lists: - item or 1. item
        if (block.startsWith("- ") || block.startsWith("* ") || /^\d+\.\s/.test(block)) {
          const items = block.split(/\n/);
          return (
            <ul key={idx} className="list-disc pl-5 my-2.5 space-y-1.5 text-foreground/90">
              {items.map((item, itemIdx) => {
                const isChecklist = item.includes("- [ ]") || item.includes("- [x]");
                if (isChecklist) {
                  const isChecked = item.includes("- [x]");
                  const cleanItem = item.replace(/^[-*]\s*\[[ x]\]\s*/, "");
                  return (
                    <li key={itemIdx} className="list-none flex items-start gap-2 -ml-5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="mt-0.5 rounded border-border accent-accent"
                      />
                      <span>{parseInline(cleanItem)}</span>
                    </li>
                  );
                }
                const cleanItem = item.replace(/^([-*]|\d+\.)\s+/, "");
                return <li key={itemIdx}>{parseInline(cleanItem)}</li>;
              })}
            </ul>
          );
        }

        // 8. Default Paragraph
        return (
          <p key={idx} className="my-2.5 text-foreground/90 leading-relaxed">
            {parseInline(block)}
          </p>
        );
      })}
    </div>
  );
}
