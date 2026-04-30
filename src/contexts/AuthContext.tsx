import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types
type User = any;

type Branch = {
  id: string;
  name: string;
  [key: string]: any;
} | null;

type AuthContextType = {
  user: User | null;
  loading: boolean;
  branch: Branch;
  branchId: string | null;
  branches: any[];
  role: string | null;
  setBranch: (branch: Branch) => void;
  setBranchId: (id: string | null) => void;

  // ✅ ADD THIS LINE
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signOut = async () => {
  await supabase.auth.signOut();
  setUser(null);
};

  const [branch, setBranch] = useState<Branch>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
};

  useEffect(() => {
  const getUserAndBranch = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    setUser(user);

    if (user) {
      // ✅ FETCH ROLE (FIXED)
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Role fetch error:", error);
      }

      setRole(data?.role || "admin");

      // ✅ FETCH BRANCHES
      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("*");

      if (branchError) {
        console.error("Error fetching branches:", branchError);
      } else if (branchData && branchData.length > 0) {
        setBranches(branchData);
        setBranch(branchData[0]);
        setBranchId(branchData[0].id);
      }
    }

    setLoading(false);
  };

  getUserAndBranch();

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user ?? null);
    }
  );

  return () => {
    authListener.subscription.unsubscribe();
  };
}, []);

  const value: AuthContextType = {
    user,
    loading,
    branch,
    branchId,
    branches,
    role,
    setBranch,
    setBranchId,
    signIn,
    signOut,
  };

  console.log("AUTH CONTEXT FULL:", value);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};