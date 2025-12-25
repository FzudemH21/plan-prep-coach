import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DisplayModeProvider } from "@/contexts/DisplayModeContext";
import { CustomLibrariesProvider } from "@/contexts/CustomLibrariesContext";
import HomePage from "./pages/HomePage";
import MacrocyclePage from "./pages/MacrocyclePage";
import MesocyclePage from "./pages/MesocyclePage";
import MicrocyclePlanningPage from "./pages/MicrocyclePlanningPage";
import TemplatesPage from "./pages/TemplatesPage";
import AthleticismDatabase from "./pages/AthleticismDatabase";
import AthleticismDatabaseV2 from "./pages/AthleticismDatabaseV2";
import ToolboxDatabase from "./pages/ToolboxDatabase";
import ExerciseLibrary from "./pages/ExerciseLibrary";
import PlyometricsLibrary from "./pages/PlyometricsLibrary";
import LibraryPage from "./pages/LibraryPage";
import AthleteDatabase from "./pages/AthleteDatabase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DisplayModeProvider>
        <CustomLibrariesProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/macrocycle" element={<MacrocyclePage />} />
              <Route path="/mesocycle" element={<MesocyclePage />} />
              <Route path="/microcycle" element={<MicrocyclePlanningPage />} />
              <Route path="/athletes" element={<AthleteDatabase />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/templates/athleticism" element={<AthleticismDatabase />} />
              <Route path="/templates/athleticism-v2" element={<AthleticismDatabaseV2 />} />
              <Route path="/templates/toolbox" element={<ToolboxDatabase />} />
              
              <Route path="/templates/libraries/resistancetraining" element={<ExerciseLibrary />} />
              <Route path="/templates/libraries/plyometrics" element={<PlyometricsLibrary />} />
              <Route path="/templates/libraries/:libraryName" element={<LibraryPage />} />
              <Route path="/analytics" element={<div className="text-center py-12">Analytics coming soon...</div>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
          </BrowserRouter>
        </CustomLibrariesProvider>
      </DisplayModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
