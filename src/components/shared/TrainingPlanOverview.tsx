import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { Info, User, Calendar, Target, Trophy, ChevronDown, ChevronUp, Layers, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrainingPlanOverviewProps {
  athleteName?: string;
  planName?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  totalWeeks?: number;
  totalDays?: number;
  totalMesocycles?: number;
  primaryGoal?: string;
  subGoals?: Array<{ id: string; description: string }>;
  defaultCollapsed?: boolean;
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

export function TrainingPlanOverview({
  athleteName,
  planName,
  startDate,
  endDate,
  totalWeeks,
  totalDays,
  totalMesocycles,
  primaryGoal,
  subGoals = [],
  defaultCollapsed = false,
  notes,
  onNotesChange,
}: TrainingPlanOverviewProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [showAllSubGoals, setShowAllSubGoals] = useState(false);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM dd, yyyy');
  };

  // Get unique sub-goals by description
  const uniqueSubGoals = React.useMemo(() => {
    const seen = new Set<string>();
    return subGoals.filter(sg => {
      const desc = sg.description || '';
      if (desc && desc.trim() !== '' && !seen.has(desc)) {
        seen.add(desc);
        return true;
      }
      return false;
    });
  }, [subGoals]);

  const MAX_VISIBLE_SUBGOALS = 4;
  const visibleSubGoals = showAllSubGoals ? uniqueSubGoals : uniqueSubGoals.slice(0, MAX_VISIBLE_SUBGOALS);
  const hiddenCount = uniqueSubGoals.length - MAX_VISIBLE_SUBGOALS;

  // Combined timeline string
  const timelineString = React.useMemo(() => {
    if (!startDate || !endDate) return '-';
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    
    const durationParts: string[] = [];
    if (totalWeeks) durationParts.push(`${totalWeeks} weeks`);
    if (totalDays) durationParts.push(`${totalDays} days`);
    
    const durationStr = durationParts.length > 0 ? ` (${durationParts.join(', ')})` : '';
    return `${start} - ${end}${durationStr}`;
  }, [startDate, endDate, totalWeeks, totalDays]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4" />
                <span>Training Plan Overview</span>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Row 1: Key metadata in a compact grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {/* Athlete */}
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Athlete
                </Label>
                <p className="font-medium truncate">{athleteName || 'Not selected'}</p>
              </div>
              
              {/* Plan Name */}
              <div>
                <Label className="text-xs text-muted-foreground">Plan</Label>
                <p className="font-medium truncate">{planName || 'Unnamed Plan'}</p>
              </div>
              
              {/* Timeline (combined) */}
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Timeline
                </Label>
                <p className="font-medium">{timelineString}</p>
              </div>
              
              {/* Mesocycles */}
              {totalMesocycles !== undefined && totalMesocycles > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Mesocycles
                  </Label>
                  <p className="font-medium">{totalMesocycles}</p>
                </div>
              )}
            </div>

            {/* Row 2: Primary Goal */}
            {primaryGoal && primaryGoal.trim() !== '' && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> Goal
                </Label>
                <p className="text-sm font-medium">{primaryGoal}</p>
              </div>
            )}

            {/* Row 3: Sub-goals as compact badges with collapsible overflow */}
            {uniqueSubGoals.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Sub-goals
                </Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {visibleSubGoals.map((sg) => (
                    <Badge key={sg.id} variant="secondary" className="text-xs">
                      {sg.description}
                    </Badge>
                  ))}
                  {hiddenCount > 0 && !showAllSubGoals && (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllSubGoals(true);
                      }}
                    >
                      +{hiddenCount} more
                    </Badge>
                  )}
                  {showAllSubGoals && uniqueSubGoals.length > MAX_VISIBLE_SUBGOALS && (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllSubGoals(false);
                      }}
                    >
                      Show less
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {(notes !== undefined || onNotesChange) && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Notes
                </Label>
                {onNotesChange ? (
                  <Textarea
                    value={notes || ''}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Notizen, Überlegungen, Ideen zum Plan..."
                    className="mt-1 min-h-[80px] resize-y text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : notes ? (
                  <p className="text-sm mt-1 whitespace-pre-wrap">{notes}</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
