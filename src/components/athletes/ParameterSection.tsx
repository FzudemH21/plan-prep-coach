import { useState, useMemo } from 'react';
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
  DialogDescription,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Check, ChevronsUpDown, History, Plus, TrendingUp, Trash2, Link, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Athlete, AthleteBiometric, BiometricDefinition, AthletePerformanceParameter } from '@/types/athlete';
import { ParameterV2 } from '@/types/parametersV2';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { ParameterValueHistory } from './ParameterValueHistory';

interface ParameterSectionProps {
  athlete: Athlete;
  athleteData: ReturnType<typeof useAthletes>;
  allAthletes: Athlete[];
  allAthleteParameters: AthleteBiometric[];
}

export function ParameterSection({ athlete, athleteData, allAthletes, allAthleteParameters }: ParameterSectionProps) {
  // Biometric states
  const [showAddBiometric, setShowAddBiometric] = useState(false);
  const [selectedBiometricDefId, setSelectedBiometricDefId] = useState<string>('');
  const [newBiometricName, setNewBiometricName] = useState('');
  const [newBiometricType, setNewBiometricType] = useState<'text' | 'quantitative'>('quantitative');
  const [newBiometricUnit, setNewBiometricUnit] = useState('');
  
  // Performance parameter states
  const [showAddPerformance, setShowAddPerformance] = useState(false);
  const [performanceComboOpen, setPerformanceComboOpen] = useState(false);
  const [selectedAthleticismParamId, setSelectedAthleticismParamId] = useState<string>('');
  
  // Value dialogs
  const [showBiometricValueDialog, setShowBiometricValueDialog] = useState<AthleteBiometric | null>(null);
  const [showPerformanceValueDialog, setShowPerformanceValueDialog] = useState<AthletePerformanceParameter | null>(null);
  const [newValue, setNewValue] = useState('');
  
  // History dialogs
  const [showBiometricHistory, setShowBiometricHistory] = useState<AthleteBiometric | null>(null);
  const [showPerformanceHistory, setShowPerformanceHistory] = useState<AthletePerformanceParameter | null>(null);

  // Get Athleticism Database parameters
  const { data: athleticismData } = useParametersDataV2();
  const athleticismParameters = athleticismData?.parameters || [];

  // Get athlete's biometrics (excluding Height and Weight which are shown in Profile Information)
  const athleteBiometrics = useMemo(() => {
    return athleteData.getAthleteBiometrics(athlete.id).filter((ab) => {
      const def = athleteData.getBiometricDefinition(ab.biometricDefinitionId);
      return def && def.name !== 'Height' && def.name !== 'Weight';
    });
  }, [athleteData, athlete.id]);

  // Get athlete's performance parameters
  const athletePerformanceParams = useMemo(() => {
    return athleteData.getAthletePerformanceParameters(athlete.id);
  }, [athleteData, athlete.id]);

  // Available biometric definitions (not yet added to this athlete)
  const availableBiometricDefs = useMemo(() => {
    const allBiometrics = athleteData.getAthleteBiometrics(athlete.id);
    return athleteData.biometricDefinitions.filter(
      (def) => 
        def.name !== 'Height' && 
        def.name !== 'Weight' && 
        !allBiometrics.some((ab) => ab.biometricDefinitionId === def.id)
    );
  }, [athleteData, athlete.id]);

  // Available athleticism parameters (not yet added to this athlete)
  const availableAthleticismParams = useMemo(() => {
    return athleticismParameters.filter(
      (param) => !athletePerformanceParams.some((pp) => pp.athleticismParameterId === param.id)
    );
  }, [athleticismParameters, athletePerformanceParams]);

  // ============ BIOMETRIC HANDLERS ============
  const handleAddBiometric = () => {
    if (selectedBiometricDefId === 'new') {
      if (!newBiometricName.trim()) return;
      const def = athleteData.createBiometricDefinition({
        name: newBiometricName.trim(),
        type: newBiometricType,
        unit: newBiometricType === 'quantitative' ? newBiometricUnit || null : null,
      });
      athleteData.addBiometricToAthlete(athlete.id, def.id);
    } else if (selectedBiometricDefId) {
      athleteData.addBiometricToAthlete(athlete.id, selectedBiometricDefId);
    }
    resetBiometricDialog();
  };

  const resetBiometricDialog = () => {
    setShowAddBiometric(false);
    setSelectedBiometricDefId('');
    setNewBiometricName('');
    setNewBiometricType('quantitative');
    setNewBiometricUnit('');
  };

  const handleAddBiometricValue = () => {
    if (!showBiometricValueDialog || !newValue.trim()) return;
    athleteData.addBiometricValue(showBiometricValueDialog.id, newValue.trim());
    setShowBiometricValueDialog(null);
    setNewValue('');
  };

  // ============ PERFORMANCE PARAMETER HANDLERS ============
  const handleAddPerformanceParameter = () => {
    if (!selectedAthleticismParamId) return;
    athleteData.addPerformanceParameter(athlete.id, selectedAthleticismParamId);
    resetPerformanceDialog();
  };

  const resetPerformanceDialog = () => {
    setShowAddPerformance(false);
    setSelectedAthleticismParamId('');
    setPerformanceComboOpen(false);
  };

  const handleAddPerformanceValue = () => {
    if (!showPerformanceValueDialog || !newValue.trim()) return;
    athleteData.addPerformanceParameterValue(showPerformanceValueDialog.id, newValue.trim());
    setShowPerformanceValueDialog(null);
    setNewValue('');
  };

  // ============ HELPERS ============
  const getBiometricDefinition = (ab: AthleteBiometric): BiometricDefinition | undefined => {
    return athleteData.getBiometricDefinition(ab.biometricDefinitionId);
  };

  const getAthleticismParameter = (pp: AthletePerformanceParameter): ParameterV2 | undefined => {
    return athleticismParameters.find((p) => p.id === pp.athleticismParameterId);
  };

  const getLatestValue = (values: { id: string; value: string; recordedAt: string }[]) => {
    if (values.length === 0) return null;
    return values.reduce((latest, v) =>
      new Date(v.recordedAt) > new Date(latest.recordedAt) ? v : latest
    );
  };

  return (
    <>
      {/* ============ PERFORMANCE PARAMETERS SECTION ============ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Performance Parameters</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddPerformance(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {athletePerformanceParams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No performance parameters tracked. Add parameters from the Athleticism Database to track training goals.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athletePerformanceParams.map((pp) => {
                const param = getAthleticismParameter(pp);
                if (!param) return null;

                const latest = getLatestValue(pp.values);
                const hasHistory = pp.values.length > 1;

                return (
                  <div key={pp.id} className="border rounded-lg p-4 space-y-2 border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link className="h-4 w-4 text-primary" />
                        <Label className="font-medium">{param.name}</Label>
                      </div>
                      <div className="flex gap-1">
                        {hasHistory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowPerformanceHistory(pp)}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => athleteData.removePerformanceParameter(pp.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        {latest ? (
                          <div>
                            <span className="text-2xl font-bold">{latest.value}</span>
                            {param.unit && (
                              <span className="text-muted-foreground ml-1">{param.unit}</span>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(latest.recordedAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No value</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowPerformanceValueDialog(pp);
                          setNewValue('');
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {param.category && (
                      <Badge variant="secondary" className="text-xs">
                        {param.category}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ BIOMETRICS SECTION ============ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Biometrics</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddBiometric(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {athleteBiometrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No biometrics tracked. Add health metrics like Resting Heart Rate, Blood Pressure, etc.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athleteBiometrics.map((ab) => {
                const def = getBiometricDefinition(ab);
                if (!def) return null;

                const latest = getLatestValue(ab.values);
                const hasHistory = ab.values.length > 1;

                return (
                  <div key={ab.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">{def.name}</Label>
                      <div className="flex gap-1">
                        {hasHistory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowBiometricHistory(ab)}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => athleteData.removeBiometricFromAthlete(ab.id)}
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
                                <span className="text-2xl font-bold">{latest.value}</span>
                                {def.unit && (
                                  <span className="text-muted-foreground ml-1">{def.unit}</span>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(latest.recordedAt), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </HoverCardTrigger>
                            {ab.values.length > 0 && (
                              <HoverCardContent className="w-80" align="start">
                                <div className="space-y-2">
                                  <h4 className="font-medium">Recent Values</h4>
                                  <div className="space-y-1">
                                    {ab.values
                                      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                                      .slice(0, 5)
                                      .map((v) => (
                                        <div key={v.id} className="flex justify-between text-sm">
                                          <span>{v.value} {def.unit}</span>
                                          <span className="text-muted-foreground">
                                            {format(new Date(v.recordedAt), 'MMM d, yyyy')}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                  {ab.values.length > 5 && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 h-auto"
                                      onClick={() => setShowBiometricHistory(ab)}
                                    >
                                      View all {ab.values.length} values
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
                          setShowBiometricValueDialog(ab);
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

      {/* ============ ADD PERFORMANCE PARAMETER DIALOG ============ */}
      <Dialog open={showAddPerformance} onOpenChange={setShowAddPerformance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Performance Parameter</DialogTitle>
            <DialogDescription>
              Select a parameter from the Athleticism Database to track for this athlete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Parameter</Label>
              <Popover open={performanceComboOpen} onOpenChange={setPerformanceComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={performanceComboOpen}
                    className="w-full justify-between"
                  >
                    {selectedAthleticismParamId
                      ? athleticismParameters.find((p) => p.id === selectedAthleticismParamId)?.name
                      : "Select a parameter..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search parameters..." />
                    <CommandList>
                      <CommandEmpty>No parameters found. Add them in the Athleticism Database first.</CommandEmpty>
                      <CommandGroup>
                        {availableAthleticismParams.map((param) => (
                          <CommandItem
                            key={param.id}
                            value={param.name}
                            onSelect={() => {
                              setSelectedAthleticismParamId(param.id);
                              setPerformanceComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedAthleticismParamId === param.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <span>{param.name}</span>
                              {param.unit && (
                                <span className="ml-2 text-muted-foreground text-sm">({param.unit})</span>
                              )}
                              {param.category && (
                                <Badge variant="secondary" className="ml-2 text-xs">{param.category}</Badge>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetPerformanceDialog}>Cancel</Button>
            <Button onClick={handleAddPerformanceParameter} disabled={!selectedAthleticismParamId}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ADD BIOMETRIC DIALOG ============ */}
      <Dialog open={showAddBiometric} onOpenChange={setShowAddBiometric}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Biometric</DialogTitle>
            <DialogDescription>
              Track a health metric for this athlete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Biometric</Label>
              <Select value={selectedBiometricDefId} onValueChange={setSelectedBiometricDefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a biometric" />
                </SelectTrigger>
                <SelectContent>
                  {availableBiometricDefs.map((def) => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.name}
                      {def.unit && (
                        <span className="text-muted-foreground ml-1">({def.unit})</span>
                      )}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Create new biometric</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedBiometricDefId === 'new' && (
              <>
                <div className="space-y-2">
                  <Label>Biometric Name</Label>
                  <Input
                    placeholder="e.g., Resting Heart Rate"
                    value={newBiometricName}
                    onChange={(e) => setNewBiometricName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newBiometricType}
                    onValueChange={(v) => setNewBiometricType(v as 'text' | 'quantitative')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantitative">Quantitative (number with unit)</SelectItem>
                      <SelectItem value="text">Text (qualitative)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newBiometricType === 'quantitative' && (
                  <div className="space-y-2">
                    <Label>Unit (optional)</Label>
                    <Input
                      placeholder="e.g., bpm, mmHg"
                      value={newBiometricUnit}
                      onChange={(e) => setNewBiometricUnit(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetBiometricDialog}>Cancel</Button>
            <Button
              onClick={handleAddBiometric}
              disabled={!selectedBiometricDefId || (selectedBiometricDefId === 'new' && !newBiometricName.trim())}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ADD BIOMETRIC VALUE DIALOG ============ */}
      <Dialog open={!!showBiometricValueDialog} onOpenChange={() => setShowBiometricValueDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Value
              {showBiometricValueDialog && (
                <span className="font-normal text-muted-foreground ml-2">
                  {getBiometricDefinition(showBiometricValueDialog)?.name}
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
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBiometricValue()}
                />
                {showBiometricValueDialog && getBiometricDefinition(showBiometricValueDialog)?.unit && (
                  <span className="flex items-center text-muted-foreground">
                    {getBiometricDefinition(showBiometricValueDialog)?.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBiometricValueDialog(null)}>Cancel</Button>
            <Button onClick={handleAddBiometricValue} disabled={!newValue.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ADD PERFORMANCE VALUE DIALOG ============ */}
      <Dialog open={!!showPerformanceValueDialog} onOpenChange={() => setShowPerformanceValueDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Value
              {showPerformanceValueDialog && (
                <span className="font-normal text-muted-foreground ml-2">
                  {getAthleticismParameter(showPerformanceValueDialog)?.name}
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
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerformanceValue()}
                />
                {showPerformanceValueDialog && getAthleticismParameter(showPerformanceValueDialog)?.unit && (
                  <span className="flex items-center text-muted-foreground">
                    {getAthleticismParameter(showPerformanceValueDialog)?.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPerformanceValueDialog(null)}>Cancel</Button>
            <Button onClick={handleAddPerformanceValue} disabled={!newValue.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ BIOMETRIC HISTORY DIALOG ============ */}
      {showBiometricHistory && (
        <ParameterValueHistory
          open={!!showBiometricHistory}
          onOpenChange={() => setShowBiometricHistory(null)}
          athleteParameter={showBiometricHistory}
          definition={getBiometricDefinition(showBiometricHistory)!}
          onAddValue={(value) => athleteData.addBiometricValue(showBiometricHistory.id, value)}
          onDeleteValue={(valueId) => athleteData.deleteBiometricValue(showBiometricHistory.id, valueId)}
          allAthletes={allAthletes}
          allAthleteParameters={allAthleteParameters}
          currentAthlete={athlete}
        />
      )}
    </>
  );
}
