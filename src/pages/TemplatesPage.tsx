import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Database, FileText, ArrowLeft, Target, Wrench, Activity, Plus, Edit2, Trash2 } from "lucide-react";
import { AddLibraryDialog } from "@/components/templates/AddLibraryDialog";
import { EditLibraryDialog } from "@/components/templates/EditLibraryDialog";
import { useCustomLibraries, CustomLibrary } from "@/hooks/useCustomLibraries";
import { useToast } from "@/hooks/use-toast";

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [isAddLibraryDialogOpen, setIsAddLibraryDialogOpen] = useState(false);
  const [isEditLibraryDialogOpen, setIsEditLibraryDialogOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<CustomLibrary | null>(null);
  const { libraries, deleteLibrary, isLoading } = useCustomLibraries();
  const { toast } = useToast();

  const handleEditLibrary = (library: CustomLibrary) => {
    setEditingLibrary(library);
    setIsEditLibraryDialogOpen(true);
  };

  const handleDeleteLibrary = async (library: CustomLibrary) => {
    try {
      deleteLibrary(library.id);
      toast({
        title: "Success",
        description: `${library.name} has been deleted`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete library",
        variant: "destructive"
      });
    }
  };

  const getLibraryRoute = (library: CustomLibrary) => {
    return `/templates/library/${library.id}`;
  };

  const getLibraryIcon = (library: CustomLibrary) => {
    if (library.type === 'Resistance Training') return FileText;
    if (library.type === 'Plyometrics') return Activity;
    return FileText;
  };

  const getLibraryIconColor = (library: CustomLibrary) => {
    if (library.type === 'Plyometrics') return 'text-orange-600';
    return 'text-primary';
  };

  if (isLoading) {
    return <div className="w-full max-w-none space-y-8">Loading...</div>;
  }

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
            {libraries.map((library) => {
              const IconComponent = getLibraryIcon(library);
              const iconColor = getLibraryIconColor(library);
              
              return (
                <Card key={library.id} className="cursor-pointer hover:shadow-md transition-shadow group">
                  <CardHeader onClick={() => navigate(getLibraryRoute(library))}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <IconComponent className={`h-8 w-8 ${iconColor}`} />
                        <div>
                          <CardTitle>{library.name}</CardTitle>
                          <CardDescription>{library.type}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditLibrary(library);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Library</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{library.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteLibrary(library)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent onClick={() => navigate(getLibraryRoute(library))}>
                    <p className="text-sm text-muted-foreground mb-4">
                      {library.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-secondary px-2 py-1 rounded">Editable</span>
                      <span className="text-xs text-muted-foreground">{library.exercises.length} exercises</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

      <EditLibraryDialog
        isOpen={isEditLibraryDialogOpen}
        onClose={() => {
          setIsEditLibraryDialogOpen(false);
          setEditingLibrary(null);
        }}
        library={editingLibrary}
      />
    </div>
  );
}