import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types
type User = any;

type Branch = {
  id: string;
  name: string;
  is_active?: boolean;
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

  const [branch, setBranch] = useState<Branch>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setBranch(null);
    setBranchId(null);
  };

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      // ROLE
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      setRole(roleData?.role ?? "admin");

      // BRANCHES
const { data: branchData, error } = await supabase
  .from("branches")
  .select("*");

if (error) {
  console.error("Branch fetch error:", error);
  setBranches([]);
  setBranch(null);
  setBranchId(null);
} else if (Array.isArray(branchData) && branchData.length > 0) {

  const savedBranchId = localStorage.getItem("branchId");

  const selectedBranch =
    branchData.find((b) => b.id === savedBranchId) ||
    branchData[0];

  setBranches(branchData);
  setBranch(selectedBranch);
  setBranchId(selectedBranch?.id || null);

  if (selectedBranch?.id) {
    localStorage.setItem("branchId", selectedBranch.id);
  }

} else {
  setBranches([]);
  setBranch(null);
  setBranchId(null);
}
      setLoading(false);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
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

  // DEBUG (safe)
  console.log("AUTH DEBUG →", {
    user,
    branch,
    branchId,
    branches,
    role,
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};