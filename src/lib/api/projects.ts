export interface Project {
  id: string;
  name: string;
  description: string | null;
  aiContext: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateProjectInput = {
  name: string;
  description?: string;
  aiContext?: string;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const projectsApi = {
  list: () => fetch('/api/projects').then((r) => handle<Project[]>(r)),
  create: (input: CreateProjectInput) =>
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<Project>(r)),
  update: (id: string, input: UpdateProjectInput) =>
    fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<Project>(r)),
  remove: (id: string) =>
    fetch(`/api/projects/${id}`, { method: 'DELETE' }).then((r) => handle<{ ok: true }>(r)),
};
