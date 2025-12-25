import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Info, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ToolboxEntry } from '@/types/toolbox';
import { GoalMethodV2 } from '@/types/goalsV2';

interface MethodParametersEditorProps {
  method: GoalMethodV2;
  methodName: string;
  toolboxEntries: ToolboxEntry[];
  onUpdate: (updates: Partial<GoalMethodV2>) => void;
  onRemove: () => void;
}

export function MethodParametersEditor({
  method,
  methodName,
  toolboxEntries,
  onUpdate,
  onRemove,
}: MethodParametersEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rationale, setRationale] = useState(method.rationale || '');
  const [localParams, setLocalParams] = useState<Record<string, string | number>>(
    method.loadingRecommendations || {}
  );

  // Get parameters for this method from toolbox
  const methodParams = toolboxEntries.filter((entry) => {
    const toolboxMethodId = `${entry.category} - ${entry.subCategory}`;
    return toolboxMethodId === method.methodId;
  });

  useEffect(() => {
    setLocalParams(method.loadingRecommendations || {});
    setRationale(method.rationale || '');
  }, [method]);

  const handleParamChange = (paramName: string, value: string | number) => {
    const newParams = { ...localParams, [paramName]: value };
    setLocalParams(newParams);
    onUpdate({ loadingRecommendations: newParams });
  };

  const handleRationaleChange = (value: string) => {
    setRationale(value);
    onUpdate({ rationale: value });
  };

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between">
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <span className="font-medium text-sm">{methodName}</span>
          </div>

          <CollapsibleContent className="mt-3 space-y-3">
            {methodParams.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {methodParams.map((param) => (
                  <div key={param.id} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {param.parameterName}
                    </Label>
                    {param.parameterType === 'qualitative' && param.options.length > 0 ? (
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background"
                        value={localParams[param.parameterName] || ''}
                        onChange={(e) => handleParamChange(param.parameterName, e.target.value)}
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
                        value={localParams[param.parameterName] || ''}
                        onChange={(e) => handleParamChange(param.parameterName, e.target.value)}
                        placeholder={param.options[0] || 'Enter value'}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No parameters defined for this method in the toolbox.
              </p>
            )}

            <div className="space-y-1 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">
                Rationale (optional)
              </Label>
              <Textarea
                className="text-sm min-h-[60px]"
                value={rationale}
                onChange={(e) => handleRationaleChange(e.target.value)}
                placeholder="Explain why this method helps achieve this goal..."
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center gap-1 ml-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!rationale}
              >
                <Info className={`h-4 w-4 ${rationale ? 'text-primary' : 'text-muted-foreground'}`} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <p className="text-sm font-medium mb-1">Rationale</p>
              <p className="text-sm text-muted-foreground">
                {rationale || 'No rationale provided yet.'}
              </p>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
