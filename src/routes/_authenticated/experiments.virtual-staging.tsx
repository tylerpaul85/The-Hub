import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { stageRoom } from "@/lib/staging.functions";
import { convertDayToDusk } from "@/lib/day-to-dusk.functions";
import { declutterRoom } from "@/lib/declutter.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Download,
  RotateCcw,
  AlertTriangle,
  Wand2,
  ArrowLeft,
  Sunset,
  Sprout,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/experiments/virtual-staging")({
  component: VirtualStagingPage,
});

const ROOM_TYPES = [
  { value: "living_room", label: "Living Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "dining_room", label: "Dining Room" },
  { value: "home_office", label: "Home Office" },
];

const STYLES = [
  { value: "modern", label: "Modern" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "farmhouse", label: "Farmhouse" },
  { value: "luxury", label: "Luxury" },
  { value: "coastal", label: "Coastal" },
];

const SKY_STYLES = [
  { value: "sunset", label: "Sunset — warm orange/pink sky" },
  { value: "dusk", label: "Dusk — deep blue evening sky" },
  { value: "night", label: "Night — dark sky with stars" },
];

const INTENSITIES = [
  { value: "light", label: "Light — obvious clutter only" },
  { value: "medium", label: "Medium — clutter + personal items" },
  { value: "heavy", label: "Heavy — clean, staged look" },
];

type StagingJob = {
  id: string;
  user_id: string;
  source_image_url: string;
  room_type: string | null;
  style: string | null;
  status: "pending" | "processing" | "done" | "error";
  result_urls: string[] | null;
  error_message: string | null;
  created_at: string;
};

function AccessDenied() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="p-8 text-center border-gold/30">
        <AlertTriangle className="h-10 w-10 text-gold mx-auto mb-3" />
        <h1 className="text-xl font-semibold mb-1">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          The Virtual Staging Tool is restricted to admins and the internal marketing team.
        </p>
        <Link to="/experiments" className="inline-block mt-4">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Experiments
          </Button>
        </Link>
      </Card>
    </div>
  );
}

function VirtualStagingPage() {
  const { user, roles, loading } = useAuth();
  const allowed =
    roles.includes("admin") || roles.includes("marketing_coordinator");

  if (loading) return null;
  if (!user || !allowed) return <AccessDenied />;

  return <ToolShell userId={user.id} />;
}

function ToolShell({ userId }: { userId: string }) {
  const [mode, setMode] = useState<"staging" | "dusk" | "declutter">("staging");

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Link to="/experiments">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Wand2 className="h-6 w-6 text-gold" />
          <div>
            <h1 className="text-2xl font-semibold">Virtual Staging Tool</h1>
            <p className="text-sm text-muted-foreground">
              Stage empty rooms, convert daytime exteriors to dusk, or declutter occupied rooms.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="staging" className="gap-2">
            <Sparkles className="h-4 w-4" /> Virtual Staging
          </TabsTrigger>
          <TabsTrigger value="dusk" className="gap-2">
            <Sunset className="h-4 w-4" /> Day-to-Dusk
          </TabsTrigger>
          <TabsTrigger value="declutter" className="gap-2">
            <Sprout className="h-4 w-4" /> Declutter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staging" className="mt-6">
          <StagingTool userId={userId} />
        </TabsContent>
        <TabsContent value="dusk" className="mt-6">
          <DuskTool userId={userId} />
        </TabsContent>
        <TabsContent value="declutter" className="mt-6">
          <DeclutterTool userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Shared upload dropzone ----------
function useUpload(userId: string) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (f: File) => {
      if (!f.type.startsWith("image/")) {
        toast.error("Please upload a JPG or PNG image");
        return;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error("Image must be under 20 MB");
        return;
      }
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setSourceUrl(null);
      setUploading(true);
      try {
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("staging-uploads")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await supabase.storage
          .from("staging-uploads")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (sErr || !signed) throw sErr ?? new Error("Failed to sign URL");
        setSourceUrl(signed.signedUrl);
        toast.success("Image ready");
      } catch (e: any) {
        toast.error(e.message ?? "Upload failed");
        setFile(null);
        setPreviewUrl(null);
      } finally {
        setUploading(false);
      }
    },
    [userId],
  );

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setSourceUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    file,
    previewUrl,
    sourceUrl,
    uploading,
    dragOver,
    setDragOver,
    fileInputRef,
    handleFile,
    reset,
  };
}

function Dropzone({
  label,
  hint,
  upload,
}: {
  label: string;
  hint: string;
  upload: ReturnType<typeof useUpload>;
}) {
  const { previewUrl, sourceUrl, uploading, dragOver, setDragOver, fileInputRef, handleFile } =
    upload;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-gold bg-gold/10"
            : "border-border hover:border-gold/60 hover:bg-muted/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-48 rounded-md border border-border"
            />
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : sourceUrl ? (
                <span className="text-gold font-medium">✓ Image ready</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-7 w-7 text-gold" />
            <div className="text-sm font-medium text-foreground">
              Drag & drop, or click to choose
            </div>
            <div className="text-xs">{hint}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Job polling + history hooks ----------
function useActiveJob(activeJobId: string | null) {
  return useQuery({
    queryKey: ["staging_job", activeJobId],
    enabled: !!activeJobId,
    refetchInterval: (q) => {
      const j = q.state.data as StagingJob | undefined;
      if (!j) return 2000;
      return j.status === "done" || j.status === "error" ? false : 2000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staging_jobs" as any)
        .select("*")
        .eq("id", activeJobId!)
        .single();
      if (error) throw error;
      return data as unknown as StagingJob;
    },
  });
}

function useHistory(userId: string, kind: "staging" | "exterior" | "declutter") {
  return useQuery({
    queryKey: ["staging_jobs", userId, kind],
    queryFn: async () => {
      let q = supabase
        .from("staging_jobs" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (kind === "exterior") {
        q = q.eq("room_type", "exterior");
      } else if (kind === "declutter") {
        q = q.eq("room_type", "interior");
      } else {
        q = q.not("room_type", "in", "(exterior,interior)");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as StagingJob[];
    },
  });
}

// ---------- Results / Error / Processing shared blocks ----------
function ProcessingCard({ label }: { label: string }) {
  return (
    <Card className="p-10 text-center border-gold/30">
      <Loader2 className="h-10 w-10 animate-spin mx-auto text-gold mb-4" />
      <div className="font-semibold">{label}</div>
      <div className="text-sm text-muted-foreground mt-1">
        This takes ~60 seconds. You can leave this page open.
      </div>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <Card className="p-6 border-destructive/40 bg-destructive/5 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-5 w-5" /> Job failed
      </div>
      <div className="text-sm text-muted-foreground break-words">{message}</div>
      <div className="flex gap-2">
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" /> Retry
        </Button>
        <Button onClick={onReset} variant="ghost">
          Start over
        </Button>
      </div>
    </Card>
  );
}

function ResultsCard({
  title,
  urls,
  onReset,
  onPick,
  resetLabel,
}: {
  title: string;
  urls: string[];
  onReset: () => void;
  onPick: (url: string) => void;
  resetLabel: string;
}) {
  return (
    <Card className="p-5 space-y-4 border-gold/30">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" /> {title}
        </h2>
        <Button onClick={onReset} variant="outline" size="sm" className="gap-2">
          <RotateCcw className="h-4 w-4" /> {resetLabel}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {urls.map((url, i) => (
          <div key={i} className="space-y-2">
            <button
              type="button"
              onClick={() => onPick(url)}
              className="block w-full rounded-md overflow-hidden border border-border hover:border-gold transition-colors"
            >
              <img src={url} alt={`Result ${i + 1}`} className="w-full h-auto" />
            </button>
            <a href={url} target="_blank" rel="noreferrer" download className="block">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Download className="h-4 w-4" /> Download
              </Button>
            </a>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HistoryGrid({
  history,
  onPick,
  formatLabel,
}: {
  history: StagingJob[];
  onPick: (id: string) => void;
  formatLabel: (j: StagingJob) => string;
}) {
  if (!history.length) return null;
  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-semibold">History</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {history.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => onPick(j.id)}
            className="text-left rounded-md border border-border hover:border-gold/60 transition-colors overflow-hidden"
          >
            <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
              {j.source_image_url ? (
                <img
                  src={j.source_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="p-3 text-sm">
              <div className="font-medium capitalize">{formatLabel(j)}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-between mt-1">
                <span>{new Date(j.created_at).toLocaleDateString()}</span>
                <span
                  className={
                    j.status === "done"
                      ? "text-gold"
                      : j.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {j.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------- Virtual Staging tool ----------
function StagingTool({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const stageRoomFn = useServerFn(stageRoom);
  const upload = useUpload(userId);

  const [roomType, setRoomType] = useState<string>("");
  const [style, setStyle] = useState<string>("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  const { data: history } = useHistory(userId, "staging");
  const { data: activeJob } = useActiveJob(activeJobId);

  useEffect(() => {
    if (activeJob?.status === "done" || activeJob?.status === "error") {
      qc.invalidateQueries({ queryKey: ["staging_jobs", userId, "staging"] });
    }
  }, [activeJob?.status, qc, userId]);

  const stageMut = useMutation({
    mutationFn: async () => {
      if (!upload.sourceUrl || !roomType || !style) throw new Error("Missing fields");
      const { data: inserted, error } = await supabase
        .from("staging_jobs" as any)
        .insert({
          user_id: userId,
          source_image_url: upload.sourceUrl,
          room_type: roomType,
          style,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;
      const job = inserted as unknown as StagingJob;
      setActiveJobId(job.id);
      stageRoomFn({
        data: {
          job_id: job.id,
          source_image_url: upload.sourceUrl,
          room_type: roomType,
          style,
          num_images: 2,
        },
      }).catch((e) => console.error("stageRoom failed", e));
      return job;
    },
    onError: (e: any) => toast.error(e.message ?? "Could not start staging"),
  });

  const retry = () => {
    if (!activeJob) return;
    stageRoomFn({
      data: {
        job_id: activeJob.id,
        source_image_url: activeJob.source_image_url,
        room_type: activeJob.room_type ?? roomType,
        style: activeJob.style ?? style,
        num_images: 2,
      },
    }).catch((e) => toast.error(e.message ?? "Retry failed"));
    qc.invalidateQueries({ queryKey: ["staging_job", activeJob.id] });
  };

  const reset = () => {
    upload.reset();
    setRoomType("");
    setStyle("");
    setActiveJobId(null);
  };

  const canStage =
    !!upload.sourceUrl && !!roomType && !!style && !upload.uploading && !stageMut.isPending;
  const isProcessing =
    activeJob && (activeJob.status === "pending" || activeJob.status === "processing");
  const isDone = activeJob?.status === "done";
  const isError = activeJob?.status === "error";

  return (
    <div className="space-y-6">
      {!isDone && !isProcessing && (
        <Card className="p-5 space-y-5 border-gold/20">
          <Dropzone label="Empty Room Photo" hint="JPG or PNG, up to 20 MB" upload={upload} />
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select value={roomType} onValueChange={setRoomType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => stageMut.mutate()}
            disabled={!canStage}
            className="w-full bg-gold text-navy hover:bg-gold/90"
            size="lg"
          >
            <Sparkles className="h-4 w-4 mr-2" /> Stage Room
          </Button>
        </Card>
      )}

      {isProcessing && <ProcessingCard label="Processing your staging…" />}
      {isError && (
        <ErrorCard
          message={activeJob?.error_message ?? "Unknown error"}
          onRetry={retry}
          onReset={reset}
        />
      )}
      {isDone && activeJob?.result_urls && (
        <ResultsCard
          title="Staged Results"
          urls={activeJob.result_urls}
          onReset={reset}
          onPick={setModalUrl}
          resetLabel="New Staging"
        />
      )}

      <HistoryGrid
        history={history ?? []}
        onPick={setActiveJobId}
        formatLabel={(j) =>
          `${(j.room_type ?? "").replace(/_/g, " ")} • ${j.style ?? ""}`
        }
      />

      <Dialog open={!!modalUrl} onOpenChange={(o) => !o && setModalUrl(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
          {modalUrl && (
            <img src={modalUrl} alt="Full size" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Day-to-Dusk tool ----------
function DuskTool({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const duskFn = useServerFn(convertDayToDusk);
  const upload = useUpload(userId);

  const [skyStyle, setSkyStyle] = useState<string>("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  const { data: history } = useHistory(userId, "exterior");
  const { data: activeJob } = useActiveJob(activeJobId);

  useEffect(() => {
    if (activeJob?.status === "done" || activeJob?.status === "error") {
      qc.invalidateQueries({ queryKey: ["staging_jobs", userId, "exterior"] });
    }
  }, [activeJob?.status, qc, userId]);

  const convertMut = useMutation({
    mutationFn: async () => {
      if (!upload.sourceUrl || !skyStyle) throw new Error("Missing fields");
      const { data: inserted, error } = await supabase
        .from("staging_jobs" as any)
        .insert({
          user_id: userId,
          source_image_url: upload.sourceUrl,
          room_type: "exterior",
          style: skyStyle,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;
      const job = inserted as unknown as StagingJob;
      setActiveJobId(job.id);
      duskFn({
        data: {
          job_id: job.id,
          source_image_url: upload.sourceUrl,
          sky_style: skyStyle,
          num_images: 3,
        },
      }).catch((e) => console.error("convertDayToDusk failed", e));
      return job;
    },
    onError: (e: any) => toast.error(e.message ?? "Could not start conversion"),
  });

  const retry = () => {
    if (!activeJob) return;
    duskFn({
      data: {
        job_id: activeJob.id,
        source_image_url: activeJob.source_image_url,
        sky_style: activeJob.style ?? skyStyle,
        num_images: 3,
      },
    }).catch((e) => toast.error(e.message ?? "Retry failed"));
    qc.invalidateQueries({ queryKey: ["staging_job", activeJob.id] });
  };

  const reset = () => {
    upload.reset();
    setSkyStyle("");
    setActiveJobId(null);
  };

  const canConvert =
    !!upload.sourceUrl && !!skyStyle && !upload.uploading && !convertMut.isPending;
  const isProcessing =
    activeJob && (activeJob.status === "pending" || activeJob.status === "processing");
  const isDone = activeJob?.status === "done";
  const isError = activeJob?.status === "error";

  return (
    <div className="space-y-6">
      {!isDone && !isProcessing && (
        <Card className="p-5 space-y-5 border-gold/20">
          <Dropzone
            label="Exterior Daytime Photo"
            hint="JPG or PNG, up to 20 MB"
            upload={upload}
          />
          <div className="space-y-2">
            <Label>Sky Style</Label>
            <Select value={skyStyle} onValueChange={setSkyStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a sky" />
              </SelectTrigger>
              <SelectContent>
                {SKY_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => convertMut.mutate()}
            disabled={!canConvert}
            className="w-full bg-gold text-navy hover:bg-gold/90"
            size="lg"
          >
            <Sunset className="h-4 w-4 mr-2" /> Convert to Dusk
          </Button>
        </Card>
      )}

      {isProcessing && <ProcessingCard label="Converting to dusk…" />}
      {isError && (
        <ErrorCard
          message={activeJob?.error_message ?? "Unknown error"}
          onRetry={retry}
          onReset={reset}
        />
      )}
      {isDone && activeJob?.result_urls && (
        <ResultsCard
          title="Dusk Results"
          urls={activeJob.result_urls}
          onReset={reset}
          onPick={setModalUrl}
          resetLabel="New Conversion"
        />
      )}

      <HistoryGrid
        history={history ?? []}
        onPick={setActiveJobId}
        formatLabel={(j) => `Exterior • ${j.style ?? ""}`}
      />

      <Dialog open={!!modalUrl} onOpenChange={(o) => !o && setModalUrl(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
          {modalUrl && (
            <img src={modalUrl} alt="Full size" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Declutter tool ----------
function DeclutterTool({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const declutterFn = useServerFn(declutterRoom);
  const upload = useUpload(userId);

  const [intensity, setIntensity] = useState<string>("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  const { data: history } = useHistory(userId, "declutter");
  const { data: activeJob } = useActiveJob(activeJobId);

  useEffect(() => {
    if (activeJob?.status === "done" || activeJob?.status === "error") {
      qc.invalidateQueries({ queryKey: ["staging_jobs", userId, "declutter"] });
    }
  }, [activeJob?.status, qc, userId]);

  const declutterMut = useMutation({
    mutationFn: async () => {
      if (!upload.sourceUrl || !intensity) throw new Error("Missing fields");
      const { data: inserted, error } = await supabase
        .from("staging_jobs" as any)
        .insert({
          user_id: userId,
          source_image_url: upload.sourceUrl,
          room_type: "interior",
          style: intensity,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;
      const job = inserted as unknown as StagingJob;
      setActiveJobId(job.id);
      declutterFn({
        data: {
          job_id: job.id,
          source_image_url: upload.sourceUrl,
          intensity: intensity as "light" | "medium" | "heavy",
          num_images: 1,
        },
      }).catch((e) => console.error("declutterRoom failed", e));
      return job;
    },
    onError: (e: any) => toast.error(e.message ?? "Could not start declutter"),
  });

  const retry = () => {
    if (!activeJob) return;
    declutterFn({
      data: {
        job_id: activeJob.id,
        source_image_url: activeJob.source_image_url,
        intensity: (activeJob.style ?? intensity) as "light" | "medium" | "heavy",
        num_images: 1,
      },
    }).catch((e) => toast.error(e.message ?? "Retry failed"));
    qc.invalidateQueries({ queryKey: ["staging_job", activeJob.id] });
  };

  const reset = () => {
    upload.reset();
    setIntensity("");
    setActiveJobId(null);
  };

  const canRun =
    !!upload.sourceUrl && !!intensity && !upload.uploading && !declutterMut.isPending;
  const isProcessing =
    activeJob && (activeJob.status === "pending" || activeJob.status === "processing");
  const isDone = activeJob?.status === "done";
  const isError = activeJob?.status === "error";

  return (
    <div className="space-y-6">
      {!isDone && !isProcessing && (
        <Card className="p-5 space-y-5 border-gold/20">
          <Dropzone
            label="Occupied Room Photo"
            hint="JPG or PNG, up to 20 MB"
            upload={upload}
          />
          <div className="space-y-2">
            <Label>Decluttering Intensity</Label>
            <div className="grid sm:grid-cols-3 gap-2">
              {INTENSITIES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntensity(opt.value)}
                  className={`text-left rounded-md border p-3 text-sm transition-colors ${
                    intensity === opt.value
                      ? "border-gold bg-gold/10"
                      : "border-border hover:border-gold/60"
                  }`}
                >
                  <div className="font-medium capitalize">{opt.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {opt.label.split("—")[1]?.trim()}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => declutterMut.mutate()}
            disabled={!canRun}
            className="w-full bg-gold text-navy hover:bg-gold/90"
            size="lg"
          >
            <Sprout className="h-4 w-4 mr-2" /> Declutter Room
          </Button>
        </Card>
      )}

      {isProcessing && <ProcessingCard label="Removing clutter…" />}
      {isError && (
        <ErrorCard
          message={activeJob?.error_message ?? "Unknown error"}
          onRetry={retry}
          onReset={reset}
        />
      )}
      {isDone && activeJob?.result_urls && (
        <ResultsCard
          title="Decluttered Results"
          urls={activeJob.result_urls}
          onReset={reset}
          onPick={setModalUrl}
          resetLabel="New Declutter"
        />
      )}

      <HistoryGrid
        history={history ?? []}
        onPick={setActiveJobId}
        formatLabel={(j) => `Declutter • ${j.style ?? ""}`}
      />

      <Dialog open={!!modalUrl} onOpenChange={(o) => !o && setModalUrl(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
          {modalUrl && (
            <img src={modalUrl} alt="Full size" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
