import { create } from "zustand";

type UiState = {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
}));
