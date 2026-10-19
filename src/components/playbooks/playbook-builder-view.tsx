import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Layers,
  BookOpen,
  Edit,
  Trash2,
  ExternalLink,
  History,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Film,
  FileText,
  ChevronDown,
  ChevronUp,
  Settings,
  MoreVertical,
  Check,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import type {
  PlaybookProduct,
  PlaybookSection,
  PlaybookRecord,
  PlaybookGroup,
} from "@/lib/playbooks.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlaybookBuilderViewProps {
  product: PlaybookProduct;
  sections: PlaybookSection[];
  groups: PlaybookGroup[];
  onBack: () => void;
  onAddSection: (sectionName: string) => Promise<void>;
  onRenameSection: (oldName: string, newName: string) => Promise<void>;
  onDeleteSection: (sectionName: string) => Promise<void>;
  onAddLesson: (sectionName: string) => void;
  onEditLesson: (lesson: PlaybookRecord, sectionName: string) => void;
  onDeleteLesson: (lesson: PlaybookRecord) => void;
  onViewVersions: (lesson: PlaybookRecord) => void;
  onViewAck: (lesson: PlaybookRecord) => void;
  onMarkReviewed: (lesson: PlaybookRecord) => void;
}

export function PlaybookBuilderView({
  product,
  sections,
  groups,
  onBack,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onViewVersions,
  onViewAck,
  onMarkReviewed,
}: PlaybookBuilderViewProps) {
  // Collapsed state for sections (default all open)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Modals for Section operations
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);

  const [renameSectionOpen, setRenameSectionOpen] = useState(false);
  const [renamingSectionOldName, setRenamingSectionOldName] = useState("");
  const [renamingSectionNewName, setRenamingSectionNewName] = useState("");
  const [isRenamingSection, setIsRenamingSection] = useState(false);

  const toggleSection = (secName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [secName]: !prev[secName],
    }));
  };

  const handleCreateSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    try {
      setIsAddingSection(true);
      await onAddSection(newSectionName.trim());
      setNewSectionName("");
      setAddSectionOpen(false);
    } finally {
      setIsAddingSection(false);
    }
  };

  const handleRenameSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingSectionNewName.trim()) return;
    try {
      setIsRenamingSection(true);
      await onRenameSection(renamingSectionOldName, renamingSectionNewName.trim());
      setRenameSectionOpen(false);
    } finally {
      setIsRenamingSection(false);
    }
  };

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const publishedLessons = sections.reduce(
    (acc, s) => acc + s.lessons.filter((l) => l.status === "published").length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8 px-2.5 rounded-xl border-border bg-surface-1 hover:bg-surface-2 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Playbooks</span>
          </Button>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>{product.name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  product.status === "published"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                }`}
              >
                {product.status === "published" ? "Published" : "Draft"}
              </Badge>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setAddSectionOpen(true)}
            size="sm"
            className="h-8 px-3 rounded-xl bg-gold hover:bg-gold-light text-black text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Section</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 px-3 rounded-xl border-border bg-surface-1 hover:bg-surface-2 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Link to="/playbooks" search={{ course: product.slug }}>
              <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
              <span>Preview as Agent</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Product Hero Info Card */}
      <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-surface-1 via-surface-1/95 to-surface-2/60 p-4 sm:p-5 flex flex-col md:flex-row items-center gap-5 shadow-lg">
        {/* Cover thumbnail */}
        <div className="w-full md:w-56 aspect-video rounded-xl overflow-hidden border border-border/80 bg-surface-2 shrink-0 relative shadow-inner">
          {product.cover_image_url ? (
            <img
              src={product.cover_image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-black/40 text-gold">
              <BookOpen className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Details & Metrics */}
        <div className="flex-1 space-y-2.5 text-center md:text-left w-full">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-gold">
              Course & Playbook Structure
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">{product.name}</h2>
            {product.description && (
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* Metric Badges */}
          <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap pt-1">
            <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60 text-foreground font-semibold flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-gold" />
              <span>{sections.length} Sections</span>
            </span>

            <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60 text-foreground font-semibold flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-blue-400" />
              <span>{totalLessons} Total Lessons</span>
            </span>

            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{publishedLessons} Published</span>
            </span>

            <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60 text-muted-foreground font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>{product.members_count || 0} enrolled members</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sections & Lessons Builder Outline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-gold" />
              <span>Curriculum Outline</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click &quot;Add Lesson&quot; within any section to insert instructions, video tracks, and files.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddSectionOpen(true)}
            className="text-xs h-7 px-2.5 rounded-lg border-border bg-surface-1 hover:bg-surface-2 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-gold" />
            <span>New Section</span>
          </Button>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/80 bg-surface-1/40 p-12 text-center space-y-3">
            <Layers className="h-10 w-10 text-muted-foreground/60 mx-auto" />
            <h4 className="text-sm font-bold text-foreground">No sections yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Start building this playbook by adding your first section or module.
            </p>
            <Button
              onClick={() => setAddSectionOpen(true)}
              className="mt-2 h-8 px-4 rounded-xl bg-gold hover:bg-gold-light text-black text-xs font-bold shadow-md cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span>Create First Section</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section, sIndex) => {
              const isCollapsed = collapsedSections[section.name];

              return (
                <div
                  key={section.id || section.name}
                  className="rounded-2xl border border-border/80 bg-surface-1/80 overflow-hidden shadow-sm"
                >
                  {/* Section Header Accordion */}
                  <div className="px-4 py-3 bg-surface-2/60 border-b border-border/60 flex items-center justify-between gap-3">
                    <div
                      onClick={() => toggleSection(section.name)}
                      className="flex items-center gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground p-0.5"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </button>

                      <span className="text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-md border border-gold/20">
                        Section {sIndex + 1}
                      </span>

                      <h4 className="text-sm font-bold text-foreground hover:text-gold transition-colors">
                        {section.name}
                      </h4>

                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-surface-1 text-muted-foreground border-border px-1.5 py-0"
                      >
                        {section.lessons.length} {section.lessons.length === 1 ? "lesson" : "lessons"}
                      </Badge>
                    </div>

                    {/* Section Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAddLesson(section.name)}
                        className="h-7 px-2.5 rounded-lg border-gold/40 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3 stroke-[2.5]" />
                        <span>Add Lesson</span>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-surface-1 border-border">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingSectionOldName(section.name);
                              setRenamingSectionNewName(section.name);
                              setRenameSectionOpen(true);
                            }}
                            className="text-xs cursor-pointer flex items-center gap-2"
                          >
                            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Rename Section</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteSection(section.name)}
                            className="text-xs cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Section</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Section Lessons List */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border/40 p-1">
                      {section.lessons.length === 0 ? (
                        <div className="py-6 px-4 text-center text-xs text-muted-foreground space-y-2">
                          <p>No lessons in this section yet.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddLesson(section.name)}
                            className="h-7 px-3 text-xs border-dashed border-border bg-surface-1 text-gold hover:bg-surface-2 cursor-pointer"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            <span>Add First Lesson</span>
                          </Button>
                        </div>
                      ) : (
                        section.lessons.map((lesson, lIndex) => {
                          const hasVideo =
                            lesson.content.includes("youtube.com") ||
                            lesson.content.includes("youtu.be") ||
                            lesson.content.includes("vimeo.com") ||
                            lesson.content.includes("loom.com") ||
                            lesson.content.includes(".mp4");

                          return (
                            <div
                              key={lesson.id}
                              className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors rounded-xl group"
                            >
                              {/* Left: Index & Title */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="h-6 w-6 rounded-md bg-surface-2 text-[11px] font-bold text-muted-foreground flex items-center justify-center shrink-0 border border-border/60">
                                  {lIndex + 1}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      onClick={() => onEditLesson(lesson, section.name)}
                                      className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors cursor-pointer truncate"
                                    >
                                      {lesson.title}
                                    </span>

                                    {hasVideo && (
                                      <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                        <Film className="h-2.5 w-2.5" />
                                        <span>Video</span>
                                      </span>
                                    )}

                                    {lesson.is_review_overdue && (
                                      <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        <span>Review Overdue</span>
                                      </span>
                                    )}
                                  </div>

                                  {lesson.summary && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                      {lesson.summary}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Right: Badges & Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    lesson.status === "published"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  }`}
                                >
                                  {lesson.status}
                                </Badge>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onEditLesson(lesson, section.name)}
                                    className="h-7 px-2 text-xs text-foreground hover:bg-surface-2 cursor-pointer flex items-center gap-1"
                                  >
                                    <Edit className="h-3 w-3 text-gold" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44 bg-surface-1 border-border">
                                      <DropdownMenuItem
                                        onClick={() => onEditLesson(lesson, section.name)}
                                        className="text-xs cursor-pointer flex items-center gap-2"
                                      >
                                        <Edit className="h-3.5 w-3.5 text-gold" />
                                        <span>Edit Markdown</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => onViewVersions(lesson)}
                                        className="text-xs cursor-pointer flex items-center gap-2"
                                      >
                                        <History className="h-3.5 w-3.5 text-blue-400" />
                                        <span>Version History</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => onViewAck(lesson)}
                                        className="text-xs cursor-pointer flex items-center gap-2"
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                        <span>Agent Report</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => onMarkReviewed(lesson)}
                                        className="text-xs cursor-pointer flex items-center gap-2"
                                      >
                                        <Check className="h-3.5 w-3.5 text-gold" />
                                        <span>Mark Reviewed</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => onDeleteLesson(lesson)}
                                        className="text-xs cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Delete Lesson</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Big Button to Add Next Section */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => setAddSectionOpen(true)}
            className="w-full h-11 border-2 border-dashed border-border hover:border-gold/50 bg-surface-1/50 hover:bg-surface-2/60 text-xs font-bold text-muted-foreground hover:text-gold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Section to {product.name}</span>
          </Button>
        </div>
      </div>

      {/* Dialog: Add New Section */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent className="max-w-md bg-surface-1 border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-gold" />
              <span>Add New Section</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSectionSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Section / Module Title
              </label>
              <Input
                autoFocus
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g. 08 Valuation & Pricing Strategies"
                className="bg-surface-2 border-border text-xs rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: Use numbers (e.g. 01, 02) to control the display order.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAddSectionOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newSectionName.trim() || isAddingSection}
                className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl cursor-pointer"
              >
                {isAddingSection ? "Creating..." : "Create Section"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Section */}
      <Dialog open={renameSectionOpen} onOpenChange={setRenameSectionOpen}>
        <DialogContent className="max-w-md bg-surface-1 border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit className="h-4 w-4 text-gold" />
              <span>Rename Section</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRenameSectionSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Updated Section Name
              </label>
              <Input
                autoFocus
                value={renamingSectionNewName}
                onChange={(e) => setRenamingSectionNewName(e.target.value)}
                placeholder="Enter new section name"
                className="bg-surface-2 border-border text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRenameSectionOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!renamingSectionNewName.trim() || isRenamingSection}
                className="bg-gold hover:bg-gold-light text-black font-bold text-xs rounded-xl cursor-pointer"
              >
                {isRenamingSection ? "Saving..." : "Save Name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
