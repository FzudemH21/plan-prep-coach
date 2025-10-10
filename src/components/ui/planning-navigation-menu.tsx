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
import { useState, useEffect } from "react";

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
}

export function PlanningNavigationMenu({ currentPage, currentPageStep }: PlanningNavigationMenuProps) {
  const navigate = useNavigate();
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('planningVisitedSteps');
    return saved ? new Set(JSON.parse(saved)) : new Set([1]);
  });

  // Calculate current absolute step number
  const currentStep = PLANNING_STEPS.find(
    step => step.page === currentPage && step.pageStep === currentPageStep
  )?.id || 1;

  // Update visited steps when current step changes
  useEffect(() => {
    setVisitedSteps(prev => {
      const updated = new Set([...prev, currentStep]);
      localStorage.setItem('planningVisitedSteps', JSON.stringify([...updated]));
      return updated;
    });
  }, [currentStep]);

  const handleStepClick = (step: PlanningStep) => {
    if (!visitedSteps.has(step.id)) return;

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
          const isVisited = visitedSteps.has(step.id);
          const isClickable = isVisited;

          return (
            <DropdownMenuItem
              key={step.id}
              onClick={() => isClickable && handleStepClick(step)}
              disabled={!isClickable}
              className={cn(
                isActive && "bg-accent font-semibold",
                !isClickable && "opacity-50 cursor-not-allowed"
              )}
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
          const isVisited = visitedSteps.has(step.id);
          const isClickable = isVisited;

          return (
            <DropdownMenuItem
              key={step.id}
              onClick={() => isClickable && handleStepClick(step)}
              disabled={!isClickable}
              className={cn(
                isActive && "bg-accent font-semibold",
                !isClickable && "opacity-50 cursor-not-allowed"
              )}
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
          const isVisited = visitedSteps.has(step.id);
          const isClickable = isVisited;

          return (
            <DropdownMenuItem
              key={step.id}
              onClick={() => isClickable && handleStepClick(step)}
              disabled={!isClickable}
              className={cn(
                isActive && "bg-accent font-semibold",
                !isClickable && "opacity-50 cursor-not-allowed"
              )}
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
