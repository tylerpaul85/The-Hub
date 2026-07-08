import { format } from "date-fns";
import { toast } from "sonner";
import { toCsv, downloadCsv, todayStamp } from "@/lib/csv";
import { STATUS_LABEL, PRIORITY_LABEL, type ContentItem, type Status, type Priority } from "@/lib/content";

export type ExportProfile = { id: string; first_name: string | null; last_name: string | null; email: string | null };

export function exportContentItems(items: ContentItem[], profiles: ExportProfile[]) {
  const pmap = new Map(profiles.map((p) => [p.id, p]));
  const ownerName = (id: string | null) => {
    if (!id) return "";
    const p = pmap.get(id);
    if (!p) return "";
    return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "";
  };
  const headers = [
    "Title", "Caption", "Platforms", "Status", "Scheduled Date", "Scheduled Time",
    "Priority", "Estimated Publish Target", "Link", "Owner", "Notes", "Created Date",
  ];
  const rows = items.map((it) => {
    const sched = it.scheduled_at ? new Date(it.scheduled_at) : null;
    const created = it.created_at ? new Date(it.created_at) : null;
    return [
      it.title,
      it.caption ?? "",
      (it.platforms ?? []).join("; "),
      STATUS_LABEL[it.status as Status] ?? it.status,
      sched ? format(sched, "yyyy-MM-dd") : "",
      sched ? format(sched, "HH:mm") : "",
      PRIORITY_LABEL[it.priority as Priority] ?? it.priority,
      it.target_publish_date ? format(new Date(it.target_publish_date), "yyyy-MM-dd") : "",
      it.link ?? "",
      ownerName(it.created_by),
      it.notes ?? "",
      created ? format(created, "yyyy-MM-dd HH:mm") : "",
    ];
  });
  downloadCsv(`MSREG-Content-Calendar-${todayStamp()}.csv`, toCsv(headers, rows));
  toast.success(`Exported ${rows.length} content item${rows.length === 1 ? "" : "s"}`);
}
