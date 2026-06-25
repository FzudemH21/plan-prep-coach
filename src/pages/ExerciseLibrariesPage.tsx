import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Activity, Plus, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import { AddLibraryDialog } from "@/components/templates/AddLibraryDialog";
import { EditLibraryDialog } from "@/components/templates/EditLibraryDialog";
import { useCustomLibraries, CustomLibrary } from "@/hooks/useCustomLibraries";
import { useToast } from "@/hooks/use-toast";

export default function ExerciseLibrariesPage() {
  const navigate = useNavigate();
  const [isAddLibraryDialogOpen, setIsAddLibraryDialogOpen] = useState(false);
  const [isEditLibraryDialogOpen, setIsEditLibraryDialogOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<CustomLibrary | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [libraryToDelete, setLibraryToDelete] = useState<CustomLibrary | null>(null);
  const { libraries, deleteLibrary, isLoading } = useCustomLibraries();
  const { toast } = useToast();

  const handleEditLibrary = (library: CustomLibrary) => {
    setEditingLibrary(library);
    setIsEditLibraryDialogOpen(true);
  };

  const handleDeleteClick = (library: CustomLibrary) => {
    setLibraryToDelete(library);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (libraryToDelete) {
      try {
        deleteLibrary(libraryToDelete.id);
        toast({ title: "Library deleted", description: `"${libraryToDelete.name}" has been removed.` });
      } catch {
        toast({ title: "Error", description: "Failed to delete library", variant: "destructive" });
      }
      setLibraryToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const getLibraryRoute = (library: CustomLibrary) => `/templates/libraries/${library.id}`;

  const getLibraryIcon = (library: CustomLibrary) => {
    if (library.type === 'Plyometrics') return Activity;
    return FileText;
  };

  if (isLoading) {
    return <div className="w-full max-w-none p-6 text-muted-foreground">Loading exercise libraries...</div>;
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exercise Libraries</h1>
          <p className="text-muted-foreground">Manage your exercise libraries</p>
        </div>
        <Button onClick={() => setIsAddLibraryDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Library
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {libraries.length} librar{libraries.length !== 1 ? 'ies' : 'y'}
      </div>

      {libraries.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Library Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Exercises</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {libraries.map((library) => {
                const IconComponent = getLibraryIcon(library);
                return (
                  <TableRow
                    key={library.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(getLibraryRoute(library))}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        {library.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{library.type}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px]">
                      <span className="truncate block">{library.description || "—"}</span>
                    </TableCell>
                    <TableCell>{library.exercises.length}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditLibrary(library); }}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(library); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No exercise libraries yet</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first exercise library</p>
            <Button onClick={() => setIsAddLibraryDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Library
            </Button>
          </CardContent>
        </Card>
      )}

      <AddLibraryDialog
        isOpen={isAddLibraryDialogOpen}
        onClose={() => setIsAddLibraryDialogOpen(false)}
      />

      <EditLibraryDialog
        isOpen={isEditLibraryDialogOpen}
        onClose={() => { setIsEditLibraryDialogOpen(false); setEditingLibrary(null); }}
        library={editingLibrary}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Library</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{libraryToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
