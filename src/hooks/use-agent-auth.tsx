import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

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
  agent: AgentAccount | null;
  loading: boolean;
  signUpAgent: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  signInAgent: (email: string, password: string) => Promise<void>;
  signOutAgent: () => Promise<void>;
  resetAgentPassword: (email: string) => Promise<void>;
  refreshAgent: () => Promise<void>;
  sellerSupabase: any;
}

const AgentAuthContext = createContext<AgentAuthContextValue | undefined>(undefined);

// Base URLs for creating the custom client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export function AgentAuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<AgentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Initialize a custom client that passes the seller session token
  const sellerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: token ? { "x-seller-session": token } : {},
    },
  });

  const fetchAgentProfile = async (currentToken: string) => {
    try {
      const { data, error } = await supabase.rpc("seller_get_profile", {
        p_token: currentToken,
      });
      if (error || (data as any)?.error) {
        setAgent(null);
        setToken(null);
        localStorage.removeItem("seller_session");
      } else if (data && (data as any).account) {
        setAgent((data as any).account);
      }
    } catch (e) {
      setAgent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("seller_session");
    if (savedToken) {
      setToken(savedToken);
      fetchAgentProfile(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const refreshAgent = async () => {
    if (token) {
      await fetchAgentProfile(token);
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

    const { data, error } = await supabase.rpc("seller_signup", {
      p_email: cleanEmail,
      p_password: password,
      p_full_name: fullName.trim(),
      p_phone: phone?.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    const resp = data as any;
    if (resp.error) {
      toast.error(resp.error);
      throw new Error(resp.error);
    }

    if (resp.token && resp.account) {
      setToken(resp.token);
      setAgent(resp.account);
      localStorage.setItem("seller_session", resp.token);
      toast.success("Agent account created!");
    }
  };

  const signInAgent = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    if (!isValidAgentEmail(cleanEmail)) {
      toast.error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
      throw new Error("Accounts are limited to @mattsmithrealestategroup.com email addresses.");
    }

    const { data, error } = await supabase.rpc("seller_login", {
      p_email: cleanEmail,
      p_password: password,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    const resp = data as any;
    if (resp.error) {
      toast.error(resp.error);
      throw new Error(resp.error);
    }

    if (resp.token && resp.account) {
      setToken(resp.token);
      setAgent(resp.account);
      localStorage.setItem("seller_session", resp.token);
      toast.success("Signed in successfully!");
    }
  };

  const signOutAgent = async () => {
    if (token) {
      await supabase.rpc("seller_logout", { p_token: token });
    }
    setAgent(null);
    setToken(null);
    localStorage.removeItem("seller_session");
    toast.success("Signed out");
  };

  const resetAgentPassword = async (email: string) => {
    toast.info("Password reset is currently being updated for the new Seller system. Please contact an admin for assistance.");
  };

  return (
    <AgentAuthContext.Provider
      value={{
        agent,
        loading,
        signUpAgent,
        signInAgent,
        signOutAgent,
        resetAgentPassword,
        refreshAgent,
        sellerSupabase,
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
