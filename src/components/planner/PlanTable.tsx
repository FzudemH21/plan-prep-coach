import React from "react";
import { Plan, Intensity } from "@/features/planner/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function intensityBg(intensity: Intensity) {
  switch (intensity) {
    case "low":
      return "bg-[hsl(var(--intensity-low))] text-[hsl(var(--intensity-foreground))]";
    case "moderate":
      return "bg-[hsl(var(--intensity-moderate))] text-[hsl(var(--intensity-foreground))]";
    case "high":
      return "bg-[hsl(var(--intensity-high))] text-[hsl(var(--intensity-foreground))]";
    case "deload":
      return "bg-[hsl(var(--intensity-deload))] text-foreground";
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
                  <h3 className="text-base font-medium">{meso.name} · {meso.weeks} weeks · {meso.sessionsPerWeek} sessions/week · {meso.sessionLength} min</h3>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => {
                      const next = { ...plan };
                      next.mesocycles[mi].weeks += 1;
                      next.mesocycles[mi].microcycles.push({ intensity: "moderate" });
                      onChange(next);
                    }}>+ Week</Button>
                    <Button variant="secondary" onClick={() => {
                      if (meso.weeks <= 1) return;
                      const next = { ...plan };
                      next.mesocycles[mi].weeks -= 1;
                      next.mesocycles[mi].microcycles.pop();
                      onChange(next);
                    }}>- Week</Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {Array.from({ length: meso.weeks }, (_, w) => (
                          <th key={w} className="border p-2 text-sm font-medium text-muted-foreground">Week {w + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {meso.microcycles.map((mc, w) => (
                          <td key={w} className="border p-2 align-top">
                            <div className={`rounded-md p-3 text-center ${intensityBg(mc.intensity)}`}>
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
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="deload">Deload</SelectItem>
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
