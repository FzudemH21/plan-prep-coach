import { useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Menu, FlaskConical, Trash2, Bell, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadSeedData, loadDemoPlan2026, loadStrengthPlan, loadExerciseLibrarySeedData } from "@/utils/seedData";
import { clearAllAppCache } from "@/utils/clearCache";
import { NavigationSidebar } from "./NavigationSidebar";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useCustomLibraries } from "@/contexts/CustomLibrariesContext";
import type { CustomLibrary } from "@/contexts/CustomLibrariesContext";
import type { TrainingProgram } from "@/hooks/useTrainingPrograms";
import { useAthleteConnections } from "@/hooks/useAthleteConnections";
import { useUnreadCounts } from "@/hooks/useChat";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useCoachProfile } from "@/hooks/useCoachProfile";

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mergeSeedPrograms } = useTrainingPrograms();
  const { mergeSeedLibraries } = useCustomLibraries();

  const { connections } = useAthleteConnections();
  const connectionIds = useMemo(() => connections.map((c) => c.id), [connections]);
  const { totalUnread } = useUnreadCounts(connectionIds, 'coach');
  const { profile } = useCoachProfile();
  const brandingName = profile?.branding?.businessName?.trim() || "";
  const brandingLogo = profile?.branding?.logoBase64 || "";

  const handleLoadSeedData = async () => {
    try {
      const p1 = loadSeedData() as TrainingProgram;
      const p2 = loadDemoPlan2026() as TrainingProgram;
      const p3 = loadStrengthPlan() as TrainingProgram;
      const libs = loadExerciseLibrarySeedData() as CustomLibrary[];

      await mergeSeedPrograms([p1, p2, p3].filter(Boolean) as Array<{ id: string; [key: string]: unknown }>);
      mergeSeedLibraries(libs);

      toast({ title: "Demo-Daten geladen", description: "Sprint Performance Demo + Demo Plan 2026 + Strength Development 12-Week Plan + Exercise Library wurden geladen." });
    } catch (err) {
      console.error('[Demo-Daten laden] Fehler:', err);
      toast({
        title: "Fehler beim Laden",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleClearData = () => {
    clearAllAppCache();
    toast({ title: "Daten gelöscht", description: "Alle App-Daten wurden aus dem Cache entfernt." });
    navigate('/');
  };

  return (
    <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNavOpen(true)}
              className="h-9 w-9 p-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              {brandingLogo && (
                <img
                  src={brandingLogo}
                  alt="Logo"
                  className="h-8 w-auto max-w-[120px] object-contain"
                />
              )}
              <h1 className="text-2xl font-bold text-primary">
                {brandingName || "Plan Prep Coach"}
              </h1>
            </div>
            <Badge variant="outline" className="text-xs">
              v1.0
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
              {/* Notification bell */}
              <Button
                variant="outline"
                size="sm"
                className="relative h-9 w-9 p-0"
                onClick={() => navigate('/messages')}
                aria-label="Messages"
              >
                <MessageCircle className="h-4 w-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLoadSeedData}>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Demo-Plan laden
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleClearData} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Alle Daten löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 max-w-none min-w-0">
          {children || <Outlet />}
        </main>
      </div>

      {/* Navigation Sidebar */}
      <NavigationSidebar open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}