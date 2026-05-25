import { create } from "zustand";

type UiState = {
  /** Drawer mobile (< lg): aberto sob overlay */
  sidebarMobileOpen: boolean;
  commandOpen: boolean;
  setSidebarMobileOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  toggleSidebarMobile: () => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  sidebarMobileOpen: false,
  commandOpen: false,
  setSidebarMobileOpen: (v) => set({ sidebarMobileOpen: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  toggleSidebarMobile: () => set({ sidebarMobileOpen: !get().sidebarMobileOpen }),
}));
