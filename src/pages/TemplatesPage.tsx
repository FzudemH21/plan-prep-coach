import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, FileText, ArrowLeft, Target } from "lucide-react";

export default function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/")}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Templates & Library</h1>
          <p className="text-muted-foreground">Access training templates, exercise databases, and coaching resources</p>
        </div>
      </div>

      {/* Database Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/templates/athleticism")}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Athleticism Database</CardTitle>
                <CardDescription>Sprint ability training methods & loading</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Comprehensive reverse-engineered database mapping training qualities to specific methods with detailed loading recommendations.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-secondary px-2 py-1 rounded">Editable</span>
              <span className="text-xs text-muted-foreground">47 entries</span>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <CardTitle className="text-muted-foreground">Exercise Glossary</CardTitle>
                <CardDescription>Comprehensive exercise database</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Searchable database of exercises with detailed descriptions, variations, and coaching cues.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
              <span className="text-xs text-muted-foreground">500+ exercises</span>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-muted-foreground" />
              <div>
                <CardTitle className="text-muted-foreground">Program Templates</CardTitle>
                <CardDescription>Pre-built training programs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Ready-to-use training program templates for common goals and populations.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
              <span className="text-xs text-muted-foreground">12 templates</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}