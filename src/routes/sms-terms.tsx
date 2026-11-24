import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Shield,
  HelpCircle,
  FileText,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/sms-terms")({
  component: SmsTermsPage,
  head: () => ({
    meta: [
      { title: "SMS Terms & Conditions — Matt Smith Real Estate Group Agent Alerts" },
      {
        name: "description",
        content:
          "SMS Terms and Conditions for Matt Smith Real Estate Group Agent Alerts automated appointment check-in text messaging program.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
});

export function SmsTermsPage() {
  const lastUpdated = "October 2, 2026";

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-gold/30 selection:text-white pb-16 overflow-x-hidden">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.14),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[650px] h-[420px] sm:h-[650px] pointer-events-none opacity-[0.03] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-surface-1/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <img src={logo} alt="MSREG Logo" className="h-8 w-auto" />
            <span className="text-sm font-semibold tracking-wide text-foreground">MSREG Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Terms
            </Button>
            <Link to="/privacy-policy">
              <Button variant="secondary" size="sm" className="text-xs font-medium">
                Privacy Policy
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-border/40 bg-gradient-to-b from-card/60 via-card/20 to-transparent py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold mb-4">
            <MessageSquare className="h-3.5 w-3.5" />
            SMS / Text Messaging Terms
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            SMS Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-base font-medium text-gold">
            Matt Smith Real Estate Group Agent Alerts
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            These SMS Terms &amp; Conditions govern the text messaging program operated by Matt Smith
            Real Estate Group LLC for team agents and operational notifications.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gold" />
              Effective Date: {lastUpdated}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-gold" />
              Matt Smith Real Estate Group
            </span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">
          {/* Quick Summary Aside */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 rounded-xl border border-border/60 bg-card/40 p-4 text-xs space-y-3 backdrop-blur-sm">
              <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                Quick Summary
              </p>
              <div className="space-y-2 text-muted-foreground">
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/40">
                  <p className="font-semibold text-foreground text-[11px]">Program Name</p>
                  <p className="text-[11px] mt-0.5">Matt Smith Real Estate Group Agent Alerts</p>
                </div>
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/40">
                  <p className="font-semibold text-foreground text-[11px]">To Opt Out</p>
                  <p className="text-[11px] mt-0.5">
                    Reply <strong className="text-foreground">STOP</strong> at any time
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/40">
                  <p className="font-semibold text-foreground text-[11px]">For Help</p>
                  <p className="text-[11px] mt-0.5">
                    Reply <strong className="text-foreground">HELP</strong> or call 573-451-2020
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/40">
                  <p className="font-semibold text-foreground text-[11px]">Privacy Guarantee</p>
                  <p className="text-[11px] mt-0.5">
                    Mobile numbers &amp; opt-in data are never sold or shared for marketing.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Document Sections */}
          <div className="lg:col-span-3 space-y-8 text-sm leading-relaxed text-muted-foreground">
            {/* Callout Notice */}
            <div className="rounded-2xl border border-gold/40 bg-gold/10 p-5 text-foreground space-y-2">
              <p className="font-bold text-sm sm:text-base flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-gold shrink-0" />
                SMS Terms &amp; Conditions — Matt Smith Real Estate Group Agent Alerts
              </p>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                <strong>Program name:</strong> Matt Smith Real Estate Group Agent Alerts. For help,
                reply <strong>HELP</strong> or contact{" "}
                <a
                  href="mailto:info@mattsmithrealestategroup.com"
                  className="text-gold underline hover:opacity-80 font-medium"
                >
                  info@mattsmithrealestategroup.com
                </a>{" "}
                or{" "}
                <a
                  href="tel:5734512020"
                  className="text-gold underline hover:opacity-80 font-medium"
                >
                  573-451-2020
                </a>
                . To opt out, reply <strong>STOP</strong>; you will receive one confirmation and no
                further messages. Reply <strong>START</strong> to rejoin.
              </p>
            </div>

            {/* Program Name */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-gold shrink-0" />
                Program Name
              </h2>
              <p className="text-foreground font-medium">
                Matt Smith Real Estate Group Agent Alerts
              </p>
            </section>

            {/* Program Description */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-gold shrink-0" />
                Program Description
              </h2>
              <p>
                Matt Smith Real Estate Group LLC (operating as Matt Smith Real Estate Group) sends
                automated appointment check-in text messages to real estate agents on our team who
                have opted in. After a client appointment, agents receive a text asking for the
                outcome and may reply by text to update our internal records. This program is for
                internal operational notifications only. No marketing messages are sent.
              </p>
            </section>

            {/* Message Frequency */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-gold shrink-0" />
                Message Frequency
              </h2>
              <p>
                Message frequency varies. Up to 3 messages per appointment, plus a confirmation
                once the outcome is recorded.
              </p>
            </section>

            {/* Cost */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-gold shrink-0" />
                Cost
              </h2>
              <p>
                Message and data rates may apply. Check with your mobile carrier for details.
              </p>
            </section>

            {/* Opting Out */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-gold shrink-0" />
                Opting Out
              </h2>
              <p>
                Reply <strong>STOP</strong> at any time to stop receiving messages. You will receive
                one confirmation that you have been unsubscribed, and no further messages will be
                sent. To rejoin, reply <strong>START</strong>.
              </p>
            </section>

            {/* Help */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <HelpCircle className="h-4.5 w-4.5 text-gold shrink-0" />
                Help
              </h2>
              <p>
                Reply <strong>HELP</strong> for help, or contact us at{" "}
                <a
                  href="mailto:info@mattsmithrealestategroup.com"
                  className="text-gold underline hover:opacity-80 font-medium"
                >
                  info@mattsmithrealestategroup.com
                </a>{" "}
                or{" "}
                <a
                  href="tel:5734512020"
                  className="text-gold underline hover:opacity-80 font-medium"
                >
                  573-451-2020
                </a>
                .
              </p>
            </section>

            {/* Carrier Liability */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Building className="h-4.5 w-4.5 text-gold shrink-0" />
                Carrier Liability
              </h2>
              <p>Carriers are not liable for delayed or undelivered messages.</p>
            </section>

            {/* Consent */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-gold shrink-0" />
                Consent
              </h2>
              <p>
                Consent to receive these messages is not a condition of employment, affiliation, or
                any purchase.
              </p>
            </section>

            {/* Privacy */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-gold shrink-0" />
                Privacy
              </h2>
              <Card className="border-border/80 bg-card/60">
                <CardContent className="p-4 sm:p-5 space-y-2 text-foreground">
                  <p className="font-semibold text-foreground">
                    Your mobile information will not be sold or shared with third parties for
                    marketing purposes.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    SMS opt-in data and mobile numbers collected for text messaging are never shared
                    with third parties or affiliates for marketing or promotional purposes.
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/privacy-policy"
                      className="inline-flex items-center gap-1.5 text-xs text-gold underline font-medium hover:opacity-80"
                    >
                      See our Privacy Policy
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Contact */}
            <section className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-gold shrink-0" />
                Contact Information
              </h2>
              <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs space-y-2">
                <p className="font-semibold text-foreground text-sm">
                  Matt Smith Real Estate Group
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
                  713 Missouri Avenue, St. Robert, MO 65584
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gold shrink-0" />
                  <a href="tel:5734512020" className="hover:text-gold transition-colors">
                    573-451-2020
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gold shrink-0" />
                  <a
                    href="mailto:info@mattsmithrealestategroup.com"
                    className="hover:text-gold transition-colors"
                  >
                    info@mattsmithrealestategroup.com
                  </a>
                </p>
              </div>
            </section>

            {/* Bottom Actions */}
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to MSREG Hub
              </Link>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Link to="/privacy-policy" className="hover:text-gold transition-colors">
                  Privacy Policy
                </Link>
                <span>·</span>
                <Link to="/data-deletion" className="hover:text-gold transition-colors">
                  Data Deletion
                </Link>
              </div>
              <span className="text-[11px] text-muted-foreground">
                © {new Date().getFullYear()} Matt Smith Real Estate Group. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
