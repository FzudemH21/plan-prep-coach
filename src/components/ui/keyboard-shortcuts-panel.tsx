import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Keyboard, X, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const shortcuts = [
  {
    category: 'Fill Operations',
    items: [
      { keys: ['Ctrl', 'D'], description: 'Fill down from selected cell' },
      { keys: ['Ctrl', 'R'], description: 'Fill right from selected cell' },
      { keys: ['Shift', 'Click'], description: 'Select range of cells' },
    ]
  },
  {
    category: 'Navigation',
    items: [
      { keys: ['Tab'], description: 'Move to next cell' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous cell' },
      { keys: ['Enter'], description: 'Move to cell below' },
      { keys: ['Esc'], description: 'Clear selection' },
    ]
  },
  {
    category: 'Clipboard',
    items: [
      { keys: ['Ctrl', 'C'], description: 'Copy selected cells' },
      { keys: ['Ctrl', 'V'], description: 'Paste to selected cells' },
    ]
  }
];

interface KeyboardShortcutsPanelProps {
  className?: string;
}

export function KeyboardShortcutsPanel({ className }: KeyboardShortcutsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="shadow-lg bg-background"
        >
          <Keyboard className="h-4 w-4 mr-2" />
          Shortcuts
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Card className="w-80 shadow-xl bg-background/95 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Keyboard className="h-4 w-4" />
              <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-6 w-6 p-0"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {!isMinimized && (
            <CardDescription className="text-xs">
              Excel-style shortcuts for the Method Periodization table
            </CardDescription>
          )}
        </CardHeader>
        
        <Collapsible open={!isMinimized}>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {shortcuts.map((category) => (
                <div key={category.category} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {category.category}
                  </h4>
                  <div className="space-y-2">
                    {category.items.map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex-1">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center space-x-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 font-mono">
                                {key}
                              </Badge>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-muted-foreground">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Drag handle</span>
                  <span className="text-xs text-muted-foreground">Bottom-right corner</span>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}