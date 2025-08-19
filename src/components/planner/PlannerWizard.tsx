import React, { useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plan, Mesocycle } from "@/features/planner/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { trainingData } from "@/data/trainingData";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";

const schema = z.object({
  goal: z.string().min(5, "Please describe a SMART goal"),
  mesoCount: z.number().int().min(1).max(12),
  weeksAll: z.number().int().min(1).max(12),
  applyWeeksAll: z.boolean().default(true),
  sessionsAll: z.number().int().min(1).max(14),
  applySessionsAll: z.boolean().default(true),
  sessionLengthAll: z.number().int().min(10).max(240),
  subGoals: z.array(z.string()).default([]),
  qualities: z.string().optional(),
});

export type WizardOutput = Plan;

type WizardProps = {
  onComplete: (plan: Plan) => void;
  initial?: Partial<Plan>;
};

export default function PlannerWizard({ onComplete, initial }: WizardProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useLocalStorage("planner-wizard-draft", {
    goal: initial?.goal ?? "",
    mesoCount: 3,
    weeksAll: 4,
    applyWeeksAll: true,
    sessionsAll: 3,
    applySessionsAll: true,
    sessionLengthAll: 60,
    subGoals: [],
    qualities: "",
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: draft,
    mode: "onChange",
  });

  // Get unique sub-goals for dropdown
  const subGoalOptions = Array.from(new Set(trainingData.map(item => `${item.overarchingGoal} - ${item.subGoal}`)));

  // Auto-populate qualities when sub-goals change
  const selectedSubGoals = form.watch("subGoals") || [];
  React.useEffect(() => {
    if (selectedSubGoals.length > 0) {
      const qualities = Array.from(new Set(
        trainingData
          .filter(item => selectedSubGoals.includes(`${item.overarchingGoal} - ${item.subGoal}`))
          .map(item => item.quality)
      ));
      form.setValue("qualities", qualities.join(", "));
    }
  }, [selectedSubGoals, form]);

  const mesoNames = useMemo(() => Array.from({ length: form.watch("mesoCount") || 0 }, (_, i) => `Mesocycle ${i + 1}`), [form.watch("mesoCount")]);

  const [weeksPerMeso, setWeeksPerMeso] = useState<number[]>(() => Array.from({ length: draft.mesoCount || 0 }, () => draft.weeksAll || 4));
  const [sessionsPerMeso, setSessionsPerMeso] = useState<number[]>(() => Array.from({ length: draft.mesoCount || 0 }, () => draft.sessionsAll || 3));
  const [sessionLengthPerMeso, setSessionLengthPerMeso] = useState<number[]>(() => Array.from({ length: draft.mesoCount || 0 }, () => draft.sessionLengthAll || 60));

  function next() {
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit(values: z.infer<typeof schema>) {
    const mesocycles: Mesocycle[] = Array.from({ length: values.mesoCount }, (_, i) => {
      const weeks = values.applyWeeksAll ? values.weeksAll : (weeksPerMeso[i] || values.weeksAll);
      const sessions = values.applySessionsAll ? values.sessionsAll : (sessionsPerMeso[i] || values.sessionsAll);
      const sessionLength = values.applySessionsAll ? values.sessionLengthAll : (sessionLengthPerMeso[i] || values.sessionLengthAll);
      return {
        id: `meso-${i + 1}`,
        name: `Mesocycle ${i + 1}`,
        weeks,
        sessionsPerWeek: sessions,
        sessionLength,
        microcycles: Array.from({ length: weeks }, () => ({ intensity: "moderate" as const })),
      };
    });

    const plan: Plan = {
      goal: values.goal,
      mesocycles,
      qualities: values.qualities?.split(",").map((q) => q.trim()).filter(Boolean) ?? [],
    };
    onComplete(plan);
  }

  function onValuesChange() {
    const current = form.getValues();
    setDraft(current as any);
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Training Plan Wizard</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onChange={onValuesChange} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {step === 0 && (
              <section>
                <FormField
                  control={form.control}
                  name="goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMART Goal</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Improve 100m sprint by 0.2s in 12 weeks" {...field} />
                      </FormControl>
                      <FormDescription>Be specific, measurable, achievable, relevant, and time-bound.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
            )}

            {step === 1 && (
              <section className="grid gap-6">
                <FormField
                  control={form.control}
                  name="mesoCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Mesocycles</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={12} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                      <FormDescription>How many mesocycles should there be?</FormDescription>
                    </FormItem>
                  )}
                />

                <div className="rounded-md border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Weeks per Mesocycle</Label>
                      <p className="text-sm text-muted-foreground">Apply one setting to all or customize per mesocycle.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="applyWeeksAll">Apply to all</Label>
                      <FormField control={form.control} name="applyWeeksAll" render={({ field }) => (
                        <Switch id="applyWeeksAll" checked={field.value} onCheckedChange={field.onChange} />
                      )} />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {form.watch("applyWeeksAll") ? (
                      <FormField
                        control={form.control}
                        name="weeksAll"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weeks for all mesocycles</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={12} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="grid gap-3">
                        {mesoNames.map((name, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Label className="w-40">{name}</Label>
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              value={weeksPerMeso[i] ?? 4}
                              onChange={(e) => {
                                const next = [...weeksPerMeso];
                                next[i] = Number(e.target.value);
                                setWeeksPerMeso(next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="grid gap-6">
                <FormField
                  control={form.control}
                  name="subGoals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-goals (Step 3/5)</FormLabel>
                      <FormControl>
                        <SearchableDropdown
                          options={subGoalOptions}
                          placeholder="Select sub-goals..."
                          multiple={true}
                          value={field.value || []}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>Select relevant sub-goals for your training plan.</FormDescription>
                    </FormItem>
                  )}
                />
                
                <div className="rounded-md border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Sessions & Duration</Label>
                      <p className="text-sm text-muted-foreground">Set sessions per week and typical session length.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="applySessionsAll">Apply to all</Label>
                      <FormField control={form.control} name="applySessionsAll" render={({ field }) => (
                        <Switch id="applySessionsAll" checked={field.value} onCheckedChange={field.onChange} />
                      )} />
                    </div>
                  </div>

                  {form.watch("applySessionsAll") ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sessionsAll"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sessions per week</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={14} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sessionLengthAll"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Session length (minutes)</FormLabel>
                            <FormControl>
                              <Input type="number" min={10} max={240} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {mesoNames.map((name, i) => (
                        <div key={i} className="grid md:grid-cols-3 gap-3 items-center">
                          <Label className="truncate">{name}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={14}
                            value={sessionsPerMeso[i] ?? 3}
                            onChange={(e) => {
                              const next = [...sessionsPerMeso];
                              next[i] = Number(e.target.value);
                              setSessionsPerMeso(next);
                            }}
                            placeholder="Sessions/week"
                          />
                          <Input
                            type="number"
                            min={10}
                            max={240}
                            value={sessionLengthPerMeso[i] ?? 60}
                            onChange={(e) => {
                              const next = [...sessionLengthPerMeso];
                              next[i] = Number(e.target.value);
                              setSessionLengthPerMeso(next);
                            }}
                            placeholder="Session length (min)"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium mb-4">Trainable Qualities (Step 4/5)</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Each selected sub-goal shows its associated trainable qualities. You can add or remove qualities as needed.
                    </p>
                  </div>
                  
                  {selectedSubGoals.map((subGoal) => {
                    const qualitiesForSubGoal = trainingData
                      .filter(item => `${item.overarchingGoal} - ${item.subGoal}` === subGoal)
                      .map(item => item.quality);
                    
                    return (
                      <div key={subGoal} className="border rounded-lg p-4 space-y-3">
                        <h5 className="font-medium text-sm">{subGoal}</h5>
                        <div className="space-y-2">
                          {qualitiesForSubGoal.map((quality, index) => (
                            <div key={`${subGoal}-${index}`} className="flex items-center gap-2">
                              <Input
                                value={quality}
                                readOnly
                                className="flex-1 text-sm"
                              />
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  // Remove this quality from the list
                                  const currentQualities = form.getValues("qualities")?.split(",").map(q => q.trim()).filter(Boolean) || [];
                                  const updatedQualities = currentQualities.filter(q => q !== quality);
                                  form.setValue("qualities", updatedQualities.join(", "));
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {selectedSubGoals.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Select sub-goals above to see their associated trainable qualities.
                    </div>
                  )}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <h3 className="text-lg font-medium">Review</h3>
                <p className="text-sm text-muted-foreground">We will generate a plan table with weekly intensity controls per mesocycle.</p>
              </section>
            )}

            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={back} disabled={step === 0}>Back</Button>
              {step < 3 ? (
                <Button type="button" onClick={next}>Next</Button>
              ) : (
                <Button type="submit">Create Plan</Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
