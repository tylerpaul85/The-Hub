import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  Lock,
  Eye,
  FileText,
  Mail,
  ArrowLeft,
  Printer,
  Calendar,
  CheckCircle2,
  Building,
  ExternalLink,
  MessageSquare,
  Phone,
  MapPin,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — MSREG Hub" },
      {
        name: "description",
        content:
          "Privacy Policy for MSREG Hub (Matt Smith Real Estate Group). Details on personal data collection, usage, Meta platform integration, and data deletion rights.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
});

export function PrivacyPolicyPage() {
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
              Print Policy
            </Button>
            <Link to="/sms-terms">
              <Button variant="outline" size="sm" className="text-xs font-medium border-border/60">
                SMS Terms
              </Button>
            </Link>
            <Link to="/data-deletion">
              <Button variant="secondary" size="sm" className="text-xs font-medium">
                Data Deletion
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-border/40 bg-gradient-to-b from-card/60 via-card/20 to-transparent py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold mb-4">
            <Shield className="h-3.5 w-3.5" />
            Official Privacy Statement
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl leading-relaxed">
            Matt Smith Real Estate Group ("MSREG", "we", "us", or "our") is committed to
            safeguarding your privacy and protecting the personal information collected through our
            internal operations hub, client portals, and connected platform services, including the
            Meta Developer Platform (Facebook & Instagram).
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
          {/* Left Quick Navigation (desktop) */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 rounded-xl border border-border/60 bg-card/40 p-4 text-xs space-y-2 backdrop-blur-sm">
              <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-3">
                Contents
              </p>
              <a
                href="#overview"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                1. Overview & Scope
              </a>
              <a
                href="#data-we-collect"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                2. Information We Collect
              </a>
              <a
                href="#meta-data"
                className="block text-muted-foreground hover:text-gold transition-colors py-1 font-medium text-foreground"
              >
                3. Meta Platform Data
              </a>
              <a
                href="#how-we-use"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                4. How We Use Information
              </a>
              <a
                href="#data-sharing"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                5. Sharing &amp; Processors
              </a>
              <a
                href="#sms-messaging"
                className="block text-muted-foreground hover:text-gold transition-colors py-1 font-medium text-foreground"
              >
                6. SMS / Text Messaging
              </a>
              <a
                href="#security-retention"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                7. Security &amp; Retention
              </a>
              <a
                href="#user-rights"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                8. Your Rights &amp; Deletion
              </a>
              <a
                href="#contact"
                className="block text-muted-foreground hover:text-gold transition-colors py-1"
              >
                9. Contact Information
              </a>
            </div>
          </aside>

          {/* Right Document Sections */}
          <div className="lg:col-span-3 space-y-10 text-sm leading-relaxed text-muted-foreground">
            {/* 1. Overview */}
            <section id="overview" className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <FileText className="h-5 w-5 text-gold" />
                1. Overview & Scope
              </h2>
              <p>
                This Privacy Policy applies to personal information gathered by Matt Smith Real
                Estate Group ("MSREG Hub") through our web applications (including{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                  msreginternal.com
                </code>
                ), agent dashboards, open house sign-in interfaces, and our connected third-party
                integrations such as the Meta Platform APIs, CRM systems, and email dispatch
                services.
              </p>
              <p>
                By using MSREG Hub or authorizing our applications via third-party identity
                providers (such as Meta/Facebook Login or Google OAuth), you acknowledge the terms
                described in this policy.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section id="data-we-collect" className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Eye className="h-5 w-5 text-gold" />
                2. Information We Collect
              </h2>
              <p>
                We collect personal information necessary to deliver real estate transaction
                management, agent tooling, and client communication services. This includes:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  <strong className="text-foreground">Contact & Identity Data:</strong> Full name,
                  email address, telephone number, brokerage affiliation, and professional license
                  details.
                </li>
                <li>
                  <strong className="text-foreground">Real Estate Transaction Information:</strong>{" "}
                  Property addresses, seller net sheet parameters, open house guest sign-in records,
                  and closing coordination notes.
                </li>
                <li>
                  <strong className="text-foreground">Technical & Usage Data:</strong> IP address,
                  device characteristics, browser type, operating system, session timestamps, and
                  interaction logs.
                </li>
              </ul>
            </section>

            {/* 3. Meta Platform Data */}
            <section id="meta-data" className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Lock className="h-5 w-5 text-gold" />
                3. Meta Platform Data & API Usage
              </h2>
              <Card className="border-gold/30 bg-gold/5">
                <CardContent className="p-4 sm:p-5 text-xs text-foreground/90 space-y-2">
                  <div className="font-semibold text-gold text-sm flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    Compliance with Meta Platform Terms
                  </div>
                  <p>
                    When you authenticate, connect a Facebook Page, or interact with our
                    applications via Meta APIs (such as Facebook Login, Instagram Graph API, or Meta
                    Lead Ads), we only request the minimum permissions required to provide the
                    service.
                  </p>
                </CardContent>
              </Card>

              <p>Data accessed through Meta APIs may include:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  <strong className="text-foreground">Basic Profile Information:</strong> Your
                  public profile name, verified email address, profile photo URL, and Facebook User
                  ID (scoped to our App ID).
                </li>
                <li>
                  <strong className="text-foreground">Lead Ads & Marketing Data:</strong> When
                  opted-in by an agent or administrator, contact details submitted by prospects
                  through authorized Meta Lead forms to enable prompt follow-up.
                </li>
              </ul>
              <p>
                <strong className="text-foreground">No Secondary Exploitation:</strong> We strictly
                adhere to Meta Developer Policies. We never sell, license, or purchase Meta User
                Data, nor do we use Meta User Data for profiling, behavioral advertising, or data
                brokering.
              </p>
            </section>

            {/* 4. How We Use Information */}
            <section id="how-we-use" className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-gold" />
                4. How We Use Information
              </h2>
              <p>We process collected data for the following lawful purposes:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Authenticating registered agents and authorized staff.</li>
                <li>Facilitating client requests, open house check-ins, and closing gifts.</li>
                <li>Synchronizing client inquiries with our internal CRM (e.g. Follow Up Boss).</li>
                <li>
                  Sending transactional email notifications, digest updates, and password resets.
                </li>
                <li>
                  Maintaining audit logs for security, error monitoring, and platform compliance.
                </li>
              </ul>
            </section>

            {/* 5. Data Sharing & Processors */}
            <section id="data-sharing" className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Building className="h-5 w-5 text-gold" />
                5. Third-Party Service Providers &amp; Sharing Your Information
              </h2>
              <p>
                We do not sell your personal data. We only disclose information to vetted
                third-party vendors who provide infrastructure and specialized operational tools
                under strict confidentiality agreements:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                  <p className="font-semibold text-foreground text-xs">Supabase Inc.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Encrypted PostgreSQL database storage, identity authentication, and row-level
                    security.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                  <p className="font-semibold text-foreground text-xs">Netlify &amp; Cloudflare</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Application edge hosting, TLS encryption, and secure CDN delivery.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                  <p className="font-semibold text-foreground text-xs">Resend Technologies</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Transactional email delivery for agent notifications and security alerts.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                  <p className="font-semibold text-foreground text-xs">Follow Up Boss (FUB)</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Real estate customer relationship management and team coordination.
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-border/70 bg-card/40 p-3.5 text-xs text-foreground font-medium">
                Notwithstanding the above, SMS opt-in data and mobile numbers collected for text
                messaging are never shared with third parties for marketing purposes.
              </div>
            </section>

            {/* 6. SMS / Text Messaging */}
            <section id="sms-messaging" className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-gold" />
                6. SMS / Text Messaging
              </h2>

              <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-xs sm:text-sm text-foreground leading-relaxed">
                <p>
                  <strong>Program name:</strong> Matt Smith Real Estate Group Agent Alerts. For
                  help, reply <strong>HELP</strong> or contact{" "}
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

              <p>
                Matt Smith Real Estate Group LLC (operating as Matt Smith Real Estate Group) may send
                text messages to agents on our team who have opted in to receive appointment check-in
                notifications. We collect the mobile number and consent information provided during
                opt-in and use it only to send these operational messages and to record responses in
                our internal systems. Message frequency varies (up to 3 messages per appointment).
                Message and data rates may apply. Reply <strong>HELP</strong> for help or{" "}
                <strong>STOP</strong> to opt out at any time.
              </p>

              <div className="rounded-xl border border-border/80 bg-card/60 p-4 space-y-2">
                <p className="font-semibold text-foreground">
                  No mobile information will be shared with third parties or affiliates for
                  marketing or promotional purposes. We do not sell or share your SMS opt-in data or
                  personal information with third parties for marketing purposes. All other
                  categories of information described in this policy exclude SMS opt-in data and
                  consent.
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  For full program terms, frequency details, and opt-out details, please see our
                  dedicated{" "}
                  <Link
                    to="/sms-terms"
                    className="text-gold underline hover:opacity-80 font-medium"
                  >
                    SMS Terms &amp; Conditions
                  </Link>
                  .
                </p>
              </div>
            </section>

            {/* 7. Security & Retention */}
            <section id="security-retention" className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Lock className="h-5 w-5 text-gold" />
                7. Security &amp; Retention
              </h2>
              <p>
                We employ industry-standard administrative, physical, and technical security
                controls:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>All network traffic is encrypted using TLS 1.3 / HTTPS.</li>
                <li>Databases are encrypted at rest with AES-256 standards.</li>
                <li>
                  Strict Role-Based Access Control (RBAC) and Supabase Row Level Security (RLS)
                  policies isolate sensitive records.
                </li>
              </ul>
              <p>
                We retain personal information only for as long as necessary to fulfill business
                purposes, comply with statutory real estate record-keeping rules, or until you
                request deletion.
              </p>
            </section>

            {/* 8. User Rights & Data Deletion */}
            <section id="user-rights" className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-gold" />
                8. Your Rights &amp; Data Deletion
              </h2>
              <p>
                Depending on your jurisdiction (such as under GDPR, CCPA, or Meta Developer Platform
                guidelines), you maintain the right to:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Access and receive a copy of your personal data held by us.</li>
                <li>Request rectification of inaccurate or outdated information.</li>
                <li>
                  <strong className="text-foreground">Request complete deletion</strong> of your
                  personal information and revocation of connected platform permissions.
                </li>
              </ul>

              <Card className="border-border/80 bg-card/60">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">
                      Need to delete your data or revoke Meta connection?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Follow our step-by-step instructions or submit an instant deletion request.
                    </p>
                  </div>
                  <Link to="/data-deletion">
                    <Button className="shrink-0 bg-gold hover:bg-gold/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5">
                      Data Deletion Instructions
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </section>

            {/* 9. Contact Information */}
            <section id="contact" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                <Mail className="h-5 w-5 text-gold" />
                9. Contact Information
              </h2>
              <p>
                If you have questions, feedback, or wish to exercise your privacy rights, please
                contact our privacy compliance team:
              </p>
              <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs space-y-2">
                <p className="font-semibold text-foreground text-sm">
                  Matt Smith Real Estate Group
                </p>
                <p className="text-muted-foreground">Attention: Privacy &amp; Compliance Officer</p>
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
                  <span className="text-border">·</span>
                  <a
                    href="mailto:privacy@msreginternal.com"
                    className="hover:text-gold transition-colors"
                  >
                    privacy@msreginternal.com
                  </a>
                </p>
                <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground leading-relaxed">
                  <strong>SMS Support Disclosure:</strong> Matt Smith Real Estate Group Agent
                  Alerts: For help, contact{" "}
                  <a
                    href="mailto:info@mattsmithrealestategroup.com"
                    className="text-gold underline hover:opacity-80"
                  >
                    info@mattsmithrealestategroup.com
                  </a>{" "}
                  or{" "}
                  <a href="tel:5734512020" className="text-gold underline hover:opacity-80">
                    573-451-2020
                  </a>
                  . Msg &amp; data rates may apply. Reply <strong>STOP</strong> to cancel.
                </div>
              </div>
            </section>

            {/* Bottom Actions */}
            <div className="pt-8 flex items-center justify-between border-t border-border/40">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to MSREG Hub
              </Link>
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
