import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts Google Drive shareable file URLs to direct image preview URLs (lh3.googleusercontent.com)
 * so they can be rendered in HTML <img> tags.
 */
export function getGoogleDrivePreviewUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const str = url.trim();
  if (!str) return null;

  // Match file ID from various Google Drive URL formats
  const fileIdMatch =
    str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    str.match(/\/open\?id=([a-zA-Z0-9_-]+)/) ||
    str.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    str.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);

  if (fileIdMatch && fileIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  }

  return str;
}

export interface ImageFramingSettings {
  fit: "cover" | "contain";
  position: "top" | "center" | "bottom" | "custom";
  yPercent: number; // 0 to 100
  zoom: number; // 1 to 2.5
}

/**
 * Parses thumbnail framing, object-fit, and vertical focal point adjustments stored in URL hash
 */
export function parseImageSettings(url: string | null | undefined) {
  if (!url || typeof url !== "string") {
    return {
      rawUrl: "",
      cleanUrl: "",
      fit: "cover" as const,
      position: "center" as const,
      yPercent: 50,
      zoom: 1,
      style: { objectFit: "cover" as const, objectPosition: "center" } as React.CSSProperties,
    };
  }

  const rawUrl = url.trim();
  const hashIdx = rawUrl.indexOf("#");
  const cleanUrl = hashIdx !== -1 ? rawUrl.slice(0, hashIdx) : rawUrl;
  const hashString = hashIdx !== -1 ? rawUrl.slice(hashIdx + 1) : "";

  let fit: "cover" | "contain" = "cover";
  let position: "top" | "center" | "bottom" | "custom" = "center";
  let yPercent = 50;
  let zoom = 1;

  if (hashString) {
    try {
      const params = new URLSearchParams(hashString);
      if (params.get("fit") === "contain") fit = "contain";
      const pos = params.get("pos");
      if (pos === "top" || pos === "bottom" || pos === "center" || pos === "custom") {
        position = pos;
      }
      const yVal = params.get("y");
      if (yVal !== null && !isNaN(Number(yVal))) {
        yPercent = Math.max(0, Math.min(100, Number(yVal)));
        if (!pos) position = yPercent <= 25 ? "top" : yPercent >= 75 ? "bottom" : "center";
      } else if (position === "top") {
        yPercent = 15;
      } else if (position === "bottom") {
        yPercent = 85;
      }
      const zVal = params.get("zoom");
      if (zVal !== null && !isNaN(Number(zVal))) {
        zoom = Math.max(1, Math.min(2.5, Number(zVal)));
      }
    } catch {}
  }

  const objectPosition = `50% ${yPercent}%`;
  const style: React.CSSProperties = {
    objectFit: fit,
    objectPosition,
    ...(zoom > 1 ? { transform: `scale(${zoom})`, transformOrigin: `50% ${yPercent}%` } : {}),
  };

  return {
    rawUrl,
    cleanUrl,
    fit,
    position,
    yPercent,
    zoom,
    style,
  };
}

export function buildImageFramingUrl(
  baseCleanUrl: string,
  settings: {
    fit?: "cover" | "contain";
    position?: "top" | "center" | "bottom" | "custom";
    yPercent?: number;
    zoom?: number;
  }
): string {
  const clean = baseCleanUrl.split("#")[0].trim();
  const params = new URLSearchParams();

  if (settings.fit && settings.fit !== "cover") {
    params.set("fit", settings.fit);
  }
  if (settings.position && settings.position !== "center") {
    params.set("pos", settings.position);
  }
  if (typeof settings.yPercent === "number" && settings.yPercent !== 50) {
    params.set("y", String(Math.round(settings.yPercent)));
  }
  if (typeof settings.zoom === "number" && settings.zoom > 1) {
    params.set("zoom", String(Math.round(settings.zoom * 100) / 100));
  }

  const hash = params.toString();
  return hash ? `${clean}#${hash}` : clean;
}
