import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Users,
  Layers,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { PlaybookProduct } from "@/lib/playbooks.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlaybookProductCardProps {
  product: PlaybookProduct;
  onSelect: (product: PlaybookProduct) => void;
  onEditProduct?: (product: PlaybookProduct) => void;
  onDeleteProduct?: (product: PlaybookProduct) => void;
}

export function PlaybookProductCard({
  product,
  onSelect,
  onEditProduct,
  onDeleteProduct,
}: PlaybookProductCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={() => onSelect(product)}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-surface-1/90 overflow-hidden hover:border-gold/50 hover:shadow-xl hover:shadow-black/40 transition-all duration-300 cursor-pointer"
    >
      {/* 16:9 Image Aspect Ratio Container matching GHL Screenshot */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
        {!imageError && product.cover_image_url ? (
          <img
            src={product.cover_image_url}
            alt={product.name}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-surface-2 via-surface-1 to-black text-center">
            <BookOpen className="h-10 w-10 text-gold/60 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {product.name}
            </span>
          </div>
        )}

        {/* Subtle Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm backdrop-blur-md ${
              product.status === "published"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-amber-500/20 text-amber-400 border-amber-500/40"
            }`}
          >
            {product.status === "published" ? "Published" : "Draft"}
          </Badge>

          {/* Three dots menu */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 backdrop-blur-md cursor-pointer"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Product Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-surface-1 border-border">
                <DropdownMenuItem
                  onClick={() => onSelect(product)}
                  className="cursor-pointer text-xs flex items-center gap-2"
                >
                  <Layers className="h-3.5 w-3.5 text-gold" />
                  <span>Build Curriculum</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/playbooks"
                    search={{ course: product.slug }}
                    className="cursor-pointer text-xs flex items-center gap-2 w-full"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                    <span>Preview as Agent</span>
                  </Link>
                </DropdownMenuItem>
                {onEditProduct && (
                  <DropdownMenuItem
                    onClick={() => onEditProduct(product)}
                    className="cursor-pointer text-xs flex items-center gap-2"
                  >
                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Edit Details</span>
                  </DropdownMenuItem>
                )}
                {onDeleteProduct && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDeleteProduct(product)}
                      className="cursor-pointer text-xs flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Product</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Bottom stats pill over image */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white/90">
          <span className="flex items-center gap-1.5 font-medium bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
            <Layers className="h-3 w-3 text-gold" />
            <span>
              {product.sections_count} Sections • {product.lessons_count} Lessons
            </span>
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground group-hover:text-gold transition-colors line-clamp-1">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Footer info matching GHL screenshot: "0 members" */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground/80" />
            <span>{product.members_count || 0} members</span>
          </span>

          <span className="flex items-center gap-1 text-[11px] font-semibold text-gold group-hover:translate-x-0.5 transition-transform">
            <span>Manage</span>
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}
