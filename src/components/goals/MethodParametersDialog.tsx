import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToolboxEntry } from '@/types/toolbox';

interface MethodParameter {
  parameterName: string;
  parameterType: string;
  options: string[];
}

interface MethodParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methodId: string;
  parameters: MethodParameter[];
  currentValues: Record<string, string | number>;
  currentRationale: string;
  onSave: (values: Record<string, string | number>, rationale: string) => void;
}

export function MethodParametersDialog({
  open,
  onOpenChange,
  methodId,
  parameters,
  currentValues,
  currentRationale,
  onSave,
}: MethodParametersDialogProps) {
  const [localValues, setLocalValues] = useState<Record<string, string | number>>(currentValues);
  const [rationale, setRationale] = useState(currentRationale);

  useEffect(() => {
    setLocalValues(currentValues);
    setRationale(currentRationale);
  }, [currentValues, currentRationale, open]);

  const handleParamChange = (paramName: string, value: string | number) => {
    setLocalValues((prev) => ({ ...prev, [paramName]: value }));
  };

  const handleSave = () => {
    onSave(localValues, rationale);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalValues(currentValues);
    setRationale(currentRationale);
    onOpenChange(false);
  };

  // Count filled parameters
  const filledCount = Object.values(localValues).filter((v) => v !== '' && v !== undefined).length;
  const totalCount = parameters.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-base">Specify Parameters</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{methodId}</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Parameters Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Loading Recommendations
            </h4>
            {parameters.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {parameters.map((param, index) => (
                      <tr
                        key={param.parameterName}
                        className={index !== parameters.length - 1 ? 'border-b' : ''}
                      >
                        <td className="px-3 py-2 bg-muted/30 text-sm font-medium w-1/2">
                          {param.parameterName}
                        </td>
                        <td className="px-3 py-2">
                          {param.parameterType === 'qualitative' && param.options.length > 0 ? (
                            <select
                              className="w-full h-8 text-sm border rounded-md px-2 bg-background"
                              value={localValues[param.parameterName] || ''}
                              onChange={(e) =>
                                handleParamChange(param.parameterName, e.target.value)
                              }
                            >
                              <option value="">Select...</option>
                              {param.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              className="h-8 text-sm"
                              value={localValues[param.parameterName] || ''}
                              onChange={(e) =>
                                handleParamChange(param.parameterName, e.target.value)
                              }
                              placeholder="Enter value"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-3">
                No parameters defined for this method.
              </p>
            )}
          </div>

          {/* Rationale */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Rationale
            </Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain why this method helps achieve this goal..."
              className="min-h-[80px] text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Parameters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
