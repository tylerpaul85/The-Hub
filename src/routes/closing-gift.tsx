import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, CheckCircle2, Lock, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/msreg-logo.png";

const SECURITY_CODE = "MSREG2026";
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

export const Route = createFileRoute("/closing-gift")({
  ssr: false,
  component: ClosingGiftRequestPage,
  head: () => ({
    meta: [
      { title: "Closing Gift Request — MSREG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Shirt = { size: string; color: string };

function ClosingGiftRequestPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const [agentName, setAgentName] = useState("");
  const [clientFirst, setClientFirst] = useState("");
  const [clientLast, setClientLast] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [closingLocation, setClosingLocation] = useState<"rolla" | "str" | "osage_beach" | "">("");
  const [comments, setComments] = useState("");
  const [shirtCount, setShirtCount] = useState<1 | 2 | 3>(1);
  const [shirts, setShirts] = useState<Shirt[]>([{ size: "", color: "" }]);



  const { data: inventory = [] } = useQuery({
    queryKey: ["closing-gift-inventory", unlocked],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closing_gift_inventory")
        .select("size,color,color_hex,quantity_available")
        .order("size")
        .order("color");
      if (error) throw error;
      return data ?? [];
    },
    enabled: unlocked,
  });

  const colors = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of inventory) if (!map.has(r.color)) map.set(r.color, r.color_hex);
    return Array.from(map.entries()).map(([color, hex]) => ({ color, hex }));
  }, [inventory]);

  function availableQty(size: string, color: string): number {
    return inventory.find((r) => r.size === size && r.color === color)?.quantity_available ?? 0;
  }
  function sizeHasAnyStock(size: string): boolean {
    return inventory.some((r) => r.size === size && r.quantity_available > 0);
  }

  function setShirtField(idx: number, field: keyof Shirt, value: string) {
    setShirts((prev) => {
      const next = prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
      // Clear color if invalid after size change
      if (field === "size") next[idx].color = "";
      return next;
    });
  }

  function setCount(n: 1 | 2 | 3) {
    setShirtCount(n);
    setShirts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push({ size: "", color: "" });
      return next;
    });
  }

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (codeInput.trim().toUpperCase() === SECURITY_CODE) {
      setUnlocked(true);
      setCodeError(null);
    } else {
      setCodeError("Incorrect code. Please try again.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentName.trim() || !clientFirst.trim() || !clientLast.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!closingDate) {
      toast.error("Closing date is required.");
      return;
    }
    if (!closingLocation) {
      toast.error("Closing location is required.");
      return;
    }
    if (shirts.some((s) => !s.size || !s.color)) {
      toast.error("Pick a size and color for every shirt.");
      return;
    }
    setBusy(true);
    try {
      // 1. Fetch current inventory details for the requested sizes/colors
      const sizes = Array.from(new Set(shirts.map((s) => s.size)));
      const colors = Array.from(new Set(shirts.map((s) => s.color)));
      const { data: inv, error: invErr } = await supabase
        .from("closing_gift_inventory")
        .select("id,size,color,color_hex,quantity_available")
        .in("size", sizes)
        .in("color", colors);
      if (invErr) throw invErr;

      // 2. Tally and validate stock
      const tally = new Map<string, number>();
      for (const s of shirts) {
        const key = `${s.size}|${s.color}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
      const invByKey = new Map<string, any>();
      for (const row of inv ?? []) {
        invByKey.set(`${row.size}|${row.color}`, row);
      }

      const enrichedShirts: Array<{ size: string; color: string; color_hex: string }> = [];
      for (const [key, count] of tally.entries()) {
        const row = invByKey.get(key);
        if (!row) throw new Error(`Out of stock: ${key.replace("|", " / ")}`);
        if (row.quantity_available < count) {
          throw new Error(`Not enough stock for ${row.size} ${row.color}`);
        }
      }
      for (const s of shirts) {
        const row = invByKey.get(`${s.size}|${s.color}`);
        enrichedShirts.push({ size: s.size, color: s.color, color_hex: row.color_hex });
      }

      // 3. Insert request
      const { data: inserted, error: insErr } = await supabase
        .from("closing_gift_requests")
        .insert({
          agent_name: agentName.trim(),
          client_first_name: clientFirst.trim(),
          client_last_name: clientLast.trim(),
          closing_date: closingDate,
          closing_location: closingLocation,
          comments: comments.trim() || null,
          shirts: enrichedShirts,
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // 4. Decrement inventory
      for (const [key, count] of tally.entries()) {
        const row = invByKey.get(key);
        const { error: updErr } = await supabase
          .from("closing_gift_inventory")
          .update({ quantity_available: row.quantity_available - count })
          .eq("id", row.id);
        if (updErr) throw updErr;
      }

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not submit request.");
    } finally {
      setBusy(false);
    }
  }

  // --------- RENDER ---------
  if (submitted) {
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold/15 text-gold flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold">Request Submitted</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Thanks! Your closing gift request has been sent to the Client Care team. You'll hear back shortly.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90"
              onClick={() => {
                setSubmitted(false);
                setAgentName(""); setClientFirst(""); setClientLast("");
                setClosingDate(""); setClosingLocation(""); setComments("");
                setShirtCount(1); setShirts([{ size: "", color: "" }]);
              }}
            >
              Submit Another
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!unlocked) {
    return (
      <Shell>
        <form onSubmit={handleUnlock} className="max-w-sm mx-auto py-6">
          <div className="mx-auto h-14 w-14 rounded-full bg-gold/15 text-gold flex items-center justify-center mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-center text-xl font-semibold">Enter Access Code</h2>
          <p className="text-center text-sm text-muted-foreground mt-1">
            This form is for MSREG team members.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="code">Security code</Label>
            <Input
              id="code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="MSREG••••"
              autoFocus
            />
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
          </div>
          <Button type="submit" className="w-full mt-6 bg-gold text-navy hover:bg-gold/90">
            Continue
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="agent">Agent Name *</Label>
            <Input id="agent" value={agentName} onChange={(e) => setAgentName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cfirst">Client First Name *</Label>
            <Input id="cfirst" value={clientFirst} onChange={(e) => setClientFirst(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="clast">Client Last Name *</Label>
            <Input id="clast" value={clientLast} onChange={(e) => setClientLast(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cdate">Closing Date *</Label>
            <Input
              id="cdate"
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="cloc">Closing Location *</Label>
            <Select value={closingLocation || undefined} onValueChange={(v) => setClosingLocation(v as any)}>
              <SelectTrigger id="cloc"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rolla">Rolla</SelectItem>
                <SelectItem value="str">STR (St. Robert)</SelectItem>
                <SelectItem value="osage_beach">Osage Beach</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ccomments">Comments</Label>
            <Textarea
              id="ccomments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Anything the Client Care team should know? (optional)"
              rows={3}
            />
          </div>
        </div>



        <div>
          <Label className="block mb-2">How many shirts? *</Label>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={
                  "px-5 py-2 text-sm font-medium border-r border-border last:border-r-0 transition-colors " +
                  (shirtCount === n
                    ? "bg-gold text-navy"
                    : "bg-card hover:bg-accent/40")
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {shirts.map((shirt, idx) => (
            <div key={idx} className="rounded-xl border border-gold/20 bg-card p-4">
              <div className="text-sm font-semibold text-gold mb-3">Shirt #{idx + 1}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Size</Label>
                  <Select value={shirt.size || undefined} onValueChange={(v) => setShirtField(idx, "size", v)}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s) => {
                        const inStock = sizeHasAnyStock(s);
                        return (
                          <SelectItem key={s} value={s} disabled={!inStock}>
                            {s}{!inStock ? " — out of stock" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">Color</Label>
                  <div className="space-y-2">
                    {colors.length === 0 && (
                      <p className="text-xs text-muted-foreground">Loading colors…</p>
                    )}
                    {colors.map(({ color, hex }) => {
                      const qty = shirt.size ? availableQty(shirt.size, color) : 0;
                      const disabled = !shirt.size || qty <= 0;
                      const selected = shirt.color === color;
                      return (
                        <button
                          type="button"
                          key={color}
                          disabled={disabled}
                          onClick={() => setShirtField(idx, "color", color)}
                          className={
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-colors " +
                            (selected
                              ? "border-gold bg-gold/10"
                              : "border-border bg-background hover:bg-accent/40") +
                            (disabled ? " opacity-40 cursor-not-allowed" : "")
                          }
                        >
                          <span
                            className="h-5 w-5 rounded-full border border-border shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="flex-1 text-left">{color}</span>
                          <span className="text-xs text-muted-foreground">
                            {shirt.size ? (qty > 0 ? `${qty} avail` : "Out") : "Pick size"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button asChild variant="ghost">
            <Link to="/"><ChevronLeft className="h-4 w-4 mr-1" /> Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy} className="bg-gold text-navy hover:bg-gold/90">
            {busy ? "Submitting…" : "Submit Request"}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <img src={logo} alt="MSREG" className="h-20 w-auto mx-auto" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 mt-3">Closing Gift Request</p>
          <h1 className="text-2xl font-semibold mt-2 flex items-center justify-center gap-2">
            <Gift className="h-6 w-6 text-gold" /> Request Closing Gift
          </h1>
        </header>
        <div className="rounded-2xl border border-gold/30 bg-card p-6 sm:p-8 shadow-lg">
          {children}
        </div>
        <footer className="mt-8 text-center text-[11px] text-muted-foreground">
          © Matt Smith Real Estate Group
        </footer>
      </div>
    </div>
  );
}
