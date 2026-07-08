import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PhotoLike = {
  id: string;
  name?: string | null;
  file_url?: string | null;
  thumbnail_url?: string | null;
};

function sanitize(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "listing";
}

function extFromUrl(url: string, fallback = "jpg") {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const m = clean.match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}

function isImageUrl(url: string) {
  const clean = url.split("?")[0].split("#")[0];
  return /\.(png|jpe?g|gif|webp|avif|heic|heif|tiff?|bmp)$/i.test(clean);
}

async function fetchPhotos(photos: PhotoLike[]) {
  const usable = photos
    .map((p) => ({ ...p, url: p.file_url || p.thumbnail_url || "" }))
    .filter((p) => p.url && isImageUrl(p.url));

  const zip = new JSZip();
  const used = new Set<string>();
  let ok = 0;

  await Promise.all(
    usable.map(async (p, idx) => {
      try {
        const res = await fetch(p.url, { credentials: "omit" });
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = extFromUrl(p.url);
        const base = sanitize(p.name?.replace(/\.[^.]+$/, "") || `photo_${idx + 1}`);
        let name = `${base}.${ext}`;
        let n = 1;
        while (used.has(name)) {
          name = `${base}_${n}.${ext}`;
          n++;
        }
        used.add(name);
        zip.file(name, blob);
        ok++;
      } catch {
        // skip
      }
    }),
  );

  return { zip, count: ok, total: usable.length };
}

async function buildZipBlob(photos: PhotoLike[]) {
  const { zip, count, total } = await fetchPhotos(photos);
  if (!count) throw new Error("No photos could be downloaded");
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, count, total };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isMobile() {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < 768) return true;
  if (typeof navigator !== "undefined") {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  }
  return false;
}

function canShareFiles() {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as any).canShare === "function" &&
    typeof (navigator as any).share === "function"
  );
}

export function DownloadPhotosButton({
  photos,
  address,
  className,
}: {
  photos: PhotoLike[];
  address: string;
  className?: string;
}) {
  const [busy, setBusy] = useState<"zip" | "share" | null>(null);
  const hasPhotos = photos.some((p) => {
    const u = p.file_url || p.thumbnail_url || "";
    return u && isImageUrl(u);
  });

  const baseName = `${sanitize(address)}_${new Date().toISOString().slice(0, 10)}`;

  const doZip = async () => {
    if (!hasPhotos) {
      toast.error("No photos available for this listing");
      return;
    }
    setBusy("zip");
    try {
      const { blob, count, total } = await buildZipBlob(photos);
      triggerDownload(blob, `${baseName}.zip`);
      toast.success(
        count === total
          ? `Downloading ${count} photo${count === 1 ? "" : "s"}`
          : `Downloading ${count} of ${total} photos`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to build ZIP");
    } finally {
      setBusy(null);
    }
  };

  const doShare = async () => {
    if (!hasPhotos) {
      toast.error("No photos available for this listing");
      return;
    }
    setBusy("share");
    try {
      const usable = photos
        .map((p, idx) => ({ ...p, url: p.file_url || p.thumbnail_url || "", idx }))
        .filter((p) => p.url && isImageUrl(p.url));
      const files: File[] = [];
      await Promise.all(
        usable.map(async (p) => {
          try {
            const res = await fetch(p.url, { credentials: "omit" });
            if (!res.ok) return;
            const blob = await res.blob();
            const ext = extFromUrl(p.url);
            const base = sanitize(p.name?.replace(/\.[^.]+$/, "") || `photo_${p.idx + 1}`);
            files.push(new File([blob], `${base}.${ext}`, { type: blob.type || "image/jpeg" }));
          } catch {
            // skip
          }
        }),
      );
      if (!files.length) throw new Error("No photos could be loaded");
      const nav: any = navigator;
      const data = { files, title: address, text: address };
      if (nav.canShare && nav.canShare(data)) {
        await nav.share(data);
        toast.success("Share opened");
      } else {
        throw new Error("Sharing files is not supported on this device");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.error(e?.message || "Share failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const mobileShare = isMobile() && canShareFiles();

  if (mobileShare) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            disabled={busy !== null}
            className={
              className ?? "h-7 bg-gold text-navy hover:bg-gold/90"
            }
          >
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
            {busy === "zip" ? "Zipping…" : busy === "share" ? "Preparing…" : "Download Photos"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={doZip}>
            <Download className="h-4 w-4 mr-2" /> Download as ZIP
          </DropdownMenuItem>
          <DropdownMenuItem onClick={doShare}>
            <Share2 className="h-4 w-4 mr-2" /> Share to Photos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      size="sm"
      onClick={doZip}
      disabled={busy !== null}
      className={className ?? "h-7 bg-gold text-navy hover:bg-gold/90"}
    >
      {busy === "zip" ? (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Zipping…
        </>
      ) : (
        <>
          <Download className="h-3 w-3 mr-1" /> Download All Photos
        </>
      )}
    </Button>
  );
}
