import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const { saveCurrentSession } = useTrainingPrograms();
  
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
        description: "There was a problem saving your program. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
