import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  activeFarmId: string | null;
  setToken: (token: string | null) => void;
  setActiveFarmId: (id: string | null) => void;
  logout: () => void;
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      activeFarmId: null,
      setToken: (token) => set({ token }),
      setActiveFarmId: (activeFarmId) => set({ activeFarmId }),
      logout: () => set({ token: null, activeFarmId: null }),
    }),
    {
      name: 'finca-storage',
    }
  )
);
