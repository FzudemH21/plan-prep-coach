import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Athlete, AthletePerformanceParameter } from '@/types/athlete';
import { ParameterV2 } from '@/types/parametersV2';

interface PerformanceValueHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  performanceParameter: AthletePerformanceParameter;
  athleticismParameter: ParameterV2;
  onAddValue: (value: string) => void;
  onDeleteValue: (valueId: string) => void;
  allAthletes: Athlete[];
  allPerformanceParameters: AthletePerformanceParameter[];
  currentAthlete: Athlete;
}

interface ComparisonStats {
  mean: number;
  stdDev: number;
  count: number;
}

// Helper to calculate standard deviation
function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function PerformanceValueHistory({
  open,
  onOpenChange,
  performanceParameter,
  athleticismParameter,
  onAddValue,
  onDeleteValue,
  allAthletes,
  allPerformanceParameters,
  currentAthlete,
}: PerformanceValueHistoryProps) {
  const [newValue, setNewValue] = useState('');

  const sortedValues = [...performanceParameter.values].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  // Calculate group and sex stats using LATEST values from each athlete
  const comparisonStats = useMemo(() => {
    if (allAthletes.length === 0) {
      return { groupStats: null, sexStats: null };
    }

    // Get all athletes in the same groups as the current athlete
    const groupAthletes = allAthletes.filter(
      (a) => a.groupIds.some((gId) => currentAthlete.groupIds.includes(gId))
    );

    // Get all athletes of the same sex
    const sameSexAthletes = allAthletes.filter(
      (a) => currentAthlete.sex && a.sex === currentAthlete.sex
    );

    // Helper to get the latest value for an athlete's performance parameter
    const getLatestValue = (athleteId: string): number | null => {
      const param = allPerformanceParameters.find(
        (pp) =>
          pp.athleteId === athleteId &&
          pp.athleticismParameterId === athleticismParameter.id
      );
      if (!param || param.values.length === 0) return null;
      const sorted = [...param.values].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      const val = parseFloat(sorted[0].value);
      return isNaN(val) ? null : val;
    };

    // Calculate group stats
    let groupStats: ComparisonStats | null = null;
    const groupLatestValues = groupAthletes
      .map((a) => getLatestValue(a.id))
      .filter((v): v is number => v !== null);

    if (groupLatestValues.length > 0) {
      const mean = groupLatestValues.reduce((a, b) => a + b, 0) / groupLatestValues.length;
      const stdDev = calculateStdDev(groupLatestValues, mean);
      groupStats = {
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        count: groupLatestValues.length,
      };
    }

    // Calculate sex stats
    let sexStats: ComparisonStats | null = null;
    const sexLatestValues = sameSexAthletes
      .map((a) => getLatestValue(a.id))
      .filter((v): v is number => v !== null);

    if (sexLatestValues.length > 0) {
      const mean = sexLatestValues.reduce((a, b) => a + b, 0) / sexLatestValues.length;
      const stdDev = calculateStdDev(sexLatestValues, mean);
      sexStats = {
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        count: sexLatestValues.length,
      };
    }

    return { groupStats, sexStats };
  }, [currentAthlete, allAthletes, allPerformanceParameters, athleticismParameter.id]);

  // Build chart data
  const chartData = useMemo(() => {
    if (sortedValues.length === 0) return [];

    return sortedValues.map((v) => ({
      date: format(new Date(v.recordedAt), 'MMM d'),
      fullDate: format(new Date(v.recordedAt), 'MMM d, yyyy'),
      value: parseFloat(v.value) || 0,
      rawValue: v.value,
    }));
  }, [sortedValues]);

  const handleAddValue = () => {
    if (!newValue.trim()) return;
    onAddValue(newValue.trim());
    setNewValue('');
  };

  const { groupStats, sexStats } = comparisonStats;

  // Calculate Y axis domain to include SD bands
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'];
    const values = chartData.map((d) => d.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (groupStats) {
      min = Math.min(min, groupStats.mean - groupStats.stdDev);
      max = Math.max(max, groupStats.mean + groupStats.stdDev);
    }
    if (sexStats) {
      min = Math.min(min, sexStats.mean - sexStats.stdDev);
      max = Math.max(max, sexStats.mean + sexStats.stdDev);
    }

    const padding = (max - min) * 0.1;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData, groupStats, sexStats]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {athleticismParameter.name} History
            {athleticismParameter.unit && (
              <span className="text-muted-foreground font-normal ml-2">
                ({athleticismParameter.unit})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Stats legend */}
          {(groupStats || sexStats) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {groupStats && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-orange-500" style={{ borderStyle: 'dashed', borderWidth: '1px 0 0 0', borderColor: 'hsl(25 95% 53%)' }} />
                  <span className="text-muted-foreground">
                    Group Avg: <span className="text-foreground font-medium">{groupStats.mean} ± {groupStats.stdDev}</span>
                    {athleticismParameter.unit && <span className="ml-1">{athleticismParameter.unit}</span>}
                    <span className="text-muted-foreground ml-1">(n={groupStats.count})</span>
                  </span>
                </div>
              )}
              {sexStats && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ borderStyle: 'dotted', borderWidth: '2px 0 0 0', borderColor: 'hsl(142 76% 36%)' }} />
                  <span className="text-muted-foreground">
                    Sex Avg: <span className="text-foreground font-medium">{sexStats.mean} ± {sexStats.stdDev}</span>
                    {athleticismParameter.unit && <span className="ml-1">{athleticismParameter.unit}</span>}
                    <span className="text-muted-foreground ml-1">(n={sexStats.count})</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Chart for quantitative data */}
          {sortedValues.length > 1 && (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    domain={yDomain}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [
                      `${value} ${athleticismParameter.unit || ''}`,
                      'Athlete',
                    ]}
                  />

                  {/* Group SD band */}
                  {groupStats && (
                    <ReferenceArea
                      y1={groupStats.mean - groupStats.stdDev}
                      y2={groupStats.mean + groupStats.stdDev}
                      fill="hsl(25 95% 53%)"
                      fillOpacity={0.1}
                    />
                  )}
                  {/* Group mean line */}
                  {groupStats && (
                    <ReferenceLine
                      y={groupStats.mean}
                      stroke="hsl(25 95% 53%)"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    />
                  )}

                  {/* Sex SD band */}
                  {sexStats && (
                    <ReferenceArea
                      y1={sexStats.mean - sexStats.stdDev}
                      y2={sexStats.mean + sexStats.stdDev}
                      fill="hsl(142 76% 36%)"
                      fillOpacity={0.1}
                    />
                  )}
                  {/* Sex mean line */}
                  {sexStats && (
                    <ReferenceLine
                      y={sexStats.mean}
                      stroke="hsl(142 76% 36%)"
                      strokeDasharray="2 2"
                      strokeWidth={2}
                    />
                  )}

                  {/* Main athlete line */}
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Add new value */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="sr-only">New value</Label>
              <Input
                placeholder={`Enter new ${athleticismParameter.name.toLowerCase()} value`}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddValue()}
              />
            </div>
            {athleticismParameter.unit && (
              <span className="flex items-center text-muted-foreground px-2">
                {athleticismParameter.unit}
              </span>
            )}
            <Button onClick={handleAddValue} disabled={!newValue.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Values table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...sortedValues].reverse().map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {format(new Date(v.recordedAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {v.value}
                      {athleticismParameter.unit && (
                        <span className="text-muted-foreground ml-1">
                          {athleticismParameter.unit}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDeleteValue(v.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedValues.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-8"
                    >
                      No values recorded yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
