import React from "react";
import { Plan, Intensity } from "@/features/planner/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function intensityBg(intensity: Intensity) {
  switch (intensity) {
    case "off":
      return "bg-[hsl(var(--intensity-off))] text-black border-2";
    case "deload":
      return "bg-[hsl(var(--intensity-deload))] text-white";
    case "easy":
      return "bg-[hsl(var(--intensity-easy))] text-white";
    case "easy-moderate":
      return "bg-[hsl(var(--intensity-easy-moderate))] text-white";
    case "moderate":
      return "bg-[hsl(var(--intensity-moderate))] text-black";
    case "moderate-hard":
      return "bg-[hsl(var(--intensity-moderate-hard))] text-white";
    case "hard":
      return "bg-[hsl(var(--intensity-hard))] text-white";
    case "extremely-hard":
      return "bg-[hsl(var(--intensity-extremely-hard))] text-white";
  }
}

type Props = {
  plan: Plan;
  onChange: (next: Plan) => void;
  onEditSetup: () => void;
};

export default function PlanTable({ plan, onChange, onEditSetup }: Props) {
  return (
    <section className="max-w-[1200px] mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Plan Table</CardTitle>
          <Button variant="outline" onClick={onEditSetup}>Edit Setup</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {plan.mesocycles.map((meso, mi) => (
              <div key={meso.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium">{meso.name} · {meso.microcycles?.length || 0} microcycles · {meso.sessionsPerWeek} sessions/week · {meso.sessionLength} min</h3>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => {
                      const next = { ...plan };
                      const newMicrocycle = {
                        id: `micro-${mi + 1}-${next.mesocycles[mi].microcycles.length + 1}`,
                        name: `Microcycle ${next.mesocycles[mi].microcycles.length + 1}`,
                        duration: 7,
                        intensity: "moderate" as Intensity
                      };
                      next.mesocycles[mi].microcycles.push(newMicrocycle);
                      onChange(next);
                    }}>+ Microcycle</Button>
                    <Button variant="secondary" onClick={() => {
                      if ((meso.microcycles?.length || 0) <= 1) return;
                      const next = { ...plan };
                      next.mesocycles[mi].microcycles.pop();
                      onChange(next);
                    }}>- Microcycle</Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {(meso.microcycles || []).map((mc, w) => (
                          <th key={w} className="border p-2 text-sm font-medium text-muted-foreground">{mc.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {(meso.microcycles || []).map((mc, w) => (
                          <td key={w} className="border p-2 align-top">
                            <div className={`rounded-md p-3 text-center ${intensityBg(mc.intensity)}`}>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide">Duration</div>
                              <div className="mb-2 text-sm font-bold">{mc.duration} days</div>
                              <div className="mb-2 text-xs font-medium uppercase tracking-wide">Intensity</div>
                              <Select
                                value={mc.intensity}
                                onValueChange={(val: Intensity) => {
                                  const next = { ...plan };
                                  next.mesocycles[mi].microcycles[w].intensity = val;
                                  onChange(next);
                                }}
                              >
                                <SelectTrigger className="bg-background/80">
                                  <SelectValue placeholder="Select intensity" />
                                </SelectTrigger>
                                <SelectContent className="z-50 bg-popover">
                                  <SelectItem value="off">Off</SelectItem>
                                  <SelectItem value="deload">Deload</SelectItem>
                                  <SelectItem value="easy">Easy</SelectItem>
                                  <SelectItem value="easy-moderate">Easy-Moderate</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="moderate-hard">Moderate-Hard</SelectItem>
                                  <SelectItem value="hard">Hard</SelectItem>
                                  <SelectItem value="extremely-hard">Extremely Hard</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
