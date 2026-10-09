import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, CheckCircle2, Lock, ChevronLeft, ArrowLeft, Shirt, Sparkles, Building, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { verifyToolboxCode } from "@/lib/toolbox-public.functions";
import logo from "@/assets/msreg-logo.png";
import { cn } from "@/lib/utils";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

export const Route = createFileRoute("/closing-gift")({
  ssr: false,
  component: ClosingGiftRequestPage,
  head: () => ({
    meta: [
      { title: "Closing Gift Package — MSREG Hub" },
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

  const verifyCode = useServerFn(verifyToolboxCode);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await verifyCode({ data: { code: codeInput.trim() } });
      setUnlocked(true);
      setCodeError(null);
    } catch {
      setCodeError("Incorrect passcode. Please check with your team lead or operations.");
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
      toast.error("Closing office location is required.");
      return;
    }
    if (shirts.some((s) => !s.size || !s.color)) {
      toast.error("Please pick a size and in-stock color for each shirt.");
      return;
    }
    setBusy(true);
    try {
      const sizes = Array.from(new Set(shirts.map((s) => s.size)));
      const colorsToFetch = Array.from(new Set(shirts.map((s) => s.color)));
      const { data: inv, error: invErr } = await supabase
        .from("closing_gift_inventory")
        .select("id,size,color,color_hex,quantity_available")
        .in("size", sizes)
        .in("color", colorsToFetch);
      if (invErr) throw invErr;

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

      const { error: insErr } = await supabase.from("closing_gift_requests").insert({
        agent_name: agentName.trim(),
        client_first_name: clientFirst.trim(),
        client_last_name: clientLast.trim(),
        closing_date: closingDate,
        closing_location: closingLocation,
        comments: comments.trim() || null,
        shirts: enrichedShirts,
        status: "pending",
      });
      if (insErr) throw insErr;

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

  if (submitted) {
    return (
      <Shell>
        <div className="text-center py-10 space-y-5">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Package Request Submitted!
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your closing gift request for{" "}
              <strong className="text-foreground">
                {clientFirst} {clientLast}
              </strong>{" "}
              has been routed to the Client Care operations team. Apparel inventory has been reserved.
            </p>
          </div>
          <div className="pt-4 flex justify-center gap-3">
            <Button asChild variant="outline" className="border-border/80">
              <Link to="/agents">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Agent Hub
              </Link>
            </Button>
            <Button
              className="bg-gold text-navy font-semibold hover:bg-gold/90 shadow-xs"
              onClick={() => {
                setSubmitted(false);
                setAgentName("");
                setClientFirst("");
                setClientLast("");
                setClosingDate("");
                setClosingLocation("");
                setComments("");
                setShirtCount(1);
                setShirts([{ size: "", color: "" }]);
              }}
            >
              Order Another Package
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!unlocked) {
    return (
      <Shell>
        <form onSubmit={handleUnlock} className="max-w-sm mx-auto py-6 space-y-5">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center shadow-inner">
            <Lock className="h-6 w-6" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Security Access Required
            </h2>
            <p className="text-xs text-muted-foreground">
              Please enter the MSREG team toolbox passcode to access client care inventory.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code" className="text-xs font-semibold text-muted-foreground">
              Passcode
            </Label>
            <Input
              id="code"
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="bg-surface-2 border-border/80 text-center text-lg tracking-widest font-mono"
            />
            {codeError && (
              <p className="text-xs text-destructive text-center font-medium">{codeError}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-gold text-navy font-semibold hover:bg-gold/90 h-10 shadow-xs"
          >
            Unlock Form
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Agent & Client Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            <Building className="h-4 w-4 text-gold" />
            <h3 className="text-xs uppercase tracking-wider font-bold text-foreground">
              1. Transaction &amp; Client Details
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="agent" className="text-xs font-semibold">
                Agent Name *
              </Label>
              <Input
                id="agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Bryant Jenkins"
                required
                className="mt-1 bg-surface-2 border-border/80"
              />
            </div>
            <div>
              <Label htmlFor="cfirst" className="text-xs font-semibold">
                Client First Name *
              </Label>
              <Input
                id="cfirst"
                value={clientFirst}
                onChange={(e) => setClientFirst(e.target.value)}
                placeholder="e.g. John"
                required
                className="mt-1 bg-surface-2 border-border/80"
              />
            </div>
            <div>
              <Label htmlFor="clast" className="text-xs font-semibold">
                Client Last Name *
              </Label>
              <Input
                id="clast"
                value={clientLast}
                onChange={(e) => setClientLast(e.target.value)}
                placeholder="e.g. Smith"
                required
                className="mt-1 bg-surface-2 border-border/80"
              />
            </div>
            <div>
              <Label htmlFor="cdate" className="text-xs font-semibold">
                Closing Date *
              </Label>
              <Input
                id="cdate"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                required
                className="mt-1 bg-surface-2 border-border/80 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="cloc" className="text-xs font-semibold">
                Closing Office Location *
              </Label>
              <Select
                value={closingLocation || undefined}
                onValueChange={(v) => setClosingLocation(v as any)}
              >
                <SelectTrigger id="cloc" className="mt-1 bg-surface-2 border-border/80">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolla">Rolla Office</SelectItem>
                  <SelectItem value="str">St. Robert (STR)</SelectItem>
                  <SelectItem value="osage_beach">Osage Beach (Lake)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ccomments" className="text-xs font-semibold">
                Special Instructions / Notes
              </Label>
              <Textarea
                id="ccomments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Closing gift pickup instructions, client preferences, or delivery notes (optional)"
                rows={2}
                className="mt-1 bg-surface-2 border-border/80 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Shirt Package */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4 text-gold" />
              <h3 className="text-xs uppercase tracking-wider font-bold text-foreground">
                2. Client Apparel Package Selection
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Quantity:</span>
              <div className="inline-flex rounded-lg border border-border/80 bg-surface-2 p-0.5">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all",
                      shirtCount === n
                        ? "bg-gold text-navy shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n} Shirt{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {shirts.map((shirt, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-border/80 bg-surface-2/40 p-4 sm:p-5 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-gold/15 text-gold font-bold flex items-center justify-center text-xs border border-gold/30">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Client Shirt #{idx + 1}
                    </span>
                  </div>
                  {shirt.size && shirt.color && (
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {shirt.size} · {shirt.color}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                      Select Size
                    </Label>
                    <Select
                      value={shirt.size || undefined}
                      onValueChange={(v) => setShirtField(idx, "size", v)}
                    >
                      <SelectTrigger className="bg-surface-2 border-border/80">
                        <SelectValue placeholder="Choose shirt size" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZES.map((s) => {
                          const inStock = sizeHasAnyStock(s);
                          return (
                            <SelectItem key={s} value={s} disabled={!inStock}>
                              {s}
                              {!inStock ? " (Out of stock)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                      Select In-Stock Color
                    </Label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {colors.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">Loading color options…</p>
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
                            className={cn(
                              "w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-xs transition-all",
                              selected
                                ? "border-gold bg-gold/15 text-foreground shadow-xs font-semibold"
                                : "border-border/60 bg-surface-2/60 text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                              disabled && "opacity-35 cursor-not-allowed hover:bg-surface-2/60",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-border shrink-0 shadow-2xs"
                                style={{ backgroundColor: hex }}
                              />
                              <span>{color}</span>
                            </div>
                            <span className="font-mono text-[10px]">
                              {shirt.size
                                ? qty > 0
                                  ? `${qty} left`
                                  : "Out of stock"
                                : "Select size first"}
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
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border/60">
          <Button asChild variant="ghost" className="text-xs">
            <Link to="/agents">
              <ChevronLeft className="h-4 w-4 mr-1" /> Return to Hub
            </Link>
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="bg-gold text-navy font-semibold hover:bg-gold/90 px-6 h-10 shadow-xs"
          >
            {busy ? "Submitting…" : "Submit Gift Package"}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-gold/30 selection:text-white px-4 py-8 sm:py-12 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Ambient Top Spotlight Halo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.12),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] pointer-events-none opacity-[0.03] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="max-w-2xl mx-auto space-y-6 relative z-10">
        {/* Nav Back */}
        <div className="flex items-center justify-between">
          <Link
            to="/agents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/70 hover:bg-surface-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-gold" />
            <span>Agent Hub</span>
          </Link>
          <div className="text-[11px] font-mono text-muted-foreground">
            Matt Smith Real Estate Group
          </div>
        </div>

        {/* Header */}
        <header className="text-center space-y-2">
          <img src={logo} alt="MSREG" className="h-16 w-auto mx-auto drop-shadow-sm" />
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] font-bold uppercase tracking-wider">
            <Gift className="h-3 w-3" /> Client Care Package
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Request Client Closing Gift
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Order branded shirts and delivery packages for your buyers and sellers at closing.
          </p>
        </header>

        {/* Main Card */}
        <div className="rounded-3xl border border-border/80 bg-card/85 backdrop-blur-xl p-6 sm:p-8 shadow-2xl ring-1 ring-inset ring-white/[0.04]">
          {children}
        </div>

        <footer className="text-center text-[11px] text-muted-foreground pt-2">
          © Matt Smith Real Estate Group · Client Care Department
        </footer>
      </div>
    </div>
  );
}
