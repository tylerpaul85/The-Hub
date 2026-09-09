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
  Clock,
  User,
  Phone,
  Mail,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/open-house-signin/$id")({
  ssr: false,
  component: PublicOpenHouseSigninPage,
  head: () => ({
    meta: [
      { title: "Open House Sign-In — Matt Smith Real Estate Group" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
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
      if (!form.phone.trim()) throw new Error("Please enter a phone number.");
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
      setSubmitted(true);
      toast.success("Welcome! Thank you for signing in.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sign in. Please try again.");
    },
  });

  const oh = data?.openHouse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gold border-t-transparent mx-auto" />
          <p className="text-sm text-slate-400">Loading open house details...</p>
        </div>
      </div>
    );
  }

  if (error || !oh) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <Home className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Open House Not Found</h1>
          <p className="text-sm text-slate-400">
            This open house link may have expired or is no longer active.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-20 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Matt Smith Real Estate Group" className="h-8 w-auto" />
            <div>
              <div className="font-semibold text-xs tracking-wide uppercase text-gold">
                Matt Smith Real Estate Group
              </div>
              <div className="text-[10px] text-slate-400">Open House Visitor Sign-In</div>
            </div>
          </div>
          <Badge className="bg-gold/15 text-gold border-gold/30 text-[11px] px-2 py-0.5">
            Welcome
          </Badge>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Property Card */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 shadow-xl">
          {oh.thumbnail ? (
            <div className="aspect-[16/9] w-full relative overflow-hidden">
              <img
                src={oh.thumbnail}
                alt={oh.address}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            </div>
          ) : (
            <div className="aspect-[16/9] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center text-slate-600">
              <Building2 className="h-16 w-16 stroke-[1.2]" />
            </div>
          )}

          <div className="p-5 space-y-2 relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              Open House
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              {oh.address}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              {oh.open_house_at && (
                <div className="flex items-center gap-1.5 text-gold">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateTime(oh.open_house_at)}</span>
                </div>
              )}
              {oh.agent_name && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Hosted by {oh.agent_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {submitted ? (
          /* Confirmation Success View */
          <Card className="bg-slate-900/90 border-gold/40 text-center p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-white">
                You're All Signed In!
              </h2>
              <p className="text-slate-300 text-sm max-w-sm mx-auto leading-relaxed">
                Thank you for visiting today! Please feel free to take your time touring the home.
                {oh.agent_name && ` ${oh.agent_name} is here to help with any questions.`}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 space-y-1 text-left">
              <div className="font-semibold text-slate-200">Need immediate info on this home?</div>
              <div>Ask the hosting agent or contact our team for property disclosures &amp; updates.</div>
            </div>

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
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Sign In Another Guest
            </Button>
          </Card>
        ) : (
          /* Sign-In Form */
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
            <CardContent className="p-6 space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="font-serif font-semibold text-lg text-white">
                  Visitor Registration
                </h2>
                <p className="text-xs text-slate-400">
                  Please register so the owner knows who visited and we can share property details with you.
                </p>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs text-slate-300 font-medium">
                    First Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    autoFocus
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="bg-slate-950 border-slate-700 focus-visible:ring-gold text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs text-slate-300 font-medium">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="bg-slate-950 border-slate-700 focus-visible:ring-gold text-white"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs text-slate-300 font-medium">
                    Phone Number <span className="text-rose-400">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="pl-9 bg-slate-950 border-slate-700 focus-visible:ring-gold text-white"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-slate-300 font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="pl-9 bg-slate-950 border-slate-700 focus-visible:ring-gold text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Working with an agent question */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <Label className="text-xs text-slate-300 font-medium">
                  Are you currently working with a real estate agent?
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workingWithAgent: false, agentName: "" })}
                    className={cn(
                      "py-2.5 px-3 rounded-lg border text-xs font-medium transition-all text-center",
                      !form.workingWithAgent
                        ? "bg-gold/20 border-gold text-gold font-semibold shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    No, I'm not represented
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, workingWithAgent: true })}
                    className={cn(
                      "py-2.5 px-3 rounded-lg border text-xs font-medium transition-all text-center",
                      form.workingWithAgent
                        ? "bg-gold/20 border-gold text-gold font-semibold shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    Yes, I have an agent
                  </button>
                </div>

                {form.workingWithAgent && (
                  <div className="pt-2 animate-in fade-in duration-200">
                    <Label htmlFor="agentName" className="text-[11px] text-slate-400 font-medium">
                      Agent Name &amp; Brokerage
                    </Label>
                    <Input
                      id="agentName"
                      placeholder="e.g. John Smith (ABC Realty)"
                      value={form.agentName}
                      onChange={(e) => setForm({ ...form, agentName: e.target.value })}
                      className="bg-slate-950 border-slate-700 focus-visible:ring-gold text-white text-xs h-9 mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Buying / Selling Intent */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <Label className="text-xs text-slate-300 font-medium">
                  Are you looking to buy, sell, or just browsing?
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "buying", label: "Looking to Buy" },
                    { id: "selling", label: "Looking to Sell" },
                    { id: "both", label: "Buy & Sell" },
                    { id: "just_browsing", label: "Just Browsing / Neighbor" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, buyingOrSelling: opt.id as any })}
                      className={cn(
                        "py-2 px-2.5 rounded-lg border text-xs text-center transition-all",
                        form.buyingOrSelling === opt.id
                          ? "bg-gold/20 border-gold text-gold font-semibold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <Label className="text-xs text-slate-300 font-medium">
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
                        "py-2 px-2.5 rounded-lg border text-xs text-center transition-all",
                        form.timeframe === opt.id
                          ? "bg-gold/20 border-gold text-gold font-semibold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <Label htmlFor="notes" className="text-xs text-slate-400 font-medium">
                  Comments or Questions (Optional)
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="What brings you by today or specific features you are looking for..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="bg-slate-950 border-slate-700 focus-visible:ring-gold text-white text-xs"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  onClick={() => signinMutation.mutate()}
                  disabled={signinMutation.isPending}
                  className="w-full bg-gold hover:bg-gold/90 text-navy font-bold py-6 text-base rounded-xl shadow-lg shadow-gold/20 transition-all active:scale-[0.99]"
                >
                  {signinMutation.isPending ? (
                    "Signing you in..."
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In to Open House <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-2.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  Your information is private and will never be shared.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-xl mx-auto">
          &copy; {new Date().getFullYear()} Matt Smith Real Estate Group. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
