import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Film, Search, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Brand, BRANDS, BRAND_STYLES, VIDEO_STAGE_LABEL, type VideoStage } from "@/lib/content";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/videos-archive")({
  component: VideosArchivePage,
  head: () => ({ meta: [{ title: "Video Archive — MSREG Hub" }] }),
});

interface Video {
  id: string;
  title: string;
  stage: VideoStage;
  created_at: string;
  publish_at: string | null;
  estimated_publish_date: string | null;
  is_archived: boolean;
  video_type: "horizontal" | "reel";
  brand: Brand;
  is_listing: boolean;
  drive_link: string | null;
}

function VideosArchivePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<"all" | Brand>("all");

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["videos-archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("is_archived", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Video[];
    },
  });

  const unarchive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("videos")
        .update({ is_archived: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Video unarchived");
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["videos-archive"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      if (brandFilter !== "all" && v.brand !== brandFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!v.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [videos, brandFilter, search]);

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/videos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Film className="w-6 h-6 text-muted-foreground" />
              Video Archive
            </h1>
            <p className="text-sm text-muted-foreground">
              Past and posted videos removed from the active pipeline.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search archive..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card h-9"
            />
          </div>
          <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v as any)}>
            <SelectTrigger className="w-[140px] bg-card h-9">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {BRANDS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading archive...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ArchiveEmptyState />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="font-medium truncate max-w-[300px]" title={v.title}>
                      {v.title}
                    </div>
                    {v.drive_link && (
                      <a
                        href={v.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1 w-fit"
                      >
                        <Link2 className="w-3 h-3" />
                        Drive Link
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={BRAND_STYLES[v.brand]}>
                      {v.brand}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {v.is_listing ? "Listing " : "Brand "}
                      {v.video_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {VIDEO_STAGE_LABEL[v.stage] || v.stage}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.publish_at
                      ? format(new Date(v.publish_at), "MMM d, yyyy")
                      : v.estimated_publish_date
                        ? format(new Date(v.estimated_publish_date), "MMM d, yyyy")
                        : "No date"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unarchive.mutate(v.id)}
                      disabled={unarchive.isPending}
                    >
                      Unarchive
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function ArchiveEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Film className="w-10 h-10 text-muted-foreground/30 mb-2" />
      <h3 className="text-lg font-medium">No archived videos</h3>
      <p className="text-sm text-muted-foreground max-w-[400px]">
        Videos that have been archived from the main pipeline will appear here. Try adjusting your search or filters.
      </p>
    </div>
  );
}
