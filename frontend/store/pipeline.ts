import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Candidate {
  id: string;
  username: string;
  profile: any;
  top_languages: string[];
  match_score: number;
  reasoning: string;
  skill_match: string[];
  missing_skills: string[];
  stage: 'sourced' | 'scored' | 'simulated' | 'shortlisted';
}

interface PipelineState {
  job: any | null;
  candidates: Candidate[];
  setPipelineData: (data: any) => void;
  moveCandidate: (id: string, stage: Candidate['stage']) => void;
  clearPipeline: () => void;
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set) => ({
      job: null,
      candidates: [],
      setPipelineData: (data) => {
        const formattedCandidates = data.candidates.map((c: any) => ({
          ...c,
          id: c.username, // Use username as ID for now
          stage: 'scored'
        }));
        set({ job: data.job, candidates: formattedCandidates });
      },
      moveCandidate: (id, stage) => set((state) => ({
        candidates: state.candidates.map(c => c.id === id ? { ...c, stage } : c)
      })),
      clearPipeline: () => set({ job: null, candidates: [] }),
    }),
    {
      name: 'catalyst-pipeline',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
