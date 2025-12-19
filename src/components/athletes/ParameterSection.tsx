import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { History, Plus, TrendingUp, Trash2 } from 'lucide-react';
import { Athlete, AthleteParameter, ParameterDefinition } from '@/types/athlete';
import { useAthletes } from '@/hooks/useAthletes';
import { ParameterValueHistory } from './ParameterValueHistory';

interface ParameterSectionProps {
  athlete: Athlete;
  athleteData: ReturnType<typeof useAthletes>;
}

export function ParameterSection({ athlete, athleteData }: ParameterSectionProps) {
  const [showAddParameter, setShowAddParameter] = useState(false);
  const [selectedDefId, setSelectedDefId] = useState<string>('');
  const [newParamName, setNewParamName] = useState('');
  const [newParamType, setNewParamType] = useState<'text' | 'quantitative'>('quantitative');
  const [newParamUnit, setNewParamUnit] = useState('');
  const [showNewValueDialog, setShowNewValueDialog] = useState<AthleteParameter | null>(null);
  const [newValue, setNewValue] = useState('');
  const [showHistory, setShowHistory] = useState<AthleteParameter | null>(null);

  const athleteParams = athleteData.getAthleteParameters(athlete.id);

  // Get definitions not yet added to this athlete
  const availableDefinitions = athleteData.parameterDefinitions.filter(
    (def) => !athleteParams.some((ap) => ap.parameterDefinitionId === def.id)
  );

  const handleAddParameter = () => {
    if (selectedDefId === 'new') {
      if (!newParamName.trim()) return;
      const def = athleteData.createParameterDefinition({
        name: newParamName.trim(),
        type: newParamType,
        unit: newParamType === 'quantitative' ? newParamUnit || null : null,
      });
      athleteData.addParameterToAthlete(athlete.id, def.id);
    } else if (selectedDefId) {
      athleteData.addParameterToAthlete(athlete.id, selectedDefId);
    }
    resetAddDialog();
  };

  const resetAddDialog = () => {
    setShowAddParameter(false);
    setSelectedDefId('');
    setNewParamName('');
    setNewParamType('quantitative');
    setNewParamUnit('');
  };

  const handleAddValue = () => {
    if (!showNewValueDialog || !newValue.trim()) return;
    athleteData.addParameterValue(showNewValueDialog.id, newValue.trim());
    setShowNewValueDialog(null);
    setNewValue('');
  };

  const getDefinition = (ap: AthleteParameter): ParameterDefinition | undefined => {
    return athleteData.getParameterDefinition(ap.parameterDefinitionId);
  };

  const getLatestValue = (ap: AthleteParameter) => {
    if (ap.values.length === 0) return null;
    return ap.values.reduce((latest, v) =>
      new Date(v.recordedAt) > new Date(latest.recordedAt) ? v : latest
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Parameters & Metrics</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddParameter(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Parameter
          </Button>
        </CardHeader>
        <CardContent>
          {athleteParams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No parameters tracked yet. Add parameters to track metrics like height, weight, or custom values.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athleteParams.map((ap) => {
                const def = getDefinition(ap);
                if (!def) return null;

                const latest = getLatestValue(ap);
                const hasHistory = ap.values.length > 1;

                return (
                  <div
                    key={ap.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">{def.name}</Label>
                      <div className="flex gap-1">
                        {hasHistory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowHistory(ap)}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => athleteData.removeParameterFromAthlete(ap.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        {latest ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="cursor-pointer">
                                <span className="text-2xl font-bold">
                                  {latest.value}
                                </span>
                                {def.unit && (
                                  <span className="text-muted-foreground ml-1">
                                    {def.unit}
                                  </span>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(latest.recordedAt), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </HoverCardTrigger>
                            {ap.values.length > 0 && (
                              <HoverCardContent className="w-80" align="start">
                                <div className="space-y-2">
                                  <h4 className="font-medium">Recent Values</h4>
                                  <div className="space-y-1">
                                    {ap.values
                                      .sort(
                                        (a, b) =>
                                          new Date(b.recordedAt).getTime() -
                                          new Date(a.recordedAt).getTime()
                                      )
                                      .slice(0, 5)
                                      .map((v) => (
                                        <div
                                          key={v.id}
                                          className="flex justify-between text-sm"
                                        >
                                          <span>
                                            {v.value} {def.unit}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {format(
                                              new Date(v.recordedAt),
                                              'MMM d, yyyy'
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                  {ap.values.length > 5 && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 h-auto"
                                      onClick={() => setShowHistory(ap)}
                                    >
                                      View all {ap.values.length} values
                                    </Button>
                                  )}
                                </div>
                              </HoverCardContent>
                            )}
                          </HoverCard>
                        ) : (
                          <span className="text-muted-foreground">No value</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowNewValueDialog(ap);
                          setNewValue('');
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Parameter Dialog */}
      <Dialog open={showAddParameter} onOpenChange={setShowAddParameter}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Parameter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Parameter</Label>
              <Select value={selectedDefId} onValueChange={setSelectedDefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a parameter" />
                </SelectTrigger>
                <SelectContent>
                  {availableDefinitions.map((def) => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.name}
                      {def.unit && (
                        <span className="text-muted-foreground ml-1">
                          ({def.unit})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Create new parameter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedDefId === 'new' && (
              <>
                <div className="space-y-2">
                  <Label>Parameter Name</Label>
                  <Input
                    placeholder="e.g., Resting Heart Rate"
                    value={newParamName}
                    onChange={(e) => setNewParamName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newParamType}
                    onValueChange={(v) => setNewParamType(v as 'text' | 'quantitative')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantitative">
                        Quantitative (number with unit)
                      </SelectItem>
                      <SelectItem value="text">Text (qualitative)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newParamType === 'quantitative' && (
                  <div className="space-y-2">
                    <Label>Unit (optional)</Label>
                    <Input
                      placeholder="e.g., bpm, kg, cm"
                      value={newParamUnit}
                      onChange={(e) => setNewParamUnit(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAddDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAddParameter}
              disabled={
                !selectedDefId ||
                (selectedDefId === 'new' && !newParamName.trim())
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Value Dialog */}
      <Dialog
        open={!!showNewValueDialog}
        onOpenChange={() => setShowNewValueDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Value
              {showNewValueDialog && (
                <span className="font-normal text-muted-foreground ml-2">
                  {getDefinition(showNewValueDialog)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Value</Label>
              <div className="flex gap-2">
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter value"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddValue()}
                />
                {showNewValueDialog && getDefinition(showNewValueDialog)?.unit && (
                  <span className="flex items-center text-muted-foreground">
                    {getDefinition(showNewValueDialog)?.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewValueDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddValue} disabled={!newValue.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      {showHistory && (
        <ParameterValueHistory
          open={!!showHistory}
          onOpenChange={() => setShowHistory(null)}
          athleteParameter={showHistory}
          definition={getDefinition(showHistory)!}
          onAddValue={(value) => athleteData.addParameterValue(showHistory.id, value)}
          onDeleteValue={(valueId) =>
            athleteData.deleteParameterValue(showHistory.id, valueId)
          }
        />
      )}
    </>
  );
}
