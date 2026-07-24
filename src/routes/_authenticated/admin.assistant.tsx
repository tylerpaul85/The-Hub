import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot, Send, Loader2, User, Sparkles, BarChart3, Users, AlertCircle, Clock, Download,
  Copy, Info, AlertTriangle, ShieldCheck, FileSpreadsheet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/assistant")({
  component: AdminAssistantPage,
  head: () => ({ meta: [{ title: "Follow Up Boss Reporting Assistant — MSREG Hub" }] }),
});

interface StructuredReportData {
  report_type: "agent_leaderboard" | "pipeline_summary" | "lead_sources" | "search_people";
  generated_at?: string;
  total_matching?: number;
  total_matching_leads?: number;
  total_leads_in_scope?: number;
  records_reviewed?: number;
  returned?: number;
  truncated?: boolean;
  agents?: any[];
  sources?: any[];
  stages_breakdown?: any[];
  total_deals_count?: number;
  total_deals_value?: number;
  average_deal_value?: number;
  people?: any[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  structuredReports?: StructuredReportData[];
  isUnsupportedNotice?: boolean;
}

const SUGGESTIONS = [
  {
    label: "Stale Leads Leaderboard",
    prompt: "Which agents have the most stale leads?",
    icon: Clock,
  },
  {
    label: "Never-Contacted Leads",
    prompt: "Which leads have never been contacted?",
    icon: Users,
  },
  {
    label: "Stale Lead Rates by Agent",
    prompt: "Compare stale-lead rates by agent for leads with no outbound contact in 14 days.",
    icon: BarChart3,
  },
  {
    label: "Lead Source Stale Rates",
    prompt: "Which lead sources have the highest stale rate for leads created in the last 30 days?",
    icon: Sparkles,
  },
  {
    label: "Active Deal Pipeline",
    prompt: "Show the current deal pipeline by stage.",
    icon: BarChart3,
  },
  {
    label: "Agents Needing Follow-up",
    prompt: "Which agents have the most leads needing follow-up?",
    icon: Users,
  },
];

// Helper to export tabular data to CSV
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success(`Exported ${filename}.csv`);
}

// Copy text helper
function copyToClipboard(text: string, label = "Report") {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
}

// Format currency
function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

// Markdown formatting helper
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentText = text;
  let keyIdx = 0;

  while (currentText.length > 0) {
    const boldMatch = currentText.match(/\*\*(.*?)\*\*/);
    const codeMatch = currentText.match(/`(.*?)`/);
    const italicMatch = currentText.match(/\*(.*?)\*/);

    const matches = [
      boldMatch && { index: boldMatch.index!, type: "bold", text: boldMatch[0], content: boldMatch[1] },
      codeMatch && { index: codeMatch.index!, type: "code", text: codeMatch[0], content: codeMatch[1] },
      italicMatch && { index: italicMatch.index!, type: "italic", text: italicMatch[0], content: italicMatch[1] },
    ].filter(Boolean) as Array<{ index: number; type: string; text: string; content: string }>;

    if (matches.length === 0) {
      parts.push(currentText);
      break;
    }

    matches.sort((a, b) => a.index - b.index);
    const firstMatch = matches[0];

    if (firstMatch.index > 0) {
      parts.push(currentText.substring(0, firstMatch.index));
    }

    if (firstMatch.type === "bold") {
      parts.push(<strong key={keyIdx++} className="font-bold text-foreground">{firstMatch.content}</strong>);
    } else if (firstMatch.type === "code") {
      parts.push(<code key={keyIdx++} className="bg-muted/90 border border-border/80 px-1.5 py-0.5 rounded text-xs font-mono text-gold font-semibold shadow-sm">{firstMatch.content}</code>);
    } else if (firstMatch.type === "italic") {
      parts.push(<em key={keyIdx++} className="italic text-foreground/80">{firstMatch.content}</em>);
    }

    currentText = currentText.substring(firstMatch.index + firstMatch.text.length);
  }

  return parts;
}

function parseMarkdown(text: string): React.ReactNode {
  const blocks = text.split(/\n\n+/);

  return blocks.map((block, idx) => {
    block = block.trim();
    if (!block) return null;

    // Tables
    if (block.includes("|") && block.split("\n").length >= 2) {
      const lines = block.split("\n");
      const rows = lines.map((line) =>
        line.split("|").map((cell) => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
      );

      const hasSeparator = lines[1]?.includes("-") && lines[1]?.includes("|");

      if (hasSeparator) {
        const headerRow = rows[0];
        const bodyRows = rows.slice(2);

        return (
          <div key={idx} className="my-4 border border-border/60 rounded-xl bg-card/60 overflow-hidden shadow-sm backdrop-blur-sm">
            <div className="flex justify-between items-center px-4 py-2 bg-muted/30 border-b border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Report Table</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downloadCSV("crm-report", headerRow, bodyRows)}
                className="h-7 px-2.5 py-1 text-xs flex items-center gap-1.5 hover:bg-gold/10 hover:text-gold border border-border/50 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/15">
                    {headerRow.map((cell, cIdx) => (
                      <th key={cIdx} className="p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        {parseInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/10 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-3 text-foreground/90 font-medium">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    }

    // Code blocks
    if (block.startsWith("```")) {
      const lines = block.split("\n");
      const code = lines.slice(1, lines.length - (lines[lines.length - 1] === "```" ? 1 : 0)).join("\n");
      return (
        <pre key={idx} className="bg-muted/40 backdrop-blur-sm p-4 rounded-xl overflow-x-auto my-3 border border-border/80 text-xs font-mono text-foreground/95 shadow-inner">
          <code>{code}</code>
        </pre>
      );
    }

    // Lists
    if (block.startsWith("- ") || block.startsWith("* ") || /^\d+\.\s/.test(block)) {
      const items = block.split(/\n/);
      return (
        <ul key={idx} className="list-disc pl-6 my-3 space-y-2 text-foreground/90 leading-relaxed">
          {items.map((item, itemIdx) => {
            const cleanItem = item.replace(/^([-*]|\d+\.)\s+/, "");
            return <li key={itemIdx}>{parseInline(cleanItem)}</li>;
          })}
        </ul>
      );
    }

    // Headers
    if (block.startsWith("#")) {
      const match = block.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const headingText = match[2];
        const classNames =
          level === 1 ? "text-2xl font-extrabold tracking-tight mt-6 mb-3 text-foreground" :
          level === 2 ? "text-xl font-bold tracking-tight mt-5 mb-2.5 text-foreground/90 border-b border-border/40 pb-1" :
          level === 3 ? "text-lg font-semibold tracking-tight mt-4 mb-2 text-gold" :
          "text-base font-semibold mt-3 mb-1 text-foreground/80";
        const HeadingTag = `h${level}` as any;
        return (
          <HeadingTag key={idx} className={classNames}>
            {parseInline(headingText)}
          </HeadingTag>
        );
      }
    }

    // Paragraph
    return (
      <p key={idx} className="leading-relaxed my-3 text-foreground/90 text-[15px]">
        {parseInline(block)}
      </p>
    );
  });
}

// Component to render structured report tables directly in React
function RenderStructuredReport({ report }: { report: StructuredReportData }) {
  if (!report || !report.report_type) return null;

  const generatedAt = report.generated_at ? new Date(report.generated_at).toLocaleTimeString() : null;

  return (
    <div className="my-4 border border-gold/30 rounded-2xl bg-card/80 overflow-hidden shadow-lg backdrop-blur-md">
      {/* Report Header */}
      <div className="flex flex-wrap justify-between items-center px-4 py-3 bg-muted/40 border-b border-border/60 gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-gold/50 bg-gold/10 text-gold font-bold text-xs uppercase px-2.5 py-0.5">
            {report.report_type === "agent_leaderboard" && "Agent Follow-up Leaderboard"}
            {report.report_type === "pipeline_summary" && "Active Deal Pipeline Summary"}
            {report.report_type === "lead_sources" && "Lead Sources Performance Report"}
            {report.report_type === "search_people" && "Lead Contact Search Results"}
          </Badge>
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Calculated Report (Authoritative Data)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-[11px] text-muted-foreground">Generated at {generatedAt}</span>
          )}
          {report.report_type === "agent_leaderboard" && report.agents && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const headers = ["Agent Name", "Total Leads", "Stale (Outbound)", "Stale %", "Never Contacted"];
                const dataRows = report.agents!.map((a) => [a.name, a.total_in_scope, a.stale_by_outbound_contact, `${a.pct_stale_by_outbound_contact}%`, a.never_contacted]);
                const metaHeader = [
                  ["NOTE: Matt Smith is excluded from agent performance reporting because owner-assigned pond leads do not represent individual agent follow-up activity."],
                  [`Reportable Agent Leads: ${report.pond_summary?.reportable_agent_leads ?? 0}`, `Shared Pond / Owner Assigned: ${report.pond_summary?.shared_pond_owner_assigned ?? 0}`, `Excluded Users: Matt Smith`],
                  []
                ];
                downloadCSV("agent-leaderboard", headers, [...metaHeader, ...dataRows] as any);
              }}
              className="h-7 px-2.5 text-xs flex items-center gap-1 hover:border-gold hover:text-gold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
          {report.report_type === "pipeline_summary" && report.stages_breakdown && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const headers = ["Pipeline", "Stage", "Deals Count", "Total Value", "Average Value"];
                const rows = report.stages_breakdown!.map((s) => [s.pipeline, s.stage, s.count, formatUSD(s.total_value), formatUSD(s.average_value)]);
                downloadCSV("pipeline-summary", headers, rows);
              }}
              className="h-7 px-2.5 text-xs flex items-center gap-1 hover:border-gold hover:text-gold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
        </div>
      </div>

      {/* Truncation warning banner if applicable */}
      {report.truncated && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <b>Partial Dataset Notice:</b> Report reflects first {report.unique_records_processed ?? report.records_reviewed ?? report.returned ?? "retrieved"} unique matching leads out of {report.total_matching_leads ?? report.total_matching ?? report.total_leads_in_scope ?? "total"} total matching records. Rankings and team-wide percentages reflect this sample only.
          </span>
        </div>
      )}

      {/* Exclusion Note Banner for Agent Reports */}
      {report.report_type === "agent_leaderboard" && (
        <div className="px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/30 flex flex-wrap items-center justify-between text-xs text-blue-300 gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Info className="h-4 w-4 shrink-0 text-blue-400" />
            Matt Smith is excluded from agent performance reporting because owner-assigned pond leads do not represent individual agent follow-up activity.
          </span>
        </div>
      )}

      {/* Pond Summary Bar */}
      {report.report_type === "agent_leaderboard" && report.pond_summary && (
        <div className="p-3 bg-muted/15 border-b border-border/40 flex flex-wrap gap-6 text-xs">
          <div>
            <span className="text-muted-foreground font-medium">Reportable Agent Leads: </span>
            <span className="font-bold text-foreground">{report.pond_summary.reportable_agent_leads}</span>
          </div>
          <div>
            <span className="text-muted-foreground font-medium">Shared Pond / Owner Assigned: </span>
            <span className="font-bold text-gold">{report.pond_summary.shared_pond_owner_assigned}</span>
          </div>
          <div>
            <span className="text-muted-foreground font-medium">Excluded Reporting Users: </span>
            <span className="font-semibold text-foreground">{report.pond_summary.excluded_reporting_users.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Report 1: Agent Leaderboard */}
      {report.report_type === "agent_leaderboard" && report.agents && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                <th className="p-3">Agent</th>
                <th className="p-3 text-right">Leads in Scope</th>
                <th className="p-3 text-right">Stale by Activity</th>
                <th className="p-3 text-right">Stale by Outbound Contact</th>
                <th className="p-3 text-right">Stale Rate %</th>
                <th className="p-3 text-right">Never Contacted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {report.agents.map((a: any, i: number) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 font-semibold text-foreground">{a.name}</td>
                  <td className="p-3 text-right">{a.total_in_scope}</td>
                  <td className="p-3 text-right text-muted-foreground">{a.stale_by_activity}</td>
                  <td className="p-3 text-right font-medium text-amber-400">{a.stale_by_outbound_contact}</td>
                  <td className="p-3 text-right font-bold text-gold">
                    {a.pct_stale_by_outbound_contact}%
                    <span className="block text-[10px] text-muted-foreground font-normal">{a.denominator_context}</span>
                  </td>
                  <td className="p-3 text-right font-medium text-red-400">{a.never_contacted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report 2: Pipeline Summary */}
      {report.report_type === "pipeline_summary" && report.stages_breakdown && (
        <div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-border/40 bg-muted/10">
            <div className="p-3 rounded-xl bg-card border border-border/60">
              <div className="text-xs text-muted-foreground font-medium">Total Active Deals</div>
              <div className="text-xl font-extrabold text-foreground mt-0.5">{report.total_deals_count}</div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border/60">
              <div className="text-xs text-muted-foreground font-medium">Total Pipeline Value</div>
              <div className="text-xl font-extrabold text-gold mt-0.5">{formatUSD(report.total_deals_value || 0)}</div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border/60">
              <div className="text-xs text-muted-foreground font-medium">Average Deal Value</div>
              <div className="text-xl font-extrabold text-foreground mt-0.5">{formatUSD(report.average_deal_value || 0)}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                  <th className="p-3">Pipeline</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3 text-right">Deal Count</th>
                  <th className="p-3 text-right">Total Value</th>
                  <th className="p-3 text-right">Average Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {report.stages_breakdown.map((s: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-medium text-muted-foreground">{s.pipeline}</td>
                    <td className="p-3 font-semibold text-foreground">{s.stage}</td>
                    <td className="p-3 text-right font-bold">{s.count}</td>
                    <td className="p-3 text-right font-semibold text-gold">{formatUSD(s.total_value)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatUSD(s.average_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Lead Sources */}
      {report.report_type === "lead_sources" && report.sources && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                <th className="p-3">Marketing Source</th>
                <th className="p-3 text-right">Leads Reviewed</th>
                <th className="p-3 text-right">Stale Leads</th>
                <th className="p-3 text-right">Stale Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {report.sources.map((src: any, i: number) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 font-semibold text-foreground">{src.source}</td>
                  <td className="p-3 text-right font-medium">{src.totalCount}</td>
                  <td className="p-3 text-right text-amber-400 font-medium">{src.staleCount}</td>
                  <td className="p-3 text-right font-bold text-gold">
                    {src.stale_rate}%
                    <span className="block text-[10px] text-muted-foreground font-normal">{src.denominator_context}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report 4: Lead Search Results */}
      {report.report_type === "search_people" && report.people && (
        <div>
          <div className="px-4 py-2 bg-muted/20 border-b border-border/40 text-xs text-muted-foreground flex justify-between">
            <span>Showing {report.returned} of {report.total_matching} matching contacts</span>
            {report.truncated && <span className="text-amber-400 font-medium">Truncated (max ceiling)</span>}
          </div>
          {report.people.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No contacts match the requested search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                    <th className="p-3">Lead Name</th>
                    <th className="p-3">Assigned Agent</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Days Since Outbound</th>
                    <th className="p-3">Contact Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {report.people.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-semibold text-foreground">{p.name}</td>
                      <td className="p-3 text-muted-foreground">{p.assigned_to}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[11px] font-normal">{p.stage}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{p.source}</td>
                      <td className="p-3 text-xs font-medium">
                        {p.days_since_outbound_contact !== null ? `${p.days_since_outbound_contact} days ago` : <span className="text-red-400">Never</span>}
                      </td>
                      <td className="p-3">
                        {p.contacted ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">Contacted</Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">Uncontacted</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminAssistantPage() {
  const { isAdmin, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Welcome to the **Follow Up Boss Reporting Assistant**. I provide operational reports on active deal pipelines, lead sources, and team follow-up metrics. Click a shortcut below or ask a question to generate a report.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Understanding request...");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <span>Verifying admin session...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 text-center border border-destructive/20 bg-destructive/5 rounded-2xl">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-sm">
          This Follow Up Boss Reporting Assistant route is restricted to administrators only.
        </p>
      </div>
    );
  }

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userQuery = textToSend.trim();

    // Unsupported question intercept for text response times
    if (/response time|text response|reply time|how fast/i.test(userQuery) && !/stale|leaderboard|pipeline|source/i.test(userQuery)) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userQuery },
        {
          role: "assistant",
          isUnsupportedNotice: true,
          content: "⚠️ **Unsupported Metric Request**\n\nI cannot calculate actual text or call response times from current data because individual message-level timestamps are not available to this report.\n\n**Supported Reports Available Now:**\n- **Agent Stale Leads Leaderboard**: Show agents with leads having no outbound contact in 14+ days\n- **Uncontacted Leads Search**: Find new leads with zero outbound calls, texts, or emails\n- **Active Deal Pipeline**: Show active deal counts and value by stage\n- **Lead Sources Breakdown**: Compare lead stale rates across marketing sources",
        },
      ]);
      setInputValue("");
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: userQuery };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);
    setLoadingStatus("Understanding request...");

    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) {
        throw new Error("Supabase session expired. Please sign in again.");
      }

      let currentHistory: any[] = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let iterations = 0;
      let replyText = "";
      const collectedReports: StructuredReportData[] = [];
      const maxIterations = 5;

      while (iterations < maxIterations) {
        iterations++;
        setLoadingStatus(iterations === 1 ? "Retrieving Follow Up Boss data..." : `Calculating report (Step ${iterations})...`);

        const chatResponse = await fetch("/.netlify/functions/fub-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "chat",
            messages: currentHistory,
          }),
        });

        let chatBody: any = null;
        const chatContentType = chatResponse.headers.get("Content-Type") || "";
        if (chatContentType.includes("application/json")) {
          chatBody = await chatResponse.json();
        } else {
          const text = await chatResponse.text();
          throw new Error(text.slice(0, 180) || `Server responded with status ${chatResponse.status}`);
        }

        if (!chatResponse.ok) {
          throw new Error(chatBody?.error || `Server responded with status ${chatResponse.status}`);
        }

        const result = chatBody.result;
        if (!result) {
          throw new Error("Assistant response was empty.");
        }

        currentHistory.push({
          role: "assistant",
          content: result.content,
        });

        if (result.stop_reason !== "tool_use") {
          const textBlock = result.content.find((c: any) => c.type === "text");
          replyText = textBlock ? textBlock.text : "";
          break;
        }

        const toolUses = result.content.filter((c: any) => c.type === "tool_use");
        setLoadingStatus("Calculating report metrics...");

        const toolResults = await Promise.all(
          toolUses.map(async (toolUse: any) => {
            const { name, input, id: toolUseId } = toolUse;

            const toolResponse = await fetch("/.netlify/functions/fub-assistant", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                action: "tool",
                toolName: name,
                input,
              }),
            });

            let toolBody: any = null;
            const toolContentType = toolResponse.headers.get("Content-Type") || "";
            if (toolContentType.includes("application/json")) {
              toolBody = await toolResponse.json();
            } else {
              const text = await toolResponse.text();
              throw new Error(`Tool error: ${text.slice(0, 100)}`);
            }

            if (!toolResponse.ok) {
              return {
                type: "tool_result",
                tool_use_id: toolUseId,
                content: JSON.stringify({ error: toolBody?.error || "Tool execution failed" }),
              };
            }

            if (toolBody?.result && typeof toolBody.result === "object" && toolBody.result.report_type) {
              collectedReports.push(toolBody.result as StructuredReportData);
            }

            return {
              type: "tool_result",
              tool_use_id: toolUseId,
              content: JSON.stringify(toolBody.result),
            };
          })
        );

        setLoadingStatus("Preparing explanation...");

        currentHistory.push({
          role: "user",
          content: toolResults,
        });
      }

      if (replyText) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: replyText,
            structuredReports: collectedReports.length > 0 ? collectedReports : undefined,
          },
        ]);
      } else {
        throw new Error("Loop completed without generating an answer.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Report Execution Notice:** ${err.message || "Unknown error connecting to Follow Up Boss reporting gateway."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSend(inputValue);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto h-[calc(100vh-theme(spacing.16))] flex flex-col">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="bg-gradient-to-tr from-gold/35 to-amber-500/10 border border-gold/45 rounded-xl p-3 shadow-md shadow-gold/5">
            <Bot className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              Follow Up Boss Reporting Assistant
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operational CRM reports, deal pipelines, lead sources, and team follow-up metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1">
            Authoritative Metrics
          </Badge>
          <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold text-xs px-2.5 py-1">
            Live FUB API
          </Badge>
        </div>
      </header>

      {/* Main chat UI */}
      <Card className="flex-1 flex flex-col bg-card/40 border border-border/80 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
        <ScrollArea className="flex-1 p-4 lg:p-6">
          <div className="space-y-6 pb-4">
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <div key={index} className={`flex gap-3.5 ${isAssistant ? "justify-start" : "justify-end"}`}>
                  {isAssistant && (
                    <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <Bot className="h-5 w-5 text-gold" />
                    </div>
                  )}

                  <div className="max-w-[88%] space-y-3">
                    {/* Render Structured Reports if present */}
                    {isAssistant && message.structuredReports && message.structuredReports.map((report, rIdx) => (
                      <RenderStructuredReport key={rIdx} report={report} />
                    ))}

                    {/* Message text block */}
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isAssistant
                          ? message.isUnsupportedNotice
                            ? "bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-tl-none"
                            : "bg-card border border-border/80 rounded-tl-none text-foreground/90"
                          : "bg-gold/10 border border-gold/25 text-foreground px-4 py-3 rounded-tr-none"
                      }`}
                    >
                      {isAssistant && message.structuredReports && message.structuredReports.length > 0 && (
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gold mb-2 flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5" /> AI Observations & Commentary
                        </div>
                      )}

                      {isAssistant ? parseMarkdown(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}

                      {isAssistant && !message.isUnsupportedNotice && (
                        <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(message.content, "Report commentary")}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isAssistant && (
                    <div className="h-9 w-9 rounded-xl bg-muted border border-border/80 flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3.5 justify-start">
                <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="h-5 w-5 text-gold" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-card border border-border/80 text-muted-foreground text-sm flex items-center gap-3.5 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  <span className="font-medium animate-pulse">{loadingStatus}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Suggestion list */}
        {messages.length === 1 && !isLoading && (
          <div className="px-6 py-4 border-t border-border/40 bg-muted/10">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Supported Report Shortcuts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SUGGESTIONS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSend(item.prompt)}
                    className="flex items-center gap-3 p-3 text-left rounded-xl border border-border bg-card/60 hover:bg-gold/5 hover:border-gold/30 transition-all group active:scale-[0.99]"
                  >
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-gold/10 transition-colors shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {item.prompt}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-border/40 bg-card/60 flex gap-2 items-center">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask for an agent leaderboard, deal pipeline, lead sources, or search contacts..."
            className="flex-1 bg-background/80 border-border/80 focus-visible:ring-gold focus-visible:border-gold/60 py-5 rounded-xl text-sm"
          />
          <Button
            onClick={() => handleSend(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            className="bg-gold text-gold-foreground hover:bg-gold/90 h-10 w-10 p-0 rounded-xl shadow-sm shrink-0 flex items-center justify-center transition-transform active:scale-95"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
