import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AccessDenied from "@/pages/AccessDenied";
import Dashboard from "@/pages/Dashboard";
import BranchDashboard from "@/pages/BranchDashboard";
import BranchesPage from "@/pages/BranchesPage";
import StaffPage from "@/pages/StaffPage";
import CategoriesPage from "@/pages/CategoriesPage";
import MenuPage from "@/pages/MenuPage";
import POSPage from "@/pages/POSPage";
import InventoryPage from "@/pages/InventoryPage";
import ReportsPage from "@/pages/ReportsPage";
import OrdersPage from "@/pages/OrdersPage";
import ReceiptsPage from "@/pages/ReceiptsPage";
import SettingsPage from "@/pages/SettingsPage";
import ShopPage from "@/pages/ShopPage";
import ExpensesPage from "@/pages/ExpensesPage";
import UnitsPage from "@/pages/UnitsPage";
import CustomersPage from "@/pages/CustomersPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="sbj-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/shop" element={<ShopPage />} />

              {/* Protected routes inside layout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'waiter']}><POSPage /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'waiter', 'branch_manager']}><OrdersPage /></ProtectedRoute>} />
                <Route path="/menu" element={<ProtectedRoute allowedRoles={['admin', 'branch_manager']}><MenuPage /></ProtectedRoute>} />
                <Route path="/categories" element={<ProtectedRoute allowedRoles={['admin', 'branch_manager']}><CategoriesPage /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute allowedRoles={['admin', 'branch_manager']}><InventoryPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'branch_manager']}><ReportsPage /></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute allowedRoles={['admin']}><StaffPage /></ProtectedRoute>} />
                <Route path="/branches" element={<ProtectedRoute allowedRoles={['admin']}><BranchesPage /></ProtectedRoute>} />
                <Route path="/branch-dashboard" element={<ProtectedRoute allowedRoles={['admin', 'branch_manager']}><BranchDashboard /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
                <Route path="/receipts" element={<ProtectedRoute allowedRoles={['admin', 'cashier']}><ReceiptsPage /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute allowedRoles={['admin', 'branch_manager']}><ExpensesPage /></ProtectedRoute>} />
                <Route path="/units" element={<ProtectedRoute allowedRoles={['admin']}><UnitsPage /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute allowedRoles={['admin']}><CustomersPage /></ProtectedRoute>} />
              </Route>

              {/* Redirects and fallback */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
