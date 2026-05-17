import { create } from 'zustand';
import api from '../lib/api';

interface CycleState {
  activeCycle: any | null;
  activeQuarter: 'q1' | 'q2' | 'q3' | 'q4' | null;
  isGoalSettingOpen: boolean;
  fetchActiveCycle: () => Promise<void>;
}

const useCycleStore = create<CycleState>((set) => ({
  activeCycle: null,
  activeQuarter: null,
  isGoalSettingOpen: false,

  fetchActiveCycle: async () => {
    try {
      const { data } = await api.get('/api/cycles/active');
      const cycle = data.cycle;
      if (!cycle) return;

      const now = new Date();
      const goalStart = new Date(cycle.goal_setting_opens);
      const goalEnd = new Date(cycle.goal_setting_closes);
      const isOpen = now >= goalStart && now <= goalEnd;

      let activeQ = null;
      for (const q of ['q1', 'q2', 'q3', 'q4']) {
        const start = new Date(cycle[`${q}_opens`]);
        const end = new Date(cycle[`${q}_closes`]);
        if (now >= start && now <= end) {
          activeQ = q as any;
          break;
        }
      }

      set({
        activeCycle: cycle,
        isGoalSettingOpen: isOpen,
        activeQuarter: activeQ
      });
    } catch {
      // Graceful fallback for demo
      set({
        activeCycle: { name: 'Demo Cycle' },
        isGoalSettingOpen: true,
        activeQuarter: 'q1'
      });
    }
  }
}));

export default useCycleStore;
