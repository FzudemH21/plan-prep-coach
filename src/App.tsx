import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DisplayModeProvider } from "@/contexts/DisplayModeContext";
import { CustomLibrariesProvider } from "@/contexts/CustomLibrariesContext";
import { WizardDataProvider } from "@/contexts/WizardDataContext";
import { AthleteAppLayout } from "@/components/athlete-app/AthleteAppLayout";
import HomePage from "./pages/HomePage";
import MacrocyclePage from "./pages/MacrocyclePage";
import MesocyclePage from "./pages/MesocyclePage";
import MicrocyclePlanningPage from "./pages/MicrocyclePlanningPage";
import TemplatesPage from "./pages/TemplatesPage";
import TrainingProgramsPage from "./pages/TrainingProgramsPage";
import AthleticismDatabaseV2 from "./pages/AthleticismDatabaseV2";
import ToolboxDatabase from "./pages/ToolboxDatabase";
import LibraryPage from "./pages/LibraryPage";
import ExerciseLibrariesPage from "./pages/ExerciseLibrariesPage";
import ProgramTemplatesPage from "./pages/ProgramTemplatesPage";
import AthleteDatabase from "./pages/AthleteDatabase";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/OnboardingPage";
import CoachProfilePage from "./pages/CoachProfilePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AthleteLoginPage from "./pages/athlete/AthleteLoginPage";
import AthleteConnectPage from "./pages/athlete/AthleteConnectPage";
import AthleteTodayPage from "./pages/athlete/AthleteTodayPage";
import AthletePlanPage from "./pages/athlete/AthletePlanPage";
import AthleteMessagesPage from "./pages/athlete/AthleteMessagesPage";
import AthleteProfilePage from "./pages/athlete/AthleteProfilePage";
import { hasCoachProfile } from "./hooks/useCoachProfile";
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

/** Blocks access until a Supabase session exists; redirects to /login otherwise.
 *  Also redirects athletes away from the coach app. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  if (loading) return null; // wait for session hydration — avoids flash redirect
  if (!session) return <Navigate to="/login" replace />;
  // Athletes belong in the athlete app, not the coach app
  if (user?.user_metadata?.role === 'athlete') return <Navigate to="/athlete" replace />;
  return <>{children}</>;
}

/** Blocks athlete app routes until a Supabase session with role=athlete exists. */
function AthleteAuthGuard({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/athlete/login" replace />;
  if (user?.user_metadata?.role !== 'athlete') return <Navigate to="/" replace />;
  return <>{children}</>;
}

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
          <WizardDataProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Public + standalone routes live outside AppLayout and AuthGuard */}
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Athlete app — public routes (no auth required) */}
              <Route path="/athlete/login" element={<AthleteLoginPage />} />
              <Route path="/athlete/connect" element={<AthleteConnectPage />} />

              {/* Athlete app — protected shell with nested tabs */}
              <Route
                path="/athlete"
                element={
                  <AthleteAuthGuard>
                    <AthleteAppLayout />
                  </AthleteAuthGuard>
                }
              >
                <Route index element={<Navigate to="/athlete/today" replace />} />
                <Route path="today" element={<AthleteTodayPage />} />
                <Route path="plan" element={<AthletePlanPage />} />
                <Route path="messages" element={<AthleteMessagesPage />} />
                <Route path="profile" element={<AthleteProfilePage />} />
              </Route>

              <Route
                path="*"
                element={
                  <AuthGuard>
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
                        <Route path="/templates/exercise-libraries" element={<ExerciseLibrariesPage />} />
                        <Route path="/templates/program-templates" element={<ProgramTemplatesPage />} />
                        <Route path="/coach-profile" element={<CoachProfilePage />} />
                        <Route path="/analytics" element={<div className="text-center py-12">Analytics coming soon...</div>} />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </AuthGuard>
                }
              />
            </Routes>
          </BrowserRouter>
          </WizardDataProvider>
        </CustomLibrariesProvider>
      </DisplayModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
