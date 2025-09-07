import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, FileText, ArrowLeft, Target, Wrench, Activity, Plus } from "lucide-react";
import { AddLibraryDialog } from "@/components/templates/AddLibraryDialog";

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [isAddLibraryDialogOpen, setIsAddLibraryDialogOpen] = useState(false);

  return (
    <div className="w-full max-w-none space-y-8">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
              <span className="text-xs text-muted-foreground">63 entries</span>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/templates/toolbox")}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Wrench className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Training Toolbox</CardTitle>
                <CardDescription>All training method parameters</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Complete database of training method parameters with predefined options for systematic program design.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-secondary px-2 py-1 rounded">Editable</span>
              <span className="text-xs text-muted-foreground">300+ parameters</span>
            </div>
          </CardContent>
        </Card>

        {/* Exercise Libraries Section */}
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Exercise Libraries</span>
            </h2>
            <Button
              onClick={() => setIsAddLibraryDialogOpen(true)}
              size="sm"
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Library</span>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/templates/exercises")}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>Resistance Exercise Library</CardTitle>
                    <CardDescription>Resistance training exercise database</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Excel-like editable database with German exercise names, movement patterns, and detailed variations.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">Editable</span>
                  <span className="text-xs text-muted-foreground">1007 exercises</span>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/templates/plyometrics")}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Activity className="h-8 w-8 text-orange-600" />
                  <div>
                    <CardTitle>Plyometrics Library</CardTitle>
                    <CardDescription>Explosive power training database</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Comprehensive database of plyometric exercises with intensity levels, tiers, and movement patterns for explosive power development.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">Editable</span>
                  <span className="text-xs text-muted-foreground">150+ exercises</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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

      <AddLibraryDialog
        isOpen={isAddLibraryDialogOpen}
        onClose={() => setIsAddLibraryDialogOpen(false)}
      />
    </div>
  );
}