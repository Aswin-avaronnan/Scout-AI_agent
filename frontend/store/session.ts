import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SessionState {
  provider: string;
  apiKey: string;
  githubToken: string;
  model: string;
  setProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
  setGithubToken: (token: string) => void;
  setModel: (model: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      provider: 'openai',
      apiKey: '',
      githubToken: '',
      model: 'gpt-4o-mini',
      setProvider: (provider) => set({ provider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setGithubToken: (githubToken) => set({ githubToken }),
      setModel: (model) => set({ model }),
      clearSession: () => set({ provider: 'openai', apiKey: '', githubToken: '', model: '' }),
    }),
    {
      name: 'catalyst-session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
