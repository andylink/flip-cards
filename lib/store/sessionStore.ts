import { create } from 'zustand';

type SessionStore = {
  sessionId: string | null;
  score: number;
  streak: number;
  correctCount: number;
  totalAnswered: number;
  revealEnabled: boolean;
  adFree: boolean;
  beginSession: (sessionId: string) => void;
  registerEvaluation: (correct: boolean, scoreDelta: number) => void;
  advanceProgress: () => void;
  setRevealEnabled: (enabled: boolean) => void;
  setAdFree: (adFree: boolean) => void;
  reset: () => void;
};

const defaultState = {
  sessionId: null,
  score: 0,
  streak: 0,
  correctCount: 0,
  totalAnswered: 0,
  revealEnabled: true,
  adFree: false
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...defaultState,
  beginSession: (sessionId) => set({ ...defaultState, sessionId }),
  registerEvaluation: (correct, scoreDelta) =>
    set((state) => ({
      score: state.score + scoreDelta,
      streak: correct ? state.streak + 1 : 0,
      correctCount: state.correctCount + (correct ? 1 : 0)
    })),
  advanceProgress: () =>
    set((state) => ({
      totalAnswered: state.totalAnswered + 1
    })),
  setRevealEnabled: (enabled) => set({ revealEnabled: enabled }),
  setAdFree: (adFree) => set({ adFree }),
  reset: () => set(defaultState)
}));
