import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { Badge } from '@/components/ui/badge';
import { Building2, WifiOff, Wifi, Check, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function AppLayout() {
  const { branchId, role, setActiveBranch } = useAuth();
  const { data: branches } = useBranches();
  const { isOnline, pendingCount, lastSync, syncing } = useOfflineSync();
  const qc = useQueryClient();
  const activeBranch = branches?.find(b => b.id === branchId);
  const isAdmin = role === 'admin';
  const cleanName = (n?: string) => (n || '').replace('SBJ Foods and Drinks ', '').trim() || n || 'Branch';

  const handleSwitchBranch = (newId: string, newName: string) => {
    if (newId === branchId) return;
    toast.info(`Switching to ${cleanName(newName)}...`);
    setActiveBranch(newId);
    // Refresh ALL data so every page reflects the newly active branch
    qc.invalidateQueries();
    setTimeout(() => toast.success(`Now viewing ${cleanName(newName)}`), 300);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-2" />
              <h1 className="text-lg font-semibold font-display text-foreground hidden sm:block">SBJ Foods & Drinks</h1>
              {isAdmin && branches && branches.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{activeBranch ? cleanName(activeBranch.name) : 'Select branch'}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Switch branch (admin)
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {branches.filter(b => b.is_active).map(b => (
                      <DropdownMenuItem
                        key={b.id}
                        onSelect={() => handleSwitchBranch(b.id, b.name)}
                        className="cursor-pointer"
                      >
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm">{cleanName(b.name)}</p>
                          {b.code && <p className="text-xs text-muted-foreground">{b.code}</p>}
                        </div>
                        {b.id === branchId && <Check className="h-4 w-4 text-primary ml-2" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : activeBranch && (
                <Badge variant="outline" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {cleanName(activeBranch.name)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <Badge variant="destructive" className="gap-1 animate-pulse text-xs">
                  <WifiOff className="h-3 w-3" />
                  Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
                </Badge>
              ) : syncing ? (
                <Badge variant="outline" className="gap-1 text-xs border-warning text-warning">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing{pendingCount > 0 ? ` ${pendingCount}` : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Wifi className="h-3 w-3 text-success" />
                  Online{lastSync ? ` · ${lastSync}` : ''}
                </Badge>
              )}
              {pendingCount > 0 && isOnline && !syncing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={() => {
                    qc.invalidateQueries();
                    toast.info('Triggering sync…');
                  }}
                  title="Sync now"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync
                </Button>
              )}
              <ThemeSwitcher />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
