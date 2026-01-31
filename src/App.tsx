import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CashierDashboard from "./pages/CashierDashboard";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirigir raíz a login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Autenticación */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Dashboards por rol */}
          <Route path="/cashier" element={<CashierDashboard />} />
          <Route path="/supervisor" element={<SupervisorDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
