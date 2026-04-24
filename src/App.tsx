import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DisplayModeProvider } from "@/contexts/DisplayModeContext";
import { CustomLibrariesProvider } from "@/contexts/CustomLibrariesContext";
import HomePage from "./pages/HomePage";
import MacrocyclePage from "./pages/MacrocyclePage";
import MesocyclePage from "./pages/MesocyclePage";
import MicrocyclePlanningPage from "./pages/MicrocyclePlanningPage";
import TemplatesPage from "./pages/TemplatesPage";
import TrainingProgramsPage from "./pages/TrainingProgramsPage";
import AthleticismDatabaseV2 from "./pages/AthleticismDatabaseV2";
import ToolboxDatabase from "./pages/ToolboxDatabase";
import LibraryPage from "./pages/LibraryPage";
import AthleteDatabase from "./pages/AthleteDatabase";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/OnboardingPage";
import CoachProfilePage from "./pages/CoachProfilePage";
import { hasCoachProfile } from "./hooks/useCoachProfile";

const queryClient = new QueryClient();

/** Redirects to /onboarding if no coach profile exists yet */
function HomeGuard() {
  if (!hasCoachProfile()) {
    return <Navigate to="/onboarding" replace />;
  }
  return <HomePage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DisplayModeProvider>
        <CustomLibrariesProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Onboarding lives outside AppLayout – full-page, standalone */}
            <Routes>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route
                path="*"
                element={
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<HomeGuard />} />
                      <Route path="/macrocycle" element={<MacrocyclePage />} />
                      <Route path="/mesocycle" element={<MesocyclePage />} />
                      <Route path="/microcycle" element={<MicrocyclePlanningPage />} />
                      <Route path="/athletes" element={<AthleteDatabase />} />
                      <Route path="/templates" element={<TemplatesPage />} />
                      <Route path="/templates/programs" element={<TrainingProgramsPage />} />
                      <Route path="/templates/athleticism" element={<AthleticismDatabaseV2 />} />
                      <Route path="/templates/athleticism-v2" element={<Navigate to="/templates/athleticism" replace />} />
                      <Route path="/templates/toolbox" element={<ToolboxDatabase />} />
                      <Route path="/templates/libraries/:libraryName" element={<LibraryPage />} />
                      <Route path="/coach-profile" element={<CoachProfilePage />} />
                      <Route path="/analytics" element={<div className="text-center py-12">Analytics coming soon...</div>} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </CustomLibrariesProvider>
      </DisplayModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
