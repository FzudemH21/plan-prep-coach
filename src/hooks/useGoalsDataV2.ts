import { useState, useEffect } from 'react';
import { GoalsDatabaseV2, GoalV2, GoalInteraction, GoalMethodV2 } from '@/types/goalsV2';

const STORAGE_KEY = 'goals-database-v2';

const defaultDatabase: GoalsDatabaseV2 = {
  goals: [],
  interactions: [],
  goalMethods: [],
  lastUpdated: new Date().toISOString(),
};

export function useGoalsDataV2() {
  const [data, setData] = useState<GoalsDatabaseV2>(defaultDatabase);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } catch (error) {
        console.error('Failed to parse stored goals data:', error);
        setData(defaultDatabase);
      }
    }
    setIsLoading(false);
  }, []);

  const saveData = (newData: GoalsDatabaseV2) => {
    const updatedData = {
      ...newData,
      lastUpdated: new Date().toISOString(),
    };
    setData(updatedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
  };

  // Goal CRUD
  const addGoal = (goal: Omit<GoalV2, 'id' | 'createdAt'>) => {
    const newGoal: GoalV2 = {
      ...goal,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    saveData({
      ...data,
      goals: [...data.goals, newGoal],
    });
    return newGoal;
  };

  const updateGoal = (id: string, updates: Partial<GoalV2>) => {
    const newGoals = data.goals.map((g) =>
      g.id === id ? { ...g, ...updates } : g
    );
    saveData({ ...data, goals: newGoals });
  };

  const deleteGoal = (id: string) => {
    // Also delete related interactions and methods
    const newGoals = data.goals.filter((g) => g.id !== id);
    const newInteractions = data.interactions.filter(
      (i) => i.goalId !== id && i.interactingGoalId !== id
    );
    const newGoalMethods = data.goalMethods.filter((m) => m.goalId !== id);
    saveData({
      ...data,
      goals: newGoals,
      interactions: newInteractions,
      goalMethods: newGoalMethods,
    });
  };

  // Interaction CRUD
  const addInteraction = (goalId: string, interactingGoalId: string) => {
    // Prevent duplicates
    const exists = data.interactions.some(
      (i) => i.goalId === goalId && i.interactingGoalId === interactingGoalId
    );
    if (exists) return;

    const newInteraction: GoalInteraction = {
      id: Date.now().toString(),
      goalId,
      interactingGoalId,
    };
    saveData({
      ...data,
      interactions: [...data.interactions, newInteraction],
    });
  };

  const removeInteraction = (id: string) => {
    const newInteractions = data.interactions.filter((i) => i.id !== id);
    saveData({ ...data, interactions: newInteractions });
  };

  const getInteractionsForGoal = (goalId: string) => {
    return data.interactions.filter((i) => i.goalId === goalId);
  };

  // Goal Method CRUD
  const addGoalMethod = (
    goalId: string,
    methodId: string,
    loadingRecommendations: Record<string, string | number> = {},
    rationale?: string
  ) => {
    // Prevent duplicates
    const exists = data.goalMethods.some(
      (m) => m.goalId === goalId && m.methodId === methodId
    );
    if (exists) return;

    const newMethod: GoalMethodV2 = {
      id: Date.now().toString(),
      goalId,
      methodId,
      loadingRecommendations,
      rationale,
    };
    saveData({
      ...data,
      goalMethods: [...data.goalMethods, newMethod],
    });
  };

  const updateGoalMethod = (id: string, updates: Partial<GoalMethodV2>) => {
    const newMethods = data.goalMethods.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    );
    saveData({ ...data, goalMethods: newMethods });
  };

  const removeGoalMethod = (id: string) => {
    const newMethods = data.goalMethods.filter((m) => m.id !== id);
    saveData({ ...data, goalMethods: newMethods });
  };

  const getMethodsForGoal = (goalId: string) => {
    return data.goalMethods.filter((m) => m.goalId === goalId);
  };

  return {
    data,
    isLoading,
    // Goal operations
    addGoal,
    updateGoal,
    deleteGoal,
    // Interaction operations
    addInteraction,
    removeInteraction,
    getInteractionsForGoal,
    // Method operations
    addGoalMethod,
    updateGoalMethod,
    removeGoalMethod,
    getMethodsForGoal,
    // Raw save for bulk operations
    saveData,
  };
}
