import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/mention-textarea";
import { MessageSquare, Paperclip, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Linkify } from "@/lib/linkify";
import { makeStorageKey } from "@/lib/sanitize-filename";

type Kind = "content" | "video" | "task";

interface Props {
  parentId: string;
  kind: Kind;
  allowAttachments?: boolean;
}

const cfg = {
  content: { table: "content_comments", fk: "content_id" },
  video: { table: "video_comments", fk: "video_id" },
  task: { table: "task_comments", fk: "task_id" },
} as const;

export function ChatThread({ parentId, kind, allowAttachments = false }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { table, fk } = cfg[kind];

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_team_members");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["chat", kind, parentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table).select("*").eq(fk, parentId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`${kind}-${parentId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table, filter: `${fk}=eq.${parentId}` },
      () => qc.invalidateQueries({ queryKey: ["chat", kind, parentId] }),
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [parentId, kind, qc, table, fk]);

  const profileOf = (id: string) => (profiles as any[]).find((p) => p.id === id);
  const nameOf = (id: string) => {
    const p = profileOf(id);
    if (!p) return "Unknown";
    const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    return full || p.email;
  };
  const initialOf = (id: string) => (nameOf(id)[0] ?? "?").toUpperCase();

  const handleUpload = async (files: FileList | File[]) => {
    if (!user) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    try {
      const out: string[] = [];
      for (const file of arr) {
        const path = makeStorageKey(`${user.id}/chat`, file.name);
        const { error: upErr } = await supabase.storage.from("content-thumbnails").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await supabase.storage.from("content-thumbnails").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sErr) throw sErr;
        out.push(signed.signedUrl);
      }
      setPendingImages((p) => [...p, ...out]);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const post = useMutation({
    mutationFn: async () => {
      if ((!body.trim() && pendingImages.length === 0) || !user) return;
      const payload: any = { [fk]: parentId, user_id: user.id, body: body.trim(), mentions };
      if (allowAttachments) payload.image_urls = pendingImages;
      const { error } = await (supabase as any).from(table).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setBody(""); setMentions([]); setPendingImages([]);
      qc.invalidateQueries({ queryKey: ["chat", kind, parentId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  const handleOf = (u: any) => {
    const full = [u.first_name, u.last_name].filter(Boolean).join("");
    if (full) return full.replace(/[^A-Za-z0-9]/g, "");
    return (u.email?.split("@")[0] || "user").replace(/[^A-Za-z0-9]/g, "");
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@[\w.@+-]+)/g);
    return parts.map((p, i) => {
      if (p.startsWith("@")) {
        const matched = (profiles as any[]).some((u) => "@" + handleOf(u) === p || "@" + u.email === p);
        return matched
          ? <span key={i} className="text-gold font-medium">{p}</span>
          : <span key={i}>{p}</span>;
      }
      return <Linkify key={i} text={p} />;
    });
  };

  const mentionUsers = useMemo(() => (profiles as any[]).filter((p) => p.id !== user?.id), [profiles, user]);

  return (
    <section className="pt-4 border-t border-border">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat</h3>
      <div className="space-y-3 mb-3 max-h-72 overflow-y-auto pr-1">
        {messages.length === 0 && <div className="text-xs text-muted-foreground">No messages yet. Use @ to tag someone.</div>}
        {(messages as any[]).map((m) => (
          <div key={m.id} className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-gold/20 text-gold text-xs flex items-center justify-center font-semibold flex-shrink-0">
              {initialOf(m.user_id)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[11px] mb-0.5">
                <span className="font-medium text-foreground">{nameOf(m.user_id)}</span>
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
              </div>
              {m.body && <div className="text-sm whitespace-pre-wrap break-words">{renderBody(m.body)}</div>}
              {Array.isArray(m.image_urls) && m.image_urls.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.image_urls.map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={u} alt="" className="h-20 w-20 object-cover rounded border border-border" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {allowAttachments && pendingImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingImages.map((u, i) => (
            <div key={i} className="relative group">
              <img src={u} alt="" className="h-14 w-14 object-cover rounded border border-border" />
              <button type="button" onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-black/80 text-white rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <MentionTextarea
            value={body}
            onChange={(v, ms) => { setBody(v); setMentions(ms); }}
            users={mentionUsers}
            rows={2}
            placeholder="Type a message — @ to mention someone"
          />
        </div>
        {allowAttachments && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { const fs = e.target.files; if (fs && fs.length) handleUpload(fs); if (fileRef.current) fileRef.current.value = ""; }} />
            <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => fileRef.current?.click()} title="Attach photos">
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button onClick={() => post.mutate()} disabled={(!body.trim() && pendingImages.length === 0) || post.isPending} className="bg-gold text-gold-foreground hover:bg-gold/90">
          Send
        </Button>
      </div>
    </section>
  );
}
