import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
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
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOutAgent: () => Promise<void>;
  resetAgentPassword: (email: string) => Promise<void>;
  refreshAgent: () => Promise<void>;
  sellerSupabase: any;
}

const AgentAuthContext = createContext<AgentAuthContextValue | undefined>(undefined);

// Base URLs for creating the custom client
const getSupabaseUrl = () => import.meta.env.VITE_SUPABASE_URL ?? (typeof process !== 'undefined' ? process.env.SUPABASE_URL : "");
const getSupabaseKey = () => import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? (typeof process !== 'undefined' ? process.env.SUPABASE_PUBLISHABLE_KEY : "");

export function AgentAuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<AgentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Initialize a custom client that passes the seller session token
  const sellerSupabase = useMemo(() => {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    if (!url || !key) return null as any;
    
    return createClient(url, key, {
      global: {
        headers: token ? { "x-seller-session": token } : {},
      },
    });
  }, [token]);

  const fetchAgentProfile = async (currentToken: string) => {
    try {
      const { data, error } = await (supabase as any).rpc("seller_get_profile", {
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

  const syncSupabaseUserToAgent = async (userEmail: string, userMeta?: any) => {
    if (!isValidAgentEmail(userEmail)) return;
    try {
      const { syncAgentSessionFn } = await import("@/lib/agent-auth.functions");
      const fullName = userMeta?.full_name || userMeta?.name || [userMeta?.first_name, userMeta?.last_name].filter(Boolean).join(" ");
      const res = await syncAgentSessionFn({
        data: {
          email: userEmail,
          fullName: fullName || undefined,
          phone: userMeta?.phone || undefined,
        },
      });
      if (res?.token && res?.account) {
        setToken(res.token);
        setAgent(res.account);
        localStorage.setItem("seller_session", res.token);
      }
    } catch (err) {
      console.warn("[syncSupabaseUserToAgent] unable to auto-sync agent session:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const savedToken = localStorage.getItem("seller_session");
      if (savedToken) {
        setToken(savedToken);
        await fetchAgentProfile(savedToken);
      } else {
        // Check if there is an active Supabase Google session
        try {
          const { data } = await supabase.auth.getSession();
          const supaUser = data.session?.user;
          if (supaUser?.email && isValidAgentEmail(supaUser.email)) {
            await syncSupabaseUserToAgent(supaUser.email, supaUser.user_metadata);
          }
        } catch (e) {
          // ignore
        } finally {
          if (mounted) setLoading(false);
        }
      }
    }

    initAuth();

    // Listen to Supabase auth changes so Google OAuth log-ins auto-sync
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email && isValidAgentEmail(session.user.email)) {
        const curToken = localStorage.getItem("seller_session");
        if (!curToken) {
          await syncSupabaseUserToAgent(session.user.email, session.user.user_metadata);
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const refreshAgent = async () => {
    if (token) {
      await fetchAgentProfile(token);
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo || window.location.href,
        queryParams: {
          hd: "mattsmithrealestategroup.com",
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      toast.error(error.message || "Failed to initiate Google sign-in");
      throw error;
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

    const { data, error } = await (supabase as any).rpc("seller_signup", {
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

    const { data, error } = await (supabase as any).rpc("seller_login", {
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
      await (supabase as any).rpc("seller_logout", { p_token: token });
    }
    setAgent(null);
    setToken(null);
    localStorage.removeItem("seller_session");
    // Also sign out of Supabase if signed in
    await supabase.auth.signOut().catch(() => {});
    toast.success("Signed out");
  };

  const resetAgentPassword = async (email: string) => {
    toast.info("Password reset: You can sign in instantly with Google, or contact Tyler for a password reset.");
  };

  return (
    <AgentAuthContext.Provider
      value={{
        agent,
        loading,
        signUpAgent,
        signInAgent,
        signInWithGoogle,
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
