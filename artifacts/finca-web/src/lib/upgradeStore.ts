import { create } from 'zustand';

export type UpgradeResource = "animals" | "employees" | "contacts" | "farms";

interface UpgradeModalState {
  open: boolean;
  resource: UpgradeResource | null;
  limit: number | null;
  openUpgradeModal: (resource: UpgradeResource, limit: number) => void;
  closeUpgradeModal: () => void;
}

export const useUpgradeStore = create<UpgradeModalState>((set) => ({
  open: false,
  resource: null,
  limit: null,
  openUpgradeModal: (resource, limit) => set({ open: true, resource, limit }),
  closeUpgradeModal: () => set({ open: false }),
}));
