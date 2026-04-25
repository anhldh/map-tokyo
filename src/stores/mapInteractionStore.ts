// src/stores/mapInteractionStore.ts
import { create } from "zustand";

interface MapInteractionState {
  keyboardMode: boolean;
  toggleKeyboardMode: () => void;
  setKeyboardMode: (enabled: boolean) => void;
}

export const useMapInteractionStore = create<MapInteractionState>((set) => ({
  keyboardMode: false,
  toggleKeyboardMode: () =>
    set((state) => ({ keyboardMode: !state.keyboardMode })),
  setKeyboardMode: (enabled) => set({ keyboardMode: enabled }),
}));
