import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History,
  RotateCcw,
  Calendar,
  User,
  FileText,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  listPlaybookVersions,
  restorePlaybookVersion,
  type PlaybookVersion,
  type PlaybookRecord,
} from "@/lib/playbooks.functions";
import { PlaybookContentRenderer } from "./playbook-content-renderer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PlaybookVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: PlaybookRecord | null;
  onRestored: () => void;
}

export function PlaybookVersionDialog({
  open,
  onOpenChange,
  playbook,
  onRestored,
}: PlaybookVersionDialogProps) {
  const listVersionsFn = useServerFn(listPlaybookVersions);
  const restoreFn = useServerFn(restorePlaybookVersion);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: versions = [], isLoading, refetch } = useQuery({
    queryKey: ["playbook-versions", playbook?.id],
    queryFn: () => (playbook ? listVersionsFn({ data: playbook.id }) : Promise.resolve([])),
    enabled: !!playbook && open,
  });

  useEffect(() => {
    if (versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || versions[0];

  const handleRestore = async (version: PlaybookVersion) => {
    if (!playbook) return;
    const confirm = window.confirm(
      `Are you sure you want to restore Version ${version.version_number}? This will update the active playbook content.`
    );
    if (!confirm) return;

    setIsRestoring(true);
    try {
      await restoreFn({
        data: {
          playbook_id: playbook.id,
          version_id: version.id,
          restored_by: "Admin",
        },
      });
      toast.success(`Restored Version ${version.version_number} successfully!`);
      onRestored();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] max-h-[85vh] p-0 flex flex-col bg-surface-1 border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
              <History className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Version History: {playbook?.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Review previous snapshots, check change summaries, and restore historical versions.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-border hover:bg-surface-2"
          >
            Close
          </Button>
        </div>

        {/* Content Body: Split view */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Versions List (4 cols) */}
          <div className="md:col-span-4 border-r border-border overflow-y-auto p-4 space-y-2 bg-surface-2/30">
            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-2 py-1 flex items-center justify-between">
              <span>Saved Versions</span>
              <span>{versions.length} total</span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-accent mx-auto" />
                <p className="text-xs text-muted-foreground">Loading versions...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No previous versions recorded yet.
              </div>
            ) : (
              versions.map((ver) => {
                const isSelected = selectedVersion?.id === ver.id;
                return (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setSelectedVersionId(ver.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent/10 border-accent text-foreground shadow-xs ring-1 ring-accent/30"
                        : "bg-surface-1 border-border/80 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono text-gold font-bold">
                          v{ver.version_number}
                        </span>
                        {ver.title.length > 25 ? ver.title.substring(0, 25) + "..." : ver.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ver.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {ver.change_summary ? (
                      <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {ver.change_summary}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-2.5 w-2.5" /> {ver.created_by || "Admin"}
                      </span>
                      <span>•</span>
                      <span>{new Date(ver.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Selected Version Preview (8 cols) */}
          <div className="md:col-span-8 flex flex-col overflow-hidden bg-surface-1">
            {selectedVersion ? (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-gold/15 text-gold border border-gold/25 text-xs font-bold font-mono">
                        Version {selectedVersion.version_number}
                      </span>
                      <h3 className="text-sm font-bold text-foreground truncate max-w-md">
                        {selectedVersion.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Saved on {new Date(selectedVersion.created_at).toLocaleString()} by {selectedVersion.created_by || "Admin"}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleRestore(selectedVersion)}
                    disabled={isRestoring}
                    className="text-xs bg-gold text-navy hover:bg-gold/90 font-bold h-8 shadow-xs cursor-pointer"
                  >
                    {isRestoring ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Restore This Version
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selectedVersion.summary ? (
                    <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/70 text-xs text-muted-foreground">
                      <span className="font-bold text-foreground block mb-0.5">Summary Note:</span>
                      {selectedVersion.summary}
                    </div>
                  ) : null}

                  <div className="pt-2">
                    <PlaybookContentRenderer content={selectedVersion.content} />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground text-xs">
                Select a version on the left to preview.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
