import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/roles';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  branchId: string | null;
  assignedBranches: string[];
  profile: { full_name: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  setActiveBranch: (branchId: string) => void;
  needsBranchSelection: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_BRANCH_KEY = 'sbj-active-branch';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsBranchSelection, setNeedsBranchSelection] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      const [roleRes, profileRes, branchRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('full_name, email, branch_id').eq('user_id', userId).maybeSingle(),
        supabase.from('staff_branch_assignments').select('branch_id').eq('user_id', userId),
      ]);

      if (roleRes.data) setRole(roleRes.data.role as AppRole);
      if (profileRes.data) {
        setProfile({ full_name: profileRes.data.full_name, email: profileRes.data.email });
      }

      const branches = branchRes.data?.map(b => b.branch_id) || [];
      setAssignedBranches(branches);

      // Determine active branch — locked per session (sessionStorage)
      const savedBranch = sessionStorage.getItem(ACTIVE_BRANCH_KEY);
      const profileBranch = profileRes.data?.branch_id;
      const userRole = roleRes.data?.role as AppRole;

      if (userRole === 'admin') {
        if (savedBranch) {
          setBranchId(savedBranch);
          setNeedsBranchSelection(false);
        } else if (branches.length > 1) {
          setNeedsBranchSelection(true);
        } else if (branches.length === 1) {
          setBranchId(branches[0]);
          sessionStorage.setItem(ACTIVE_BRANCH_KEY, branches[0]);
          setNeedsBranchSelection(false);
        } else if (profileBranch) {
          setBranchId(profileBranch);
          sessionStorage.setItem(ACTIVE_BRANCH_KEY, profileBranch);
          setNeedsBranchSelection(false);
        } else {
          // Admin with no branch — must pick one (loaded via branches table for admins)
          setNeedsBranchSelection(true);
        }
      } else if (branches.length > 1) {
        if (savedBranch && branches.includes(savedBranch)) {
          setBranchId(savedBranch);
          setNeedsBranchSelection(false);
        } else {
          setNeedsBranchSelection(true);
        }
      } else if (branches.length === 1) {
        setBranchId(branches[0]);
        sessionStorage.setItem(ACTIVE_BRANCH_KEY, branches[0]);
        setNeedsBranchSelection(false);
      } else if (profileBranch) {
        setBranchId(profileBranch);
        sessionStorage.setItem(ACTIVE_BRANCH_KEY, profileBranch);
        setNeedsBranchSelection(false);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRole(null);
          setBranchId(null);
          setProfile(null);
          setAssignedBranches([]);
          setNeedsBranchSelection(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set the active branch.
  // - Staff: locked to selection at login. To switch, must sign out and sign in again.
  // - Admin: can switch instantly at any time. Each switch is audit-logged.
  const setActiveBranch = (id: string) => {
    const previous = branchId;
    setBranchId(id);
    sessionStorage.setItem(ACTIVE_BRANCH_KEY, id);
    localStorage.setItem(ACTIVE_BRANCH_KEY, id);
    setNeedsBranchSelection(false);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[branch] active_branch_id =', id);
    }

    // Audit-log branch switches by admins (skip the initial selection)
    if (role === 'admin' && user && previous && previous !== id) {
      supabase.from('audit_logs').insert({
        user_id: user.id,
        user_name: profile?.email || user.email || null,
        action: 'branch_switch',
        entity_type: 'branch',
        entity_id: id,
        branch_id: id,
        details: { previous_branch: previous, new_branch: id },
      }).then(({ error }) => {
        if (error) console.error('[branch] audit log error:', error);
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
    localStorage.removeItem(ACTIVE_BRANCH_KEY);
    setRole(null);
    setBranchId(null);
    setProfile(null);
    setAssignedBranches([]);
    setNeedsBranchSelection(false);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? new Error(error.message) : null };
  };

  return (
    <AuthContext.Provider value={{
      session, user, role, branchId, assignedBranches, profile, loading,
      signIn, signOut, resetPassword, setActiveBranch, needsBranchSelection,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
