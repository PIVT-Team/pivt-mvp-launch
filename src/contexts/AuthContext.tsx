import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackAuthEvent } from "@/services/authTrackingService";
import { logAdminAction } from "@/services/adminAuditService";
import type { User, Session } from "@supabase/supabase-js";

export type AdminRole = 'admin' | 'super_admin' | 'ops_admin' | 'support_admin' | 'read_only' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isApprovedAdmin: boolean;
  adminRole: AdminRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isPlatformAdmin: false,
  isApprovedAdmin: false,
  adminRole: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isApprovedAdmin, setIsApprovedAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>(null);

  const checkAdminRoles = async (userId: string) => {
    // Check basic admin role
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" as any })
      .then(({ data }) => setIsAdmin(!!data));

    // Check platform admin (role + allowlist)
    supabase.rpc("is_platform_admin", { _user_id: userId })
      .then(({ data }) => setIsPlatformAdmin(!!data));

    // Check allowlist approval
    supabase.rpc("is_approved_admin" as any, { _user_id: userId })
      .then(({ data }: any) => setIsApprovedAdmin(!!data));

    // Determine specific admin role
    const roles: AdminRole[] = ['super_admin', 'admin', 'ops_admin', 'support_admin', 'read_only'];
    Promise.all(
      roles.map(role =>
        supabase.rpc("has_role", { _user_id: userId, _role: role as any }).then(({ data }) => ({ role, has: !!data }))
      )
    ).then(results => {
      const found = results.find(r => r.has);
      setAdminRole(found ? found.role : null);
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRoles(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          checkAdminRoles(session.user.id);
        } else {
          setIsAdmin(false);
          setIsPlatformAdmin(false);
          setIsApprovedAdmin(false);
          setAdminRole(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (user) {
      trackAuthEvent({ eventType: 'user_logout', userId: user.id, email: user.email ?? undefined });
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isPlatformAdmin, isApprovedAdmin, adminRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}