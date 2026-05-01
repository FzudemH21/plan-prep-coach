import { Target } from "lucide-react";

export default function ProgramTemplatesPage() {
  return (
    <div className="w-full max-w-none space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Program Templates</h1>
        <p className="text-muted-foreground">Pre-built training programs for common goals and populations</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-4">
        <Target className="h-16 w-16 opacity-30" />
        <p className="text-lg font-medium">Coming Soon</p>
        <p className="text-sm">Ready-to-use training program templates will be available here.</p>
      </div>
    </div>
  );
}
