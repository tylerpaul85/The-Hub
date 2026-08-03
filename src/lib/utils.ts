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
  if (!url) return null;
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
