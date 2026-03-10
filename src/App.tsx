import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Venue from "./pages/Venue";
import Availability from "./pages/Availability";
import Bookings from "./pages/Bookings";
import Payments from "./pages/Payments";
import Membership from "./pages/Membership";
import PlayerProfile from "./pages/PlayerProfile";
import SettingsPage from "./pages/SettingsPage";
import CourtManagement from "./pages/CourtManagement";
import NotFound from "./pages/NotFound";
import VenueOnboarding from "./pages/VenueOnboarding";
import VenueOnboardingSuccess from "./pages/VenueOnboardingSuccess";
import { AuthProvider } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><VenueOnboarding /></ProtectedRoute>} />
            <Route path="/onboarding/success" element={<ProtectedRoute><VenueOnboardingSuccess /></ProtectedRoute>} />
            <Route path="/venue" element={<ProtectedRoute><Venue /></ProtectedRoute>} />
            <Route path="/availability" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/membership" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
            <Route path="/membership/:playerId" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/court-management" element={<ProtectedRoute><CourtManagement /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
