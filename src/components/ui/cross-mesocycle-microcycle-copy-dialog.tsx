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

interface CrossMesocycleMicrocycleCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMesocycleId: string;
  targetMicrocycleStructure: Array<{id: string, duration: number}>;
  currentMesocycles: ExtendedMesocycle[];
  onCopy: (sourceMesocycleId: string) => void;
}

interface AvailableMesocycle {
  mesocycleId: string;
  mesocycleName: string;
  microcycleCount: number;
}

export function CrossMesocycleMicrocycleCopyDialog({
  open,
  onOpenChange,
  targetMesocycleId,
  targetMicrocycleStructure,
  currentMesocycles,
  onCopy
}: CrossMesocycleMicrocycleCopyDialogProps) {
  const [availableMesocycles, setAvailableMesocycles] = useState<AvailableMesocycle[]>([]);
  const [selectedMesocycleId, setSelectedMesocycleId] = useState<string>('');

  // Load available mesocycles from current mesocycles and localStorage
  useEffect(() => {
    if (!open) return;
    
    const loadAvailableMesocycles = () => {
      const mesocycles: AvailableMesocycle[] = [];
      
      // Helper to check if microcycle structure matches
      const structureMatches = (candidate: any) => {
        if (!candidate.microcycles || candidate.microcycles.length !== targetMicrocycleStructure.length) {
          return false;
        }
        return candidate.microcycles.every((micro: any, idx: number) => 
          micro.duration === targetMicrocycleStructure[idx].duration
        );
      };
      
      // Add current mesocycles
      currentMesocycles.forEach(meso => {
        if (meso.id !== targetMesocycleId && structureMatches(meso)) {
          mesocycles.push({
            mesocycleId: meso.id,
            mesocycleName: meso.name,
            microcycleCount: meso.microcycles.length
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
                
                if (structureMatches(meso)) {
                  const existingMeso = mesocycles.find(m => m.mesocycleId === meso.id);
                  if (!existingMeso) {
                    mesocycles.push({
                      mesocycleId: meso.id,
                      mesocycleName: meso.name || `Mesocycle from ${key}`,
                      microcycleCount: meso.microcycles?.length || 0
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
  }, [open, currentMesocycles, targetMesocycleId, targetMicrocycleStructure]);

  const handleCopy = () => {
    if (selectedMesocycleId) {
      onCopy(selectedMesocycleId);
      onOpenChange(false);
      setSelectedMesocycleId('');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedMesocycleId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Copy Mesocycle Intensity Setup</DialogTitle>
          <DialogDescription>
            Copy intensity setup from another mesocycle with the same microcycle structure ({targetMicrocycleStructure.length} microcycles).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {availableMesocycles.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No compatible mesocycles found. Only mesocycles with the same microcycle structure can be copied.
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
                      <SelectItem key={meso.mesocycleId} value={meso.mesocycleId}>
                        {meso.mesocycleName} ({meso.microcycleCount} microcycles)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCopy}
                  disabled={!selectedMesocycleId}
                >
                  Copy Intensity Setup
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
