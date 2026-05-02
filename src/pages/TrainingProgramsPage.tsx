import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { 
  Plus, 
  Search, 
  ArrowLeft, 
  MoreHorizontal, 
  Edit, 
  Copy, 
  Trash2,
  Calendar,
  User,
  Target
} from "lucide-react";
import { useTrainingPrograms, TrainingProgram } from "@/hooks/useTrainingPrograms";
import { getAthleteDisplayName } from "@/types/athlete";
import { useAthletes } from "@/hooks/useAthletes";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

export default function TrainingProgramsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { programs, isLoading, copyProgram, deleteProgram, loadProgramIntoSession, clearSession } = useTrainingPrograms();
  const { athletes } = useAthletes();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<TrainingProgram | null>(null);

  // Get athlete name by ID
  const getAthleteName = (athleteId: string | null): string => {
    if (!athleteId) return "—";
    const athlete = athletes.find(a => a.id === athleteId);
    return athlete ? getAthleteDisplayName(athlete) : "Unknown Athlete";
  };

  // Filter programs by search query
  const filteredPrograms = programs.filter(program => {
    const query = searchQuery.toLowerCase();
    const athleteName = getAthleteName(program.athleteId).toLowerCase();
    return (
      program.name.toLowerCase().includes(query) ||
      athleteName.includes(query) ||
      program.primaryGoal.toLowerCase().includes(query)
    );
  });

  // Sort by last modified (most recent first)
  const sortedPrograms = [...filteredPrograms].sort((a, b) => 
    new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
  );

  const getStatusBadgeVariant = (status: TrainingProgram['status']) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: TrainingProgram['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white';
      case 'completed': return 'bg-blue-500 text-white';
      case 'archived': return 'bg-gray-500 text-white';
      default: return 'bg-yellow-500 text-white';
    }
  };

  const handleCreateNew = () => {
    clearSession();
    navigate('/macrocycle');
  };

  const handleEditProgram = (program: TrainingProgram) => {
    loadProgramIntoSession(program.id);
    navigate('/macrocycle');
  };

  const handleCopyProgram = async (program: TrainingProgram) => {
    const copied = await copyProgram(program.id);
    if (copied) {
      toast({
        title: "Program copied",
        description: `"${copied.name}" has been created.`,
      });
    }
  };

  const handleDeleteClick = (program: TrainingProgram) => {
    setProgramToDelete(program);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (programToDelete) {
      deleteProgram(programToDelete.id);
      toast({
        title: "Program deleted",
        description: `"${programToDelete.name}" has been removed.`,
      });
      setProgramToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

const formatDuration = (program: TrainingProgram) => {
    const weeks = program.duration.weeks || 0;
    
    // Calculate total days from dates if available
    let totalDays = 0;
    if (program.duration.startDate && program.duration.endDate) {
      try {
        const start = new Date(program.duration.startDate);
        const end = new Date(program.duration.endDate);
        totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } catch {
        totalDays = weeks * 7;
      }
    } else {
      totalDays = weeks * 7;
    }
    
    if (weeks === 0 && totalDays === 0) return "—";
    
    return `${weeks} week${weeks !== 1 ? 's' : ''} (${totalDays} days)`;
  };

  const formatLastModified = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "—";
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-none p-6">
        <div className="text-center py-12 text-muted-foreground">
          Loading training programs...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Training Programs</h1>
            <p className="text-muted-foreground">Manage your saved training plans</p>
          </div>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Program
        </Button>
      </div>

      {/* Search and Stats */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {sortedPrograms.length} program{sortedPrograms.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Programs Table */}
      {sortedPrograms.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Program Name</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPrograms.map((program) => (
                <TableRow 
                  key={program.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleEditProgram(program)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {program.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {getAthleteName(program.athleteId)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{program.primaryGoal || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(program)}</TableCell>
                  <TableCell>{formatLastModified(program.lastModifiedAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditProgram(program); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyProgram(program); }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(program); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No programs found" : "No training programs yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? "Try adjusting your search query"
                : "Get started by creating your first training program"
              }
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Program
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{programToDelete?.name}"? This action cannot be undone.
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
