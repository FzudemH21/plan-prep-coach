import { useState } from 'react';
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
} from 'recharts';
import { AthleteParameter, ParameterDefinition } from '@/types/athlete';

interface ParameterValueHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteParameter: AthleteParameter;
  definition: ParameterDefinition;
  onAddValue: (value: string) => void;
  onDeleteValue: (valueId: string) => void;
}

export function ParameterValueHistory({
  open,
  onOpenChange,
  athleteParameter,
  definition,
  onAddValue,
  onDeleteValue,
}: ParameterValueHistoryProps) {
  const [newValue, setNewValue] = useState('');

  const sortedValues = [...athleteParameter.values].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const chartData = sortedValues.map((v) => ({
    date: format(new Date(v.recordedAt), 'MMM d'),
    value: definition.type === 'quantitative' ? parseFloat(v.value) || 0 : 0,
    fullDate: format(new Date(v.recordedAt), 'MMM d, yyyy'),
    rawValue: v.value,
  }));

  const handleAddValue = () => {
    if (!newValue.trim()) return;
    onAddValue(newValue.trim());
    setNewValue('');
  };

  const isQuantitative = definition.type === 'quantitative';

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
                    formatter={(value: number) => [
                      `${value} ${definition.unit || ''}`,
                      definition.name,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
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
