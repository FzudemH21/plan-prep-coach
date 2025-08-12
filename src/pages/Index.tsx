import React, { useState } from "react";
import PlannerWizard from "@/components/planner/PlannerWizard";
import PlanTable from "@/components/planner/PlanTable";
import { Plan } from "@/features/planner/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const Index = () => {
  const [plan, setPlan] = useLocalStorage<Plan | null>("training-plan", null);
  const [editingSetup, setEditingSetup] = useState(!plan);

  return (
    <main className="min-h-screen bg-background py-10">
      <header className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold">Strength & Conditioning Planner</h1>
        <p className="text-muted-foreground mt-1">Guided setup → dynamic microcycle intensities. Desktop-like web app now; installable later.</p>
      </header>

      <section className="mt-8 px-4">
        {editingSetup || !plan ? (
          <PlannerWizard onComplete={(p) => { setPlan(p); setEditingSetup(false); }} initial={plan ?? undefined} />
        ) : (
          <PlanTable plan={plan} onChange={setPlan} onEditSetup={() => setEditingSetup(true)} />
        )}
      </section>
    </main>
  );
};

export default Index;

