import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CashierDashboard from "./pages/CashierDashboard";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProgramsDashboard from "./pages/ProgramsDashboard";
import NotFound from "./pages/NotFound";
import { canAccessRoute, getAuthUser } from "./lib/auth";
import type { UserRole } from "./types/pos.types";
import { GlobalNotifications } from "./components/notifications/GlobalNotifications";

const queryClient = new QueryClient();

const roleRoute: Record<UserRole, string> = {
  cashier: "/cashier",
  supervisor: "/supervisor",
  admin: "/admin",
};

const ProtectedRoute = ({
  requiredRole,
  element,
}: {
  requiredRole: UserRole;
  element: JSX.Element;
}) => {
  const user = getAuthUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessRoute(user.role, requiredRole)) {
    return <Navigate to={roleRoute[user.role]} replace />;
  }
  return element;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GlobalNotifications />
        <Routes>
          {/* Redirigir raíz a login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Autenticación */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Dashboards por rol */}
          <Route
            path="/cashier"
            element={<ProtectedRoute requiredRole="cashier" element={<CashierDashboard />} />}
          />
          <Route
            path="/supervisor"
            element={<ProtectedRoute requiredRole="supervisor" element={<SupervisorDashboard />} />}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute requiredRole="admin" element={<AdminDashboard />} />}
          />
          <Route
            path="/programs"
            element={<ProtectedRoute requiredRole="cashier" element={<ProgramsDashboard />} />}
          />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
