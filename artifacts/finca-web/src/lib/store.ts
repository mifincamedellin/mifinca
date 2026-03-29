import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarTheme = "tierra" | "bosque" | "oceano" | "vaca";

interface AuthState {
  token: string | null;
  activeFarmId: string | null;
  sidebarTheme: SidebarTheme;
  setToken: (token: string | null) => void;
  setActiveFarmId: (id: string | null) => void;
  setSidebarTheme: (theme: SidebarTheme) => void;
  logout: () => void;
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      activeFarmId: null,
      sidebarTheme: "tierra",
      setToken: (token) => set({ token }),
      setActiveFarmId: (activeFarmId) => set({ activeFarmId }),
      setSidebarTheme: (sidebarTheme) => set({ sidebarTheme }),
      logout: () => set({ token: null, activeFarmId: null }),
    }),
    {
      name: 'finca-storage',
    }
  )
);
