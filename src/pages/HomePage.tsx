import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Users, 
  Calendar, 
  BarChart3, 
  Plus, 
  FileText,
  Clock,
  TrendingUp
} from "lucide-react";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useAthletes } from "@/hooks/useAthletes";
import { getAthleteDisplayName } from "@/types/athlete";
import { formatDistanceToNow } from "date-fns";

export default function HomePage() {
  const navigate = useNavigate();
  const { getRecentPrograms, loadProgramIntoSession, clearSession } = useTrainingPrograms();
  const { athletes } = useAthletes();
  
  const recentPrograms = getRecentPrograms(6);

  const getAthleteName = (athleteId: string | null): string => {
    if (!athleteId) return "Unassigned";
    const athlete = athletes.find(a => a.id === athleteId);
    return athlete ? getAthleteDisplayName(athlete) : "Unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500 text-white";
      case "completed": return "bg-blue-500 text-white";
      case "archived": return "bg-gray-500 text-white";
      default: return "bg-yellow-500 text-white";
    }
  };

  const handleProgramClick = (programId: string) => {
    loadProgramIntoSession(programId);
    navigate('/macrocycle');
  };

  const handleCreateNew = () => {
    clearSession();
    navigate('/macrocycle');
  };

  return (
    <div className="w-full max-w-none space-y-8">
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Training Programming System
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Evidence-informed training program design with AI guidance. 
          Create comprehensive periodized programs from goal setting to session planning.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleCreateNew}>
          <CardHeader className="text-center pb-4">
            <Target className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">New Training Plan</CardTitle>
            <CardDescription>Start with goal setting and athlete info</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/athletes")}>
          <CardHeader className="text-center pb-4">
            <Users className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">Athlete Database</CardTitle>
            <CardDescription>Manage athlete profiles and history</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/templates")}>
          <CardHeader className="text-center pb-4">
            <FileText className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">Templates & Library</CardTitle>
            <CardDescription>Access exercise glossaries and templates</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/analytics")}>
          <CardHeader className="text-center pb-4">
            <BarChart3 className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">Analytics</CardTitle>
            <CardDescription>Track progress and outcomes</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Training Plans */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Recent Training Plans</h2>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Plan
          </Button>
        </div>

        {recentPrograms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentPrograms.map((program) => (
              <Card 
                key={program.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleProgramClick(program.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      <CardDescription>{getAthleteName(program.athleteId)}</CardDescription>
                    </div>
                    <Badge className={getStatusColor(program.status)}>
                      {program.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {program.primaryGoal && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {program.primaryGoal}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDistanceToNow(new Date(program.lastModifiedAt), { addSuffix: true })}</span>
                    </div>
                    {program.duration.weeks > 0 && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{program.duration.weeks} weeks</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No training plans yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first training program
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Plan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* System Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <span>Evidence-Informed</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              AI-powered suggestions based on current strength & conditioning research 
              and best practices for optimal training outcomes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Complete Periodization</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              From macro-level planning to individual session design. 
              Manage mesocycles, microcycles, and daily training with precision.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Export & Share</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Export training plans to PDF or Excel at any level of detail. 
              Share macro overviews or detailed session plans.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}