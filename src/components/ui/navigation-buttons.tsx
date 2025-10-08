import { Button } from "@/components/ui/button";

interface NavigationButtonsProps {
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  previousLabel?: string;
  nextLabel?: string;
}

export function NavigationButtons({
  onPrevious,
  onNext,
  nextDisabled = false,
  previousLabel = "Previous",
  nextLabel = "Next"
}: NavigationButtonsProps) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full max-w-full px-2 md:px-0 md:flex-nowrap">
      <Button 
        onClick={onPrevious}
        variant="outline"
        className="w-full md:w-auto min-w-0"
      >
        {previousLabel}
      </Button>
      <Button 
        onClick={onNext}
        disabled={nextDisabled}
        className="w-full md:w-auto min-w-0"
      >
        {nextLabel}
      </Button>
    </div>
  );
}
