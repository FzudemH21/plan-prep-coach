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
import { Bot, FileText, Settings, Menu, FlaskConical, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadSeedData, loadDemoPlan2026, loadExerciseLibrarySeedData } from "@/utils/seedData";
import { clearAllAppCache } from "@/utils/clearCache";
import { NavigationSidebar } from "./NavigationSidebar";

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLoadSeedData = () => {
    loadSeedData();
    loadDemoPlan2026();
    loadExerciseLibrarySeedData();
    toast({ title: "Demo-Daten geladen", description: "Sprint Performance Demo + Demo Plan 2026 + Exercise Library wurden geladen." });
  };

  const handleClearData = () => {
    clearAllAppCache();
    toast({ title: "Daten gelöscht", description: "Alle App-Daten wurden aus dem Cache entfernt." });
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden">
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
            <h1 className="text-2xl font-bold text-primary">
              Training Programming System
            </h1>
            <Badge variant="outline" className="text-xs">
              v1.0
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
              <Button
                variant={showAIAgent ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAIAgent(!showAIAgent)}
              >
                <Bot className="h-4 w-4 mr-2" />
                AI Agent
              </Button>
              
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export
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
      <div className="flex">
        {/* AI Agent Sidebar */}
        {showAIAgent && (
          <aside className="w-80 border-r bg-card p-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">S&C AI Agent</h3>
              </div>
              <div className="text-sm text-muted-foreground">
                I'm here to help you make evidence-informed decisions about your training programming.
                Ask me about goal setting, exercise selection, periodization, or any other strength & conditioning topic.
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Quick suggestions:</p>
                <div className="space-y-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    Help me set appropriate sub-goals
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    Suggest training methods for sprint speed
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    Review my periodization plan
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-none min-w-0">
          {children || <Outlet />}
        </main>
      </div>

      {/* Navigation Sidebar */}
      <NavigationSidebar open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}