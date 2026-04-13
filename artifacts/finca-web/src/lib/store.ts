import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency } from './currency';

export type SidebarTheme = "tierra" | "bosque" | "oceano" | "vaca";

interface AuthState {
  token: string | null;
  activeFarmId: string | null;
  sidebarTheme: SidebarTheme;
  currency: Currency;
  setToken: (token: string | null) => void;
  setActiveFarmId: (id: string | null) => void;
  setSidebarTheme: (theme: SidebarTheme) => void;
  setCurrency: (currency: Currency) => void;
  logout: () => void;
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      activeFarmId: null,
      sidebarTheme: "tierra",
      currency: "COP",
      setToken: (token) => set({ token }),
      setActiveFarmId: (activeFarmId) => set({ activeFarmId }),
      setSidebarTheme: (sidebarTheme) => set({ sidebarTheme }),
      setCurrency: (currency) => set({ currency }),
      logout: () => set({ token: null, activeFarmId: null }),
    }),
    {
      name: 'finca-storage',
    }
  )
);
