import { create } from "zustand";

type UiState = {
  sidebarCollapsed: boolean;
  /** Drawer mobile (< lg): aberto sob overlay */
  sidebarMobileOpen: boolean;
  commandOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarMobileOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarMobile: () => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  commandOpen: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarMobileOpen: (v) => set({ sidebarMobileOpen: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  toggleSidebarMobile: () => set({ sidebarMobileOpen: !get().sidebarMobileOpen }),
}));
