import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Bot, Send, Loader2, User, Sparkles, BarChart3, Users, HelpCircle, AlertCircle, Clock, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/assistant")({
  component: AdminAssistantPage,
  head: () => ({ meta: [{ title: "AI CRM Analyst — MSREG Hub" }] }),
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  {
    label: "Pipeline Summary",
    prompt: "Show me a summary of our active deals in the pipeline, showing count and total value by stage.",
    icon: BarChart3,
  },
  {
    label: "Lead Sources",
    prompt: "What are our top lead sources for leads created in the last 30 days? Break down by stage.",
    icon: Users,
  },
  {
    label: "Search Leads",
    prompt: "Search for leads in the 'Lead' stage with source 'Zillow'.",
    icon: Sparkles,
  },
  {
    label: "Agent Response Times",
    prompt: "Show me the average response times and response rates by agent on new leads created in the last 30 days.",
    icon: Clock,
  },
];

// Helper to export parsed markdown table data to CSV file
function downloadCSV(headers: string[], rows: string[][]) {
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `crm-report-${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Inline Markdown Parser to render tables, headers, and bullet lists beautifully.
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

    // Table parsing
    if (block.includes("|") && block.split("\n").length >= 2) {
      const lines = block.split("\n");
      const rows = lines.map(line =>
        line.split("|").map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
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
                onClick={() => downloadCSV(headerRow, bodyRows)}
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

    // Code block
    if (block.startsWith("```")) {
      const lines = block.split("\n");
      const code = lines.slice(1, lines.length - (lines[lines.length - 1] === "```" ? 1 : 0)).join("\n");
      return (
        <pre key={idx} className="bg-muted/40 backdrop-blur-sm p-4 rounded-xl overflow-x-auto my-3 border border-border/80 text-xs font-mono text-foreground/95 shadow-inner">
          <code>{code}</code>
        </pre>
      );
    }

    // Bullet points / lists
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

    // Header tags
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
        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
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

const LOADING_STATUSES = [
  "Formulating plan with Claude...",
  "Querying Follow Up Boss...",
  "Formatting results table...",
  "Reshaping CRM records...",
  "Running agentic loop...",
];

function AdminAssistantPage() {
  const { isAdmin, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I am your AI CRM Analyst. I can query Follow Up Boss and help you analyze active pipelines, lead sources, and find specific contacts. Try clicking one of the shortcuts below to get started!",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(LOADING_STATUSES[0]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Rotate loading messages during long-running tool loops
  useEffect(() => {
    if (isLoading) {
      let step = 0;
      loadingIntervalRef.current = window.setInterval(() => {
        step = (step + 1) % LOADING_STATUSES.length;
        setLoadingStatus(LOADING_STATUSES[step]);
      }, 3500);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setLoadingStatus(LOADING_STATUSES[0]);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [isLoading]);

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
          This AI CRM Assistant route is restricted to administrators only. Please contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      // 1. Get current supabase session JWT
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) {
        throw new Error("Supabase authentication session expired. Please sign in again.");
      }

      // 2. Format Anthropic-compliant history for server request
      // Netlify function will receive this list and continue its loop
      const formattedHistory = updatedMessages.map((m) => {
        // Claude expects content as block array or string.
        // For simplicity we just send a string, or structure it standardly.
        return {
          role: m.role,
          content: m.content,
        };
      });

      // 3. Post request to Netlify Function
      const response = await fetch("/.netlify/functions/fub-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: formattedHistory }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `Server responded with status ${response.status}`);
      }

      if (body.response) {
        setMessages((prev) => [...prev, { role: "assistant", content: body.response }]);
      } else {
        throw new Error("Assistant response was empty.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to contact CRM Assistant.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error occurred:** ${err.message || "Unknown error connecting to FUB AI gateway."}`,
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
      <header className="mb-6 flex items-center gap-4 border-b border-border/40 pb-4">
        <div className="bg-gradient-to-tr from-gold/35 to-amber-500/10 border border-gold/45 rounded-xl p-3 shadow-md shadow-gold/5">
          <Bot className="h-6 w-6 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            AI CRM Analyst
          </h1>
          <p className="text-sm text-muted-foreground">
            Analyze FUB lead pipelines, sources, and contacts securely via Claude.
          </p>
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
                  <div
                    className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                      isAssistant
                        ? "bg-card border border-border/80 rounded-tl-none text-foreground/90"
                        : "bg-gold/10 border border-gold/25 text-foreground px-4 py-3 rounded-tr-none"
                    }`}
                  >
                    {isAssistant ? parseMarkdown(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}
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
              Suggested Analyses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSend(item.prompt)}
                    className="flex items-center gap-3 p-3 text-left rounded-xl border border-border bg-card/60 hover:bg-gold/5 hover:border-gold/30 transition-all group active:scale-[0.99]"
                  >
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-gold/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-gold" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[280px]">
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
            placeholder="Ask anything about pipeline value, sources, or active leads..."
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
