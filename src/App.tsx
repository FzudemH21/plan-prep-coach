import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DisplayModeProvider } from "@/contexts/DisplayModeContext";
import HomePage from "./pages/HomePage";
import MacrocyclePage from "./pages/MacrocyclePage";
import MesocyclePage from "./pages/MesocyclePage";
import TemplatesPage from "./pages/TemplatesPage";
import AthleticismDatabase from "./pages/AthleticismDatabase";
import ToolboxDatabase from "./pages/ToolboxDatabase";
import ExerciseLibrary from "./pages/ExerciseLibrary";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DisplayModeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/macrocycle" element={<MacrocyclePage />} />
              <Route path="/mesocycle" element={<MesocyclePage />} />
              <Route path="/microcycle" element={<div className="text-center py-12">Microcycle page coming soon...</div>} />
              <Route path="/clients" element={<div className="text-center py-12">Client database coming soon...</div>} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/templates/athleticism" element={<AthleticismDatabase />} />
              <Route path="/templates/toolbox" element={<ToolboxDatabase />} />
              <Route path="/templates/exercises" element={<ExerciseLibrary />} />
              <Route path="/analytics" element={<div className="text-center py-12">Analytics coming soon...</div>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </DisplayModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
