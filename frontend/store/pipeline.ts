import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Candidate {
  id: string;
  username: string;
  profile: any;
  top_languages: string[];
  github_found?: boolean;
  match_score: number;
  reasoning: string;
  skill_match: string[];
  missing_skills: string[];
  stage: 'sourced' | 'scored' | 'simulated' | 'shortlisted';
  simulation_status?: 'pending' | 'simulating' | 'completed' | 'failed';
  simulation_transcript?: { turn_index: number; speaker: 'interviewer' | 'candidate'; text: string }[];
  simulation_eval?: {
    technical_depth: number;
    communication: number;
    red_flags: string[];
    hire_recommendation: string;
    simulation_score: number;
  } | null;
  combined_score?: number;
}

interface PipelineState {
  job: any | null;
  candidates: Candidate[];
  matchWeight: number;
  simWeight: number;
  setPipelineData: (data: any) => void;
  moveCandidate: (id: string, stage: Candidate['stage']) => void;
  updateCandidateSim: (id: string, update: Partial<Candidate>) => void;
  setWeights: (matchWeight: number, simWeight: number) => void;
  clearPipeline: () => void;
}

const calculateCombined = (c: Candidate, matchWeight: number, simWeight: number): number => {
  const match = c.match_score || 0;
  const sim = c.simulation_eval?.simulation_score;
  if (sim !== undefined && sim !== null) {
    return Math.round((match * matchWeight + sim * simWeight) / 100);
  }
  return match;
};

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set) => ({
      job: null,
      candidates: [],
      matchWeight: 60,
      simWeight: 40,
      setPipelineData: (data) => {
        const formattedCandidates = data.candidates
          .filter((c: any) => !c.error)
          .map((c: any) => {
            const candidateBase = {
              ...c,
              id: c.username,
              stage: 'scored',
              simulation_status: 'pending',
              simulation_transcript: [],
              simulation_eval: null,
            };
            return {
              ...candidateBase,
              combined_score: calculateCombined(candidateBase as Candidate, 60, 40)
            };
          });
        set({ job: data.job, candidates: formattedCandidates });
      },
      moveCandidate: (id, stage) => set((state) => ({
        candidates: state.candidates.map(c => c.id === id ? { ...c, stage } : c)
      })),
      updateCandidateSim: (id, update) => set((state) => ({
        candidates: state.candidates.map(c => {
          if (c.id !== id) return c;
          const merged = { ...c, ...update };
          return {
            ...merged,
            combined_score: calculateCombined(merged, state.matchWeight, state.simWeight)
          };
        })
      })),
      setWeights: (matchWeight, simWeight) => set((state) => ({
        matchWeight,
        simWeight,
        candidates: state.candidates.map(c => ({
          ...c,
          combined_score: calculateCombined(c, matchWeight, simWeight)
        }))
      })),
      clearPipeline: () => set({ job: null, candidates: [], matchWeight: 60, simWeight: 40 }),
    }),
    {
      name: 'catalyst-pipeline',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);