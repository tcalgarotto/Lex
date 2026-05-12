import { create } from "zustand";

type State = {
  titleOverride: string | null;
  setTitleOverride: (t: string | null) => void;
};

/**
 * Título da topbar quando a rota precisa de valor dinâmico (caso, peça, PDF…).
 * `null` → usa `matchPathTitle(pathname)`.
 */
export const useAppChromeTitleStore = create<State>((set) => ({
  titleOverride: null,
  setTitleOverride: (t) => set({ titleOverride: t }),
}));
