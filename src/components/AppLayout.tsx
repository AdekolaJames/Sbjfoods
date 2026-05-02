import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';

export function AppLayout() {
  const { branchId, role } = useAuth();

  const { data } = useBranches();

  // SAFE normalization (THIS FIXES YOUR ERROR)
  const branches = Array.isArray(data) ? data : [];

const activeBranch = branchId
  ? branches.find(b => b?.id === branchId)
  : null;

// 👇 ADD THESE LINES
console.log("BRANCHES:", branches);
console.log("ACTIVE BRANCH:", activeBranch);
console.log("BRANCH ID:", branchId);
  const isAdmin = role === 'admin';

  const cleanName = (n?: string) =>
    (n || '').replace('SBJ Foods and Drinks ', '').trim() || n || 'Branch';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col overflow-hidden">

          <header className="h-14 flex items-center justify-between border-b px-4">

            <div className="flex items-center gap-3">
              <SidebarTrigger />

              <h1 className="text-lg font-semibold hidden sm:block">
                SBJ Foods & Drinks
              </h1>

              {activeBranch?.name && (
  <Badge variant="outline" className="gap-1">
    <Building2 className="h-3 w-3" />
    {cleanName(String(activeBranch.name))}
  </Badge>
)}
            </div>

            <ThemeSwitcher />
          </header>

          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
}