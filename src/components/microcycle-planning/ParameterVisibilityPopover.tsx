import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { ToolboxEntry } from '@/types/toolbox';

export interface ParameterVisibilityOverrides {
  [parameterName: string]: boolean;
}

interface ParameterVisibilityPopoverProps {
  parameters: Array<{
    name: string;
    showInGridByDefault: boolean;
  }>;
  visibilityOverrides: ParameterVisibilityOverrides;
  onVisibilityChange: (paramName: string, visible: boolean) => void;
  onShowAll: () => void;
  onResetToDefaults: () => void;
}

export function ParameterVisibilityPopover({
  parameters,
  visibilityOverrides,
  onVisibilityChange,
  onShowAll,
  onResetToDefaults,
}: ParameterVisibilityPopoverProps) {
  // Count how many parameters are currently visible
  const visibleCount = parameters.filter(p => {
    const override = visibilityOverrides[p.name];
    return override !== undefined ? override : p.showInGridByDefault;
  }).length;

  const allVisible = visibleCount === parameters.length;
  const someHidden = visibleCount < parameters.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 px-2 gap-1.5"
        >
          {someHidden ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">
            {visibleCount}/{parameters.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3 z-[120] bg-popover" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Parameter Visibility</p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 h-7 text-xs"
              onClick={onShowAll}
              disabled={allVisible}
            >
              <Eye className="h-3 w-3 mr-1" />
              Show All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 h-7 text-xs"
              onClick={onResetToDefaults}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>

          <Separator />

          {/* Individual Parameter Toggles */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {parameters.map((param) => {
              const currentVisibility = visibilityOverrides[param.name] !== undefined 
                ? visibilityOverrides[param.name] 
                : param.showInGridByDefault;
              
              return (
                <div key={param.name} className="flex items-center gap-2">
                  <Checkbox
                    id={`param-vis-${param.name}`}
                    checked={currentVisibility}
                    onCheckedChange={(checked) => onVisibilityChange(param.name, !!checked)}
                  />
                  <Label 
                    htmlFor={`param-vis-${param.name}`} 
                    className="text-xs flex-1 cursor-pointer"
                  >
                    {param.name}
                  </Label>
                  {!param.showInGridByDefault && (
                    <span className="text-[10px] text-muted-foreground">(hidden)</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Visibility is saved when you save the session
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to check if a parameter should be visible
export function isParameterVisible(
  paramName: string,
  showInGridByDefault: boolean,
  overrides: ParameterVisibilityOverrides
): boolean {
  if (overrides[paramName] !== undefined) {
    return overrides[paramName];
  }
  return showInGridByDefault;
}
