import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ExtendedMesocycle } from '@/features/planner/types';

interface CrossMesocycleCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMicrocycleId: string;
  targetMicrocycleDuration: number;
  currentMesocycles: ExtendedMesocycle[];
  onCopy: (sourceMesocycleId: string, sourceMicrocycleId: string) => void;
}

interface AvailableMesocycle {
  id: string;
  name: string;
  microcycles: {
    id: string;
    name: string;
    duration: number;
  }[];
}

export function CrossMesocycleCopyDialog({
  open,
  onOpenChange,
  targetMicrocycleId,
  targetMicrocycleDuration,
  currentMesocycles,
  onCopy
}: CrossMesocycleCopyDialogProps) {
  const [availableMesocycles, setAvailableMesocycles] = useState<AvailableMesocycle[]>([]);
  const [selectedMesocycleId, setSelectedMesocycleId] = useState<string>('');
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<string>('');

  // Load available mesocycles from localStorage
  useEffect(() => {
    if (!open) return;
    
    const loadAvailableMesocycles = () => {
      const mesocycles: AvailableMesocycle[] = [];
      
      // Add current mesocycles (for copying within same session)
      currentMesocycles.forEach(meso => {
        const compatibleMicrocycles = meso.microcycles.filter(micro => 
          micro.duration === targetMicrocycleDuration && micro.id !== targetMicrocycleId
        );
        
        if (compatibleMicrocycles.length > 0) {
          mesocycles.push({
            id: meso.id,
            name: meso.name,
            microcycles: compatibleMicrocycles.map(micro => ({
              id: micro.id,
              name: micro.name,
              duration: micro.duration
            }))
          });
        }
      });
      
      // Scan localStorage for previous mesocycle data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('macrocycleData')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.mesocycles) {
              data.mesocycles.forEach((meso: any) => {
                // Skip if this mesocycle is already in current mesocycles
                if (currentMesocycles.some(currentMeso => currentMeso.id === meso.id)) {
                  return;
                }
                
                const compatibleMicrocycles = (meso.microcycles || []).filter((micro: any) => 
                  micro.duration === targetMicrocycleDuration
                );
                
                if (compatibleMicrocycles.length > 0) {
                  const existingMeso = mesocycles.find(m => m.id === meso.id);
                  if (!existingMeso) {
                    mesocycles.push({
                      id: meso.id,
                      name: meso.name || `Mesocycle from ${key}`,
                      microcycles: compatibleMicrocycles.map((micro: any) => ({
                        id: micro.id,
                        name: micro.name,
                        duration: micro.duration
                      }))
                    });
                  }
                }
              });
            }
          } catch (e) {
            // Skip invalid localStorage entries
          }
        }
      }
      
      setAvailableMesocycles(mesocycles);
    };
    
    loadAvailableMesocycles();
  }, [open, currentMesocycles, targetMicrocycleId, targetMicrocycleDuration]);

  const selectedMesocycle = availableMesocycles.find(m => m.id === selectedMesocycleId);
  const compatibleMicrocycles = selectedMesocycle?.microcycles || [];

  const handleCopy = () => {
    if (selectedMesocycleId && selectedMicrocycleId) {
      onCopy(selectedMesocycleId, selectedMicrocycleId);
      onOpenChange(false);
      setSelectedMesocycleId('');
      setSelectedMicrocycleId('');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedMesocycleId('');
    setSelectedMicrocycleId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Copy Intensity Setup</DialogTitle>
          <DialogDescription>
            Copy intensity pattern from another microcycle with the same duration ({targetMicrocycleDuration} days).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {availableMesocycles.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No compatible microcycles found. Only microcycles with {targetMicrocycleDuration} days can be copied.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="source-mesocycle">Source Mesocycle</Label>
                <Select value={selectedMesocycleId} onValueChange={setSelectedMesocycleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a mesocycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMesocycles.map(meso => (
                      <SelectItem key={meso.id} value={meso.id}>
                        {meso.name} ({meso.microcycles.length} compatible microcycles)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedMesocycleId && (
                <div className="space-y-2">
                  <Label htmlFor="source-microcycle">Source Microcycle</Label>
                  <Select value={selectedMicrocycleId} onValueChange={setSelectedMicrocycleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a microcycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleMicrocycles.map(micro => (
                        <SelectItem key={micro.id} value={micro.id}>
                          {micro.name} ({micro.duration} days)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCopy}
                  disabled={!selectedMesocycleId || !selectedMicrocycleId}
                >
                  Copy Setup
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}