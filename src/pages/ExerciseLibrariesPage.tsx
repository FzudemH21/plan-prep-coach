import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Activity, Plus, Edit2, Trash2 } from "lucide-react";
import { AddLibraryDialog } from "@/components/templates/AddLibraryDialog";
import { EditLibraryDialog } from "@/components/templates/EditLibraryDialog";
import { useCustomLibraries, CustomLibrary } from "@/hooks/useCustomLibraries";
import { useToast } from "@/hooks/use-toast";

export default function ExerciseLibrariesPage() {
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
      toast({ title: "Success", description: `Library "${library.name}" deleted successfully` });
    } catch {
      toast({ title: "Error", description: "Failed to delete library", variant: "destructive" });
    }
  };

  const getLibraryRoute = (library: CustomLibrary) => `/templates/libraries/${library.id}`;

  const getLibraryIcon = (library: CustomLibrary) => {
    if (library.type === 'Plyometrics') return Activity;
    return FileText;
  };

  const getLibraryIconColor = (library: CustomLibrary) => {
    if (library.type === 'Plyometrics') return 'text-orange-600';
    return 'text-primary';
  };

  if (isLoading) {
    return <div className="w-full max-w-none">Loading...</div>;
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Exercise Libraries</h1>
          <p className="text-muted-foreground">Manage your exercise libraries</p>
        </div>
        <Button onClick={() => setIsAddLibraryDialogOpen(true)} className="flex items-center space-x-2">
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
                      onClick={(e) => { e.stopPropagation(); handleEditLibrary(library); }}
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
                            onClick={(e) => { e.stopPropagation(); handleDeleteLibrary(library); }}
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
                <p className="text-sm text-muted-foreground mb-4">{library.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">Editable</span>
                  <span className="text-xs text-muted-foreground">{library.exercises.length} exercises</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {libraries.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            No exercise libraries yet. Click "Add Library" to create one.
          </div>
        )}
      </div>

      <AddLibraryDialog
        isOpen={isAddLibraryDialogOpen}
        onClose={() => setIsAddLibraryDialogOpen(false)}
      />

      <EditLibraryDialog
        isOpen={isEditLibraryDialogOpen}
        onClose={() => { setIsEditLibraryDialogOpen(false); setEditingLibrary(null); }}
        library={editingLibrary}
      />
    </div>
  );
}
