import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Users, 
  Calendar, 
  BarChart3, 
  Plus, 
  FileText,
  Clock
} from "lucide-react";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useAthletes } from "@/hooks/useAthletes";
import { getAthleteDisplayName } from "@/types/athlete";
import { formatDistanceToNow } from "date-fns";
import { useWizardData } from "@/contexts/WizardDataContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getRecentPrograms, loadProgramIntoSession } = useTrainingPrograms();
  const { athletes } = useAthletes();
  const { loadWizardSession } = useWizardData();

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
    loadWizardSession();
    navigate('/macrocycle');
  };

  return (
    <div className="w-full max-w-none space-y-8">
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          {t('home.title')}
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          {t('home.tagline')}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/athletes")}>
          <CardHeader className="text-center pb-4">
            <Users className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">{t('home.quickActions.athletes.title')}</CardTitle>
            <CardDescription>{t('home.quickActions.athletes.desc')}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/templates/programs")}>
          <CardHeader className="text-center pb-4">
            <FileText className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">{t('home.quickActions.programs.title')}</CardTitle>
            <CardDescription>{t('home.quickActions.programs.desc')}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/analytics")}>
          <CardHeader className="text-center pb-4">
            <BarChart3 className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-lg">{t('home.quickActions.analytics.title')}</CardTitle>
            <CardDescription>{t('home.quickActions.analytics.desc')}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Training Plans */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t('home.recentPlans.title')}</h2>
          <Button variant="outline" onClick={() => navigate("/templates/programs")}>
            {t('home.recentPlans.viewAll')}
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
                        <span>{t('common.weeks', { count: program.duration.weeks })}</span>
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
              <h3 className="text-lg font-semibold mb-2">{t('home.recentPlans.empty.title')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('home.recentPlans.empty.desc')}
              </p>
              <Button onClick={() => navigate("/templates/programs")}>
                <Plus className="h-4 w-4 mr-2" />
                {t('home.recentPlans.empty.cta')}
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
              <span>{t('home.features.evidenceBased.title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('home.features.evidenceBased.desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>{t('home.features.periodization.title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('home.features.periodization.desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>{t('home.features.export.title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('home.features.export.desc')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
