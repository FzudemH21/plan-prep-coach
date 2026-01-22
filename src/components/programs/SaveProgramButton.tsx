import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Check } from "lucide-react";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useToast } from "@/hooks/use-toast";

interface SaveProgramButtonProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function SaveProgramButton({ 
  variant = "outline", 
  size = "sm",
  className = "",
  showLabel = true 
}: SaveProgramButtonProps) {
  const { toast } = useToast();
  const { saveCurrentSession, collectSessionData } = useTrainingPrograms();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [programName, setProgramName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSaveClick = () => {
    const sessionData = collectSessionData();
    const defaultName = sessionData.name || "Untitled Program";
    setProgramName(defaultName);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const saved = saveCurrentSession({ name: programName.trim() || "Untitled Program" });
      
      toast({
        title: "Program saved",
        description: `"${saved.name}" has been saved successfully.`,
      });
      
      setDialogOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      toast({
        title: "Error saving program",
        description: "There was a problem saving your program. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button 
        variant={variant} 
        size={size} 
        className={className}
        onClick={handleSaveClick}
      >
        {showSuccess ? (
          <>
            <Check className="h-4 w-4 mr-2 text-green-500" />
            {showLabel && "Saved"}
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            {showLabel && "Save Program"}
          </>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Training Program</DialogTitle>
            <DialogDescription>
              Save your current training plan to the program library for future access.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="programName">Program Name</Label>
              <Input
                id="programName"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="Enter program name"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
