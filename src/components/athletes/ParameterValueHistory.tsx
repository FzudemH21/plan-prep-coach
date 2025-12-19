import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
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
  Legend,
} from 'recharts';
import { Athlete, AthleteParameter, ParameterDefinition } from '@/types/athlete';

interface ParameterValueHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteParameter: AthleteParameter;
  definition: ParameterDefinition;
  onAddValue: (value: string) => void;
  onDeleteValue: (valueId: string) => void;
  // Optional props for group and sex averages
  allAthletes?: Athlete[];
  allAthleteParameters?: AthleteParameter[];
  currentAthlete?: Athlete;
}

export function ParameterValueHistory({
  open,
  onOpenChange,
  athleteParameter,
  definition,
  onAddValue,
  onDeleteValue,
  allAthletes = [],
  allAthleteParameters = [],
  currentAthlete,
}: ParameterValueHistoryProps) {
  const [newValue, setNewValue] = useState('');

  const sortedValues = [...athleteParameter.values].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const isQuantitative = definition.type === 'quantitative';

  // Calculate group and sex averages for comparison
  const comparisonData = useMemo(() => {
    if (!isQuantitative || !currentAthlete || allAthletes.length === 0) {
      return { groupAvg: [], sexAvg: [], hasComparisons: false };
    }

    // Get all athletes in the same groups as the current athlete
    const groupAthletes = allAthletes.filter(
      (a) =>
        a.id !== currentAthlete.id &&
        a.groupIds.some((gId) => currentAthlete.groupIds.includes(gId))
    );

    // Get all athletes of the same sex
    const sameSexAthletes = allAthletes.filter(
      (a) =>
        a.id !== currentAthlete.id &&
        currentAthlete.sex &&
        a.sex === currentAthlete.sex
    );

    // Get parameter values for group athletes
    const groupParamValues = groupAthletes.flatMap((athlete) => {
      const param = allAthleteParameters.find(
        (ap) =>
          ap.athleteId === athlete.id &&
          ap.parameterDefinitionId === definition.id
      );
      return param?.values.map((v) => ({ ...v, athleteId: athlete.id })) || [];
    });

    // Get parameter values for same-sex athletes
    const sexParamValues = sameSexAthletes.flatMap((athlete) => {
      const param = allAthleteParameters.find(
        (ap) =>
          ap.athleteId === athlete.id &&
          ap.parameterDefinitionId === definition.id
      );
      return param?.values.map((v) => ({ ...v, athleteId: athlete.id })) || [];
    });

    return {
      groupValues: groupParamValues,
      sexValues: sexParamValues,
      hasGroupData: groupParamValues.length > 0,
      hasSexData: sexParamValues.length > 0,
      hasComparisons: groupParamValues.length > 0 || sexParamValues.length > 0,
    };
  }, [
    isQuantitative,
    currentAthlete,
    allAthletes,
    allAthleteParameters,
    definition.id,
  ]);

  // Build chart data with individual values and averages
  const chartData = useMemo(() => {
    if (!isQuantitative || sortedValues.length === 0) return [];

    // For the current athlete, use individual data points
    const baseData = sortedValues.map((v) => ({
      date: format(new Date(v.recordedAt), 'MMM d'),
      fullDate: format(new Date(v.recordedAt), 'MMM d, yyyy'),
      value: parseFloat(v.value) || 0,
      rawValue: v.value,
      month: format(new Date(v.recordedAt), 'yyyy-MM'),
    }));

    if (!comparisonData.hasComparisons) {
      return baseData;
    }

    // Calculate monthly averages for comparison data
    const allDates = sortedValues.map((v) => new Date(v.recordedAt));
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    const monthsInRange = eachMonthOfInterval({
      start: startOfMonth(minDate),
      end: endOfMonth(maxDate),
    });

    // Calculate averages per month for groups
    const groupAvgByMonth: Record<string, number[]> = {};
    const sexAvgByMonth: Record<string, number[]> = {};

    if (comparisonData.groupValues) {
      comparisonData.groupValues.forEach((v) => {
        const month = format(new Date(v.recordedAt), 'yyyy-MM');
        const numVal = parseFloat(v.value);
        if (!isNaN(numVal)) {
          if (!groupAvgByMonth[month]) groupAvgByMonth[month] = [];
          groupAvgByMonth[month].push(numVal);
        }
      });
    }

    if (comparisonData.sexValues) {
      comparisonData.sexValues.forEach((v) => {
        const month = format(new Date(v.recordedAt), 'yyyy-MM');
        const numVal = parseFloat(v.value);
        if (!isNaN(numVal)) {
          if (!sexAvgByMonth[month]) sexAvgByMonth[month] = [];
          sexAvgByMonth[month].push(numVal);
        }
      });
    }

    // Merge averages into base data
    return baseData.map((point) => {
      const groupVals = groupAvgByMonth[point.month];
      const sexVals = sexAvgByMonth[point.month];

      return {
        ...point,
        groupAvg:
          groupVals && groupVals.length > 0
            ? Math.round(
                (groupVals.reduce((a, b) => a + b, 0) / groupVals.length) * 10
              ) / 10
            : undefined,
        sexAvg:
          sexVals && sexVals.length > 0
            ? Math.round(
                (sexVals.reduce((a, b) => a + b, 0) / sexVals.length) * 10
              ) / 10
            : undefined,
      };
    });
  }, [sortedValues, isQuantitative, comparisonData]);

  const handleAddValue = () => {
    if (!newValue.trim()) return;
    onAddValue(newValue.trim());
    setNewValue('');
  };

  const showGroupLine = comparisonData.hasGroupData;
  const showSexLine = comparisonData.hasSexData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {definition.name} History
            {definition.unit && (
              <span className="text-muted-foreground font-normal ml-2">
                ({definition.unit})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Chart for quantitative data */}
          {isQuantitative && sortedValues.length > 1 && (
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
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        value: 'Athlete',
                        groupAvg: 'Group Avg',
                        sexAvg: 'Sex Avg',
                      };
                      return [
                        `${value} ${definition.unit || ''}`,
                        labels[name] || name,
                      ];
                    }}
                  />
                  {(showGroupLine || showSexLine) && (
                    <Legend
                      wrapperStyle={{ paddingTop: '10px' }}
                      formatter={(value) => {
                        const labels: Record<string, string> = {
                          value: 'Athlete',
                          groupAvg: 'Group Average',
                          sexAvg: 'Sex Average',
                        };
                        return labels[value] || value;
                      }}
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
                  {/* Group average line */}
                  {showGroupLine && (
                    <Line
                      type="monotone"
                      dataKey="groupAvg"
                      name="groupAvg"
                      stroke="hsl(25 95% 53%)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: 'hsl(25 95% 53%)', r: 3 }}
                      connectNulls
                    />
                  )}
                  {/* Sex average line */}
                  {showSexLine && (
                    <Line
                      type="monotone"
                      dataKey="sexAvg"
                      name="sexAvg"
                      stroke="hsl(142 76% 36%)"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      dot={{ fill: 'hsl(142 76% 36%)', r: 3 }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Add new value */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="sr-only">New value</Label>
              <Input
                placeholder={`Enter new ${definition.name.toLowerCase()} value`}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddValue()}
              />
            </div>
            {definition.unit && (
              <span className="flex items-center text-muted-foreground px-2">
                {definition.unit}
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
                      {definition.unit && (
                        <span className="text-muted-foreground ml-1">
                          {definition.unit}
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
