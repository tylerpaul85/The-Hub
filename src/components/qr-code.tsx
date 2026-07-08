import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function QrCode({ url, size = 64 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [bigSrc, setBigSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      QRCode.toDataURL(url, { width: size, margin: 1, color: { dark: "#1e3a5f", light: "#ffffff" } }),
      QRCode.toDataURL(url, { width: 600, margin: 2, color: { dark: "#1e3a5f", light: "#ffffff" } }),
    ])
      .then(([thumb, big]) => {
        if (cancelled) return;
        setSrc(thumb);
        setBigSrc(big);
      })
      .catch(() => { if (!cancelled) { setSrc(null); setBigSrc(null); } });
    return () => { cancelled = true; };
  }, [url, size]);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 hover:opacity-80 transition-opacity"
        title="Tap to enlarge"
      >
        <img src={src} alt="QR code" width={size} height={size} className="rounded border border-gold/20" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan to open</DialogTitle>
            <DialogDescription className="break-all text-xs">{url}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {bigSrc && <img src={bigSrc} alt="QR code" className="w-full max-w-sm h-auto rounded" />}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline break-all text-center">
              Open link
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
