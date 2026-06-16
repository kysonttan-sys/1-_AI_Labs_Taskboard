import { create } from 'zustand';
import { projectsApi, type Project, type CreateProjectInput, type UpdateProjectInput } from '@/lib/api/projects';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectsApi.list();
      set({ projects, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createProject: async (input) => {
    const created = await projectsApi.create(input);
    set((s) => ({ projects: [...s.projects, created] }));
    return created;
  },

  updateProject: async (id, input) => {
    const updated = await projectsApi.update(id, input);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  deleteProject: async (id) => {
    await projectsApi.remove(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },
}));
