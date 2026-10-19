import logo from "@/assets/msreg-logo.png";

interface PlaybookThumbnailProps {
  title?: string;
  category?: string;
  thumbnailUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PlaybookThumbnail({
  title,
  category,
  thumbnailUrl,
  className = "",
  size = "md",
}: PlaybookThumbnailProps) {
  if (thumbnailUrl) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-border/70 bg-black/60 aspect-video shrink-0 shadow-xs ${className}`}
      >
        <img
          src={thumbnailUrl}
          alt={title || "Playbook Thumbnail"}
          className="w-full h-full object-cover object-center"
        />
      </div>
    );
  }

  // High-end branded card matching the MSREG video thumbnail from the screenshot
  const isSm = size === "sm";
  const isLg = size === "lg";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-[#12141a] via-[#0d0f14] to-black aspect-video shrink-0 shadow-sm flex flex-col items-center justify-center p-2.5 sm:p-3 select-none group/thumb ${className}`}
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(196,90,44,0.12),transparent)] pointer-events-none" />

      {/* Top micro gold line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      {/* Centered MSREG Logo */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-[85%]">
        <img
          src={logo}
          alt="Matt Smith Real Estate Group"
          className={`object-contain filter contrast-125 brightness-110 drop-shadow-md group-hover/thumb:scale-105 transition-transform duration-300 ${
            isSm ? "h-6 max-w-[90px]" : isLg ? "h-12 max-w-[170px]" : "h-8 sm:h-9 max-w-[130px]"
          }`}
        />
      </div>

      {/* Subtle bottom badge */}
      {category && (
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
          <span className="truncate max-w-[80%]">{category}</span>
          <span className="text-gold/90 font-mono text-[8px]">MSREG</span>
        </div>
      )}
    </div>
  );
}
