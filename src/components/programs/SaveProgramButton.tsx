import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useToast } from "@/hooks/use-toast";
import { ProgramOpenElsewhereError } from "@/lib/wizardTabProgram";
import { usePlannerProgram } from "@/hooks/useProgramAccess";

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
  const { saveCurrentSession } = useTrainingPrograms();
  // Another coach's program, opened to look at: nothing to save (the planner shows a banner)
  const { readOnly } = usePlannerProgram();

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSaveClick = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      // saveCurrentSession() automatically uses plan name from macrocycleData
      // and handles new vs update based on activeProgramId
      const saved = await saveCurrentSession();

      toast({
        title: "Program saved",
        description: `"${saved.name}" has been saved successfully.`,
      });
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      toast({
        title: "Error saving program",
        description: error instanceof ProgramOpenElsewhereError ? error.message : "There was a problem saving your program. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (readOnly) return null;

  return (
    <Button
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleSaveClick}
      disabled={isSaving}
    >
      {showSuccess ? (
        <>
          <Check className="h-4 w-4 mr-2 text-green-500" />
          {showLabel && "Saved"}
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          {showLabel && (isSaving ? "Saving..." : "Save Program")}
        </>
      )}
    </Button>
  );
}
