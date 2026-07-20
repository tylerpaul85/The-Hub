import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentAccount {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  office_location: string | null;
  office_phone: string | null;
  created_at: string;
}

export function isValidAgentEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@mattsmithrealestategroup.com");
}

interface AgentAuthContextValue {
  user: User | null;
  session: Session | null;
  agent: AgentAccount | null;
  loading: boolean;
  signUpAgent: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  signInAgent: (email: string, password: string) => Promise<void>;
  signOutAgent: () => Promise<void>;
  resetAgentPassword: (email: string) => Promise<void>;
  refreshAgent: () => Promise<void>;
}

const AgentAuthContext = createContext<AgentAuthContextValue | undefined>(undefined);

export function AgentAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<AgentAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAgentProfile = async (uid: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("agent_accounts")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error("Error fetching agent profile:", error);
        setAgent(null);
      } else {
        setAgent((data as AgentAccount) ?? null);
      }
    } catch (e) {
      setAgent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchAgentProfile(s.user.id);
      } else {
        setAgent(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchAgentProfile(s.user.id);
      } else {
        setAgent(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshAgent = async () => {
    if (user?.id) {
      await fetchAgentProfile(user.id);
    }
  };

  const signUpAgent = async (email: string, password: string, fullName: string, phone?: string) => {
    const cleanEmail = email.trim();
    if (!isValidAgentEmail(cleanEmail)) {
      toast.error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
      throw new Error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
    }

    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      throw new Error("Please enter your full name.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          is_agent: true,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    if (data.user) {
      // Upsert into agent_accounts table
      const { error: dbErr } = await (supabase as any).from("agent_accounts").upsert({
        id: data.user.id,
        email: cleanEmail.toLowerCase(),
        full_name: fullName.trim(),
        phone: phone?.trim() || null,
        office_location: "1043 Kingshighway, Rolla, MO 65401",
        office_phone: "(573) 451-2020",
      });

      if (dbErr) {
        toast.error(dbErr.message || "Failed to create agent profile record.");
        throw dbErr;
      }

      await fetchAgentProfile(data.user.id);
      toast.success("Agent account created!");
    }
  };

  const signInAgent = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    if (!isValidAgentEmail(cleanEmail)) {
      toast.error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
      throw new Error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    if (data.user) {
      await fetchAgentProfile(data.user.id);
      toast.success("Signed in successfully!");
    }
  };

  const signOutAgent = async () => {
    await supabase.auth.signOut();
    setAgent(null);
    setUser(null);
    setSession(null);
    toast.success("Signed out");
  };

  const resetAgentPassword = async (email: string) => {
    const cleanEmail = email.trim();
    if (!isValidAgentEmail(cleanEmail)) {
      toast.error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
      throw new Error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success("Password reset instructions sent to your email!");
  };

  return (
    <AgentAuthContext.Provider
      value={{
        user,
        session,
        agent,
        loading,
        signUpAgent,
        signInAgent,
        signOutAgent,
        resetAgentPassword,
        refreshAgent,
      }}
    >
      {children}
    </AgentAuthContext.Provider>
  );
}

export function useAgentAuth() {
  const context = useContext(AgentAuthContext);
  if (!context) {
    throw new Error("useAgentAuth must be used within an AgentAuthProvider");
  }
  return context;
}
