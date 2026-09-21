import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicOpenHouseForSignin,
  submitPublicOpenHouseSignin,
} from "@/lib/open-houses.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Home,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  Mail,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Check,
  HeartHandshake,
  Clock,
  Compass,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/open-house-signin/$id")({
  ssr: false,
  component: PublicOpenHouseSigninPage,
  head: () => ({
    meta: [
      { title: "Open House Guest Sign-In — Matt Smith Real Estate Group" },
      { name: "description", content: "Welcome! Please sign in to tour this home with Matt Smith Real Estate Group." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function PublicOpenHouseSigninPage() {
  const { id } = Route.useParams();
  const fetchDetails = useServerFn(getPublicOpenHouseForSignin);
  const submitSignin = useServerFn(submitPublicOpenHouseSignin);

  const [submitted, setSubmitted] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    workingWithAgent: false,
    agentName: "",
    buyingOrSelling: "just_browsing" as "buying" | "selling" | "both" | "just_browsing",
    timeframe: "just_browsing" as "immediate" | "1-3_months" | "3-6_months" | "6-12_months" | "just_browsing",
    notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-open-house-signin", id],
    queryFn: () => fetchDetails({ data: { id } }),
    staleTime: 60_000,
  });

  const signinMutation = useMutation({
    mutationFn: async () => {
      if (!form.firstName.trim()) throw new Error("Please enter your first name.");
      if (!form.phone.trim()) throw new Error("Please enter your phone number.");
      return await submitSignin({
        data: {
          openHouseId: id,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          workingWithAgent: form.workingWithAgent,
          agentName: form.workingWithAgent ? form.agentName.trim() : undefined,
          buyingOrSelling: form.buyingOrSelling,
          timeframe: form.timeframe,
          notes: form.notes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      setGuestName(form.firstName.trim());
      setSubmitted(true);
      toast.success("Welcome! You are all signed in.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sign in. Please check your info and try again.");
    },
  });

  const oh = data?.openHouse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gold border-t-transparent mx-auto" />
          <p className="text-sm text-slate-400 font-medium tracking-wide">Loading open house...</p>
        </div>
      </div>
    );
  }

  if (error || !oh) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center p-8 space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <Home className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-serif font-bold text-white">Open House Not Found</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              This open house link may have expired or is no longer active. Please check with the hosting agent or team.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between selection:bg-gold/30 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Matt Smith Real Estate Group" className="h-8 w-auto" />
            <div>
              <div className="font-semibold text-xs tracking-wider uppercase text-gold">
                Matt Smith Real Estate Group
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Digital Guest Registration</div>
            </div>
          </div>
          <Badge className="bg-gold/15 text-gold border-gold/30 text-[11px] px-2.5 py-0.5 font-semibold">
            Welcome
          </Badge>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Property Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
          {oh.thumbnail ? (
            <div className="aspect-[16/9] w-full relative overflow-hidden">
              <img
                src={oh.thumbnail}
                alt={oh.address}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            </div>
          ) : (
            <div className="aspect-[16/9] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center text-slate-600">
              <Building2 className="h-16 w-16 stroke-[1.2]" />
            </div>
          )}

          <div className="p-5 sm:p-6 space-y-2 relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold text-xs font-semibold tracking-wide">
              <Sparkles className="h-3 w-3" />
              Open House Guest Sign-In
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight leading-snug">
              {oh.address}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              {oh.open_house_at && (
                <div className="flex items-center gap-1.5 text-gold font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateTime(oh.open_house_at)}</span>
                </div>
              )}
              {oh.agent_name && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Hosted by <strong className="text-white font-semibold">{oh.agent_name}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {submitted ? (
          /* Confirmation Success Card */
          <Card className="bg-slate-900/95 border-gold/50 text-center p-8 sm:p-10 space-y-6 animate-in fade-in zoom-in-95 duration-300 shadow-2xl rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                {guestName ? `Welcome, ${guestName}!` : "You're All Signed In!"}
              </h2>
              <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                Thank you for registering today. Please feel free to make yourself at home and tour the property at your own pace.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1.5 text-left">
              <div className="font-semibold text-gold flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4" /> Need Disclosures or Market Insights?
              </div>
              <p className="text-slate-400 leading-relaxed">
                {oh.agent_name
                  ? `${oh.agent_name} is right here to answer any questions about the floor plan, updates, or recent neighborhood sales.`
                  : "Our team is here to help with any questions about this property or upcoming listings."}
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setForm({
                    firstName: "",
                    lastName: "",
                    phone: "",
                    email: "",
                    workingWithAgent: false,
                    agentName: "",
                    buyingOrSelling: "just_browsing",
                    timeframe: "just_browsing",
                    notes: "",
                  });
                }}
                className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs h-10 px-6 rounded-xl"
              >
                Sign In Another Guest
              </Button>
            </div>
          </Card>
        ) : (
          /* Sign-In Interactive Form */
          <Card className="bg-slate-900/90 border-slate-800 shadow-2xl rounded-2xl overflow-hidden backdrop-blur">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Header inside card */}
              <div className="border-b border-slate-800/80 pb-4">
                <h2 className="font-serif font-bold text-xl text-white">
                  Visitor Registration
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Please register so the homeowner knows who attended and we can share property spec sheets with you.
                </p>
              </div>

              {/* Step 1: Contact Info */}
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> 1. Contact Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs text-slate-300 font-medium">
                      First Name <span className="text-rose-400 font-bold">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      autoFocus
                      placeholder="e.g. Sarah"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="bg-slate-950 border-slate-700/80 focus-visible:ring-gold text-white text-sm h-11 rounded-xl placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs text-slate-300 font-medium">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="e.g. Jenkins"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="bg-slate-950 border-slate-700/80 focus-visible:ring-gold text-white text-sm h-11 rounded-xl placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs text-slate-300 font-medium">
                      Phone Number <span className="text-rose-400 font-bold">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="pl-10 bg-slate-950 border-slate-700/80 focus-visible:ring-gold text-white text-sm h-11 rounded-xl placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-slate-300 font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="sarah@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="pl-10 bg-slate-950 border-slate-700/80 focus-visible:ring-gold text-white text-sm h-11 rounded-xl placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Agent Representation */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <HeartHandshake className="h-3.5 w-3.5" /> 2. Representation Status
                </div>
                <Label className="text-xs text-slate-300 font-medium block">
                  Are you currently committed to and working with a real estate agent?
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workingWithAgent: false, agentName: "" })}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all relative flex items-center justify-between",
                      !form.workingWithAgent
                        ? "bg-gold/15 border-gold text-white shadow-md shadow-gold/5"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">No, I'm not represented</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Looking on my own or need guidance</div>
                    </div>
                    {!form.workingWithAgent && (
                      <div className="w-5 h-5 rounded-full bg-gold text-navy flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workingWithAgent: true })}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all relative flex items-center justify-between",
                      form.workingWithAgent
                        ? "bg-gold/15 border-gold text-white shadow-md shadow-gold/5"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">Yes, I have an agent</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Currently working with an agent</div>
                    </div>
                    {form.workingWithAgent && (
                      <div className="w-5 h-5 rounded-full bg-gold text-navy flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>

                {form.workingWithAgent && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="agentName" className="text-xs text-slate-300 font-medium">
                      Agent Name &amp; Brokerage
                    </Label>
                    <Input
                      id="agentName"
                      placeholder="e.g. John Doe with ABC Realty"
                      value={form.agentName}
                      onChange={(e) => setForm({ ...form, agentName: e.target.value })}
                      className="bg-slate-950 border-slate-700/80 focus-visible:ring-gold text-white text-xs h-10 mt-1.5 rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Step 3: Intent */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" /> 3. Real Estate Plans
                </div>
                <Label className="text-xs text-slate-300 font-medium block">
                  What is your primary goal today?
                </Label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "buying", label: "Looking to Buy" },
                    { id: "selling", label: "Looking to Sell" },
                    { id: "both", label: "Buy & Sell" },
                    { id: "just_browsing", label: "Just Browsing" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, buyingOrSelling: opt.id as any })}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-medium text-center transition-all",
                        form.buyingOrSelling === opt.id
                          ? "bg-gold text-navy font-bold shadow-md shadow-gold/10 border-gold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Timeframe */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> 4. Moving Timeline
                </div>
                <Label className="text-xs text-slate-300 font-medium block">
                  What is your timeframe to make a move?
                </Label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "immediate", label: "Immediately (0-30 days)" },
                    { id: "1-3_months", label: "1 to 3 Months" },
                    { id: "3-6_months", label: "3 to 6 Months" },
                    { id: "6-12_months", label: "6 to 12 Months" },
                    { id: "just_browsing", label: "Just Curious" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, timeframe: opt.id as any })}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-medium text-center transition-all",
                        form.timeframe === opt.id
                          ? "bg-gold text-navy font-bold shadow-md shadow-gold/10 border-gold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 5: Notes / Comments */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <Label htmlFor="notes" className="text-xs text-slate-400 font-medium">
                  Questions or Comments (Optional)
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Tell us what you're looking for or specific questions about the home..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="bg-slate-950 border-slate-700/80 focus-visible:ring-gold text-white text-xs rounded-xl placeholder:text-slate-600"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-3">
                <Button
                  onClick={() => signinMutation.mutate()}
                  disabled={signinMutation.isPending}
                  className="w-full bg-gold hover:bg-gold/90 text-navy font-bold py-6 text-base rounded-xl shadow-xl shadow-gold/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {signinMutation.isPending ? (
                    "Signing you in..."
                  ) : (
                    <>
                      Sign In &amp; Tour Home <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-3">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  Your privacy is protected. We will never sell or share your info.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-xl mx-auto space-y-1">
          <div>&copy; {new Date().getFullYear()} Matt Smith Real Estate Group. All rights reserved.</div>
          <div className="text-[10px] text-slate-600">The #1 Real Estate Team in Central Missouri</div>
        </div>
      </footer>
    </div>
  );
}
