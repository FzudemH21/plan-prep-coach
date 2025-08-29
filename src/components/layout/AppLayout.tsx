import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, FileText, Download, Settings } from "lucide-react";
import { DisplayMode } from "@/types/training";
import { useDisplayMode } from "@/contexts/DisplayModeContext";

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { displayMode, setDisplayMode } = useDisplayMode();
  const [showAIAgent, setShowAIAgent] = useState(false);

  const getModeColor = (mode: DisplayMode) => {
    switch (mode) {
      case "step-by-step":
        return "bg-blue-500 text-white";
      case "macro":
        return "bg-green-500 text-white";
      case "meso":
        return "bg-yellow-500 text-white";
      case "micro":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-primary">
              Training Programming System
            </h1>
            <Badge variant="outline" className="text-xs">
              v1.0
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            {/* Display Mode Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-muted-foreground">
                View Mode:
              </span>
              <Select value={displayMode} onValueChange={(value: DisplayMode) => setDisplayMode(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="step-by-step">Step-by-Step</SelectItem>
                  <SelectItem value="macro">Macro View</SelectItem>
                  <SelectItem value="meso">Meso View</SelectItem>
                  <SelectItem value="micro">Micro View</SelectItem>
                </SelectContent>
              </Select>
              <Badge className={getModeColor(displayMode)}>
                {displayMode.charAt(0).toUpperCase() + displayMode.slice(1)}
              </Badge>
            </div>

            {/* Action Buttons */}
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

              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-none">
          {children || <Outlet />}
        </main>
      </div>

      {/* Display Mode Context Banner */}
      <div className="fixed bottom-4 right-4">
        <Badge className={`${getModeColor(displayMode)} px-3 py-1`}>
          {displayMode === "step-by-step" && "🚶 Step-by-Step Mode"}
          {displayMode === "macro" && "🏗️ Macro Planning"}
          {displayMode === "meso" && "📅 Mesocycle Focus"}
          {displayMode === "micro" && "🔍 Microcycle Detail"}
        </Badge>
      </div>
    </div>
  );
}