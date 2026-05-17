import { create } from 'zustand';
import api from '../lib/api';
import type { Goal } from '../app/types';

interface GoalState {
  goals: Goal[];
  isLoading: boolean;
  error: string | null;

  fetchGoals: () => Promise<void>;
  createGoal: (goal: Partial<Goal>) => Promise<{ success: boolean; error?: string }>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<{ success: boolean; error?: string }>;
  deleteGoal: (id: string) => Promise<{ success: boolean; error?: string }>;
  submitGoalSheet: () => Promise<{ success: boolean; error?: string }>;
}

const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  isLoading: false,
  error: null,

  fetchGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/api/goals/my');
      set({ goals: data.goals || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to fetch goals', isLoading: false });
      throw err;
    }
  },

  createGoal: async (goal) => {
    try {
      const { data } = await api.post('/api/goals', goal);
      set(state => ({ goals: [...state.goals, data.goal] }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || 'Failed to create goal' };
    }
  },

  updateGoal: async (id, updates) => {
    try {
      const { data } = await api.put(`/api/goals/${id}`, updates);
      set(state => ({
        goals: state.goals.map(g => (g.id === id ? data.goal : g))
      }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || 'Failed to update goal' };
    }
  },

  deleteGoal: async (id) => {
    try {
      await api.delete(`/api/goals/${id}`);
      set(state => ({
        goals: state.goals.filter(g => g.id !== id)
      }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || 'Failed to delete goal' };
    }
  },

  submitGoalSheet: async () => {
    try {
      await api.post('/api/goals/submit');
      // Refetch to get updated statuses
      await get().fetchGoals();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || 'Failed to submit goals' };
    }
  }
}));

export default useGoalStore;
