import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface PlanningStep {
  id: number;
  label: string;
  page: 'macrocycle' | 'mesocycle' | 'microcycle';
  pageStep: number;
}

const PLANNING_STEPS: PlanningStep[] = [
  { id: 1, label: "Athlete Information", page: "macrocycle", pageStep: 1 },
  { id: 2, label: "SMART Goal", page: "macrocycle", pageStep: 2 },
  { id: 3, label: "Sub-goals & Events", page: "macrocycle", pageStep: 3 },
  { id: 4, label: "Trainable Qualities", page: "macrocycle", pageStep: 4 },
  { id: 5, label: "Training Methods", page: "macrocycle", pageStep: 5 },
  { id: 6, label: "Mesocycle Setup", page: "mesocycle", pageStep: 1 },
  { id: 7, label: "Intensity Configuration", page: "mesocycle", pageStep: 2 },
  { id: 8, label: "Daily Intensity Planning", page: "mesocycle", pageStep: 3 },
  { id: 9, label: "Sub-Goal Allocation", page: "mesocycle", pageStep: 4 },
  { id: 10, label: "Method Periodization", page: "mesocycle", pageStep: 5 },
  { id: 11, label: "Exercise Selection", page: "mesocycle", pageStep: 6 },
  { id: 12, label: "Exercise Distribution", page: "microcycle", pageStep: 1 },
];

interface PlanningNavigationMenuProps {
  currentPage: 'macrocycle' | 'mesocycle' | 'microcycle';
  currentPageStep: number;
  onChangeCurrentPageStep?: (nextStep: number) => void;
}

export function PlanningNavigationMenu({ currentPage, currentPageStep, onChangeCurrentPageStep }: PlanningNavigationMenuProps) {
  const navigate = useNavigate();

  // Calculate current absolute step number
  const currentStep = PLANNING_STEPS.find(
    step => step.page === currentPage && step.pageStep === currentPageStep
  )?.id || 1;

  const handleStepClick = (step: PlanningStep) => {
    // If clicking a step on the current page, update step directly via callback
    if (step.page === currentPage && onChangeCurrentPageStep) {
      // Save to localStorage for persistence
      if (step.page === 'macrocycle') {
        localStorage.setItem('macrocycleStep', step.pageStep.toString());
      } else if (step.page === 'mesocycle') {
        localStorage.setItem('mesocycleStep', step.pageStep.toString());
      }
      
      // Update current step without navigation
      onChangeCurrentPageStep(step.pageStep);
      return;
    }

    // Save the target step to localStorage so the target page knows which step to show
    if (step.page === 'macrocycle') {
      localStorage.setItem('macrocycleStep', step.pageStep.toString());
    } else if (step.page === 'mesocycle') {
      localStorage.setItem('mesocycleStep', step.pageStep.toString());
    }

    // Navigate to the appropriate page
    navigate(`/${step.page}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title="Planning Steps">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Planning Steps ({currentStep} of {PLANNING_STEPS.length})
        </div>
        <DropdownMenuSeparator />
        
        {/* Macrocycle steps */}
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
          Macrocycle Planning
        </div>
        {PLANNING_STEPS.filter(s => s.page === 'macrocycle').map(step => {
          const isActive = step.id === currentStep;

          return (
            <DropdownMenuItem
              key={step.id}
              onClick={() => handleStepClick(step)}
              className={cn(isActive && "bg-accent font-semibold")}
            >
              <span className="mr-2">{step.id}.</span>
              {step.label}
              {isActive && <span className="ml-auto text-xs">(Current)</span>}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Mesocycle steps */}
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
          Mesocycle Planning
        </div>
        {PLANNING_STEPS.filter(s => s.page === 'mesocycle').map(step => {
          const isActive = step.id === currentStep;

          return (
            <DropdownMenuItem
              key={step.id}
              onClick={() => handleStepClick(step)}
              className={cn(isActive && "bg-accent font-semibold")}
            >
              <span className="mr-2">{step.id}.</span>
              {step.label}
              {isActive && <span className="ml-auto text-xs">(Current)</span>}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Microcycle steps */}
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
          Microcycle Planning
        </div>
        {PLANNING_STEPS.filter(s => s.page === 'microcycle').map(step => {
          const isActive = step.id === currentStep;

          return (
            <DropdownMenuItem
              key={step.id}
              onClick={() => handleStepClick(step)}
              className={cn(isActive && "bg-accent font-semibold")}
            >
              <span className="mr-2">{step.id}.</span>
              {step.label}
              {isActive && <span className="ml-auto text-xs">(Current)</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
