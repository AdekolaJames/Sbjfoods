import { useUserBranches } from '@/hooks/useBranchAssignments';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Loader2, LogOut } from 'lucide-react';

interface BranchSelectorProps {
  onSelect: (branchId: string) => void;
}

export function BranchSelector({ onSelect }: BranchSelectorProps) {
  const { user, role, signOut } = useAuth();
  const { data: assignments, isLoading: assignLoading } = useUserBranches(user?.id);
  const { data: allBranches, isLoading: branchesLoading } = useBranches();

  const isLoading = assignLoading || branchesLoading;

  // Admin sees all branches; staff sees only assigned. Resolve names via the branches table.
  const options = role === 'admin'
    ? (allBranches || []).filter(b => b.is_active).map(b => ({ branch_id: b.id, name: b.name, code: b.code }))
    : (assignments || []).map(a => {
        const branch = allBranches?.find(b => b.id === a.branch_id) || a.branches;
        return { branch_id: a.branch_id, name: branch?.name || a.branches?.name, code: branch?.code };
      }).filter(o => o.name); // hide invalid (deleted) branches

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-display">Choose Branch</CardTitle>
          <CardDescription>
            Select the branch you want to work in. To switch later, sign out and sign in again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map(o => (
            <Button
              key={o.branch_id}
              variant="outline"
              className="w-full h-14 text-left justify-start gap-3 text-base"
              onClick={() => onSelect(o.branch_id)}
            >
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{o.name}</p>
                {o.code && <p className="text-xs text-muted-foreground">{o.code}</p>}
              </div>
            </Button>
          ))}
          {options.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No branches assigned. Contact your administrator.
            </p>
          )}
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
