import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function QrCode({
  url,
  value,
  size = 64,
  className = "",
  darkColor = "#0f172a",
  lightColor = "#ffffff",
  showModal = true,
  onClick,
}: {
  url?: string;
  value?: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
  showModal?: boolean;
  onClick?: () => void;
}) {
  const targetUrl = url || value || "";
  const [src, setSrc] = useState<string | null>(null);
  const [bigSrc, setBigSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!targetUrl) {
      setSrc(null);
      setBigSrc(null);
      return;
    }

    let cancelled = false;
    Promise.all([
      QRCode.toDataURL(targetUrl, {
        width: Math.max(size * 2, 200), // higher density for crisp rendering
        margin: 1,
        color: { dark: darkColor, light: lightColor },
      }),
      QRCode.toDataURL(targetUrl, {
        width: 800,
        margin: 2,
        color: { dark: darkColor, light: lightColor },
      }),
    ])
      .then(([thumb, big]) => {
        if (cancelled) return;
        setSrc(thumb);
        setBigSrc(big);
      })
      .catch((err) => {
        console.error("QRCode generation error:", err);
        if (!cancelled) {
          setSrc(null);
          setBigSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetUrl, size, darkColor, lightColor]);

  if (!targetUrl) return null;

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-muted-foreground animate-pulse ${className}`}
      >
        QR...
      </div>
    );
  }

  const handleImageClick = () => {
    if (onClick) {
      onClick();
    } else if (showModal) {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleImageClick}
        className={`shrink-0 inline-block focus:outline-none focus:ring-2 focus:ring-gold/50 rounded transition-opacity ${
          showModal || onClick ? "cursor-pointer hover:opacity-90" : "cursor-default"
        } ${className}`}
        title={showModal ? "Tap to enlarge QR Code" : undefined}
      >
        <img
          src={src}
          alt="QR code"
          width={size}
          height={size}
          className="rounded object-contain"
        />
      </button>

      {showModal && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md text-center">
            <DialogHeader>
              <DialogTitle>Scan with Camera</DialogTitle>
              <DialogDescription className="break-all text-xs font-mono">
                {targetUrl}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-3">
              {bigSrc && (
                <div className="p-4 bg-white rounded-2xl shadow-xl border border-slate-200">
                  <img src={bigSrc} alt="QR code" className="w-64 h-64 mx-auto rounded" />
                </div>
              )}
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold font-medium hover:underline break-all"
              >
                Open link directly
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
