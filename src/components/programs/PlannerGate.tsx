/**
 * The planner (macro-, meso-, microcycle pages) is for coaches who may change programs. With
 * Programs unticked in the organization's rights grid, a note takes its place: programs are viewed
 * in the program library (PDF, version history) and still assigned to the coach's athletes from
 * their calendar — that only changes athlete data, not the program.
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReadOnly } from '@/hooks/useDataScope';

export function PlannerGate({ children }: { children: ReactNode }) {
  const readOnly = useReadOnly('programs');
  const navigate = useNavigate();
  if (!readOnly) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4 max-w-md mx-auto">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Eye className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Planning needs the Programs right</h2>
      <p className="text-sm text-muted-foreground mb-6">
        You can view programs in the program library (as PDF, with their version history) and assign
        them to your athletes from the athlete's calendar.
      </p>
      <Button onClick={() => navigate('/templates/programs')}>Open program library</Button>
    </div>
  );
}
