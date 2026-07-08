import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Meeting } from "@/lib/eos";

export const Route = createFileRoute("/_authenticated/eos/l10/")({
  component: L10ListPage,
  head: () => ({ meta: [{ title: "L10 Meetings — EOS — MSREG" }] }),
});

const sb = supabase as any;

function L10ListPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await sb.from("l10_meetings").select("*").order("meeting_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.from("l10_meetings").insert({
        meeting_date: newDate,
        attendees: [],
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      return data as Meeting;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setCreating(false);
      toast.success("Meeting created");
      window.location.href = `/eos/l10/${m.id}`;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-gold" /> L10 Meetings
          </h1>
          <p className="text-muted-foreground mt-1">Weekly leadership meetings.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New Meeting</Button>
      </header>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {meetings.length === 0 && <div className="p-10 text-center text-muted-foreground text-sm">No meetings yet.</div>}
        {meetings.map((m) => {
          const upcoming = m.meeting_date >= today;
          return (
            <Link key={m.id} to="/eos/l10/$id" params={{ id: m.id }} className="p-4 flex items-center gap-3 hover:bg-accent/30">
              <div className="flex-1">
                <div className="font-medium">{format(new Date(m.meeting_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {upcoming ? "Upcoming" : "Past"}
                  {m.meeting_rating ? ` · Rated ${m.meeting_rating}/10` : ""}
                  {` · ${m.attendees?.length ?? 0} attendees`}
                </div>
              </div>
              <span className="text-xs text-gold">Open →</span>
            </Link>
          );
        })}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New L10 Meeting</DialogTitle></DialogHeader>
          <div>
            <label className="text-xs text-muted-foreground">Meeting date</label>
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
