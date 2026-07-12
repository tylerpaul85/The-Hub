import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "admin" | "marketing_coordinator" | "video_editor" | "videographer" | "contributor" | "client_care";

const ROLE_PRIORITY: AppRole[] = ["admin", "marketing_coordinator", "video_editor", "videographer", "client_care", "contributor"];

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  canEditContent: boolean;
  canEditVideos: boolean;
  canDelete: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const IDLE_WARN_MS = 50 * 60 * 1000; // 50 min
const IDLE_LOGOUT_MS = 60 * 60 * 1000; // 60 min

function pingActive(uid: string) {
  (supabase as any)
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", uid)
    .then(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const warnedRef = useRef(false);

  const fetchRole = async (uid: string) => {
    // Session cache: avoid refetching user_roles on every auth state change (token refresh, tab focus, etc.).
    const cacheKey = `user_roles:${uid}`;
    try {
      const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
      if (cached) {
        const list = JSON.parse(cached) as AppRole[];
        setRoles(list);
        setRole(ROLE_PRIORITY.find((r) => list.includes(r)) ?? (list[0] ?? null));
        return;
      }
    } catch {}
    const { data } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (!data || data.length === 0) {
      setRole(null);
      setRoles([]);
      try { sessionStorage.setItem(cacheKey, JSON.stringify([])); } catch {}
      return;
    }
    const list = data.map((r: any) => r.role as AppRole);
    setRoles(list);
    const top = ROLE_PRIORITY.find((r) => list.includes(r)) ?? "contributor";
    setRole(top);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        if (typeof window !== "undefined" && window.location.pathname !== "/reset-password") {
          window.location.assign("/reset-password");
          return;
        }
      }
      if (s?.user) {
        // Only refetch roles on identity transitions; skip TOKEN_REFRESHED/INITIAL_SESSION to avoid extra DB calls.
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          setTimeout(() => fetchRole(s.user.id), 0);
          pingActive(s.user.id);
        }
      } else {
        setRole(null);
        setRoles([]);
        try { sessionStorage.removeItem(`user_roles:${s?.user?.id ?? ""}`); } catch {}
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        pingActive(s.user.id);
        fetchRole(s.user.id).finally(() => setLoading(false));
      } else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Activity heartbeat + idle session timeout
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const ping = () => pingActive(uid);

    const clearTimers = () => {
      if (warnTimer.current) { clearTimeout(warnTimer.current); warnTimer.current = null; }
      if (logoutTimer.current) { clearTimeout(logoutTimer.current); logoutTimer.current = null; }
    };
    const scheduleIdle = () => {
      clearTimers();
      warnedRef.current = false;
      warnTimer.current = window.setTimeout(() => {
        warnedRef.current = true;
        toast.warning("You'll be signed out in 10 minutes due to inactivity. Move your mouse or press a key to stay signed in.", {
          duration: 30_000,
        });
      }, IDLE_WARN_MS);
      logoutTimer.current = window.setTimeout(async () => {
        toast.error("Signed out due to 60 minutes of inactivity.");
        await supabase.auth.signOut();
        if (typeof window !== "undefined") window.location.assign("/auth?reason=timeout");
      }, IDLE_LOGOUT_MS);
    };

    scheduleIdle();
    // Heartbeat: every 30 min while tab visible. Idle timers still enforce 60-min sign-out.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, 30 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") { ping(); scheduleIdle(); } };
    let throttle: number | null = null;
    const onActivity = () => {
      scheduleIdle();
      if (throttle) return;
      // Throttle activity-driven pings to once every 10 min.
      throttle = window.setTimeout(() => { throttle = null; ping(); }, 10 * 60 * 1000);
    };
    document.addEventListener("visibilitychange", onVisible);
    // Only meaningful interactions count — dropped mousemove/scroll to cut listener overhead and ping churn.
    window.addEventListener("click", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      clearInterval(interval);
      clearTimers();
      if (throttle) clearTimeout(throttle);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [user]);

  const signOut = async () => {
    try { if (user) sessionStorage.removeItem(`user_roles:${user.id}`); } catch {}
    await supabase.auth.signOut();
    setRole(null);
    setRoles([]);
  };

  const refreshRole = async () => {
    if (!user) return;
    try { sessionStorage.removeItem(`user_roles:${user.id}`); } catch {}
    await fetchRole(user.id);
  };

  const isAdmin = roles.includes("admin");
  const canEditContent = isAdmin || roles.includes("marketing_coordinator");
  const canEditVideos =
    isAdmin || roles.includes("marketing_coordinator") || roles.includes("video_editor") || roles.includes("videographer");
  const canDelete = roles.length > 0 && !roles.every((r) => r === "client_care");

  return (
    <AuthContext.Provider
      value={{ user, session, role, roles, loading, isAdmin, canEditContent, canEditVideos, canDelete, signOut, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
