export interface KeyResult {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string | null;
  position: number;
  objectiveId: string;
  startDate: string;
  endDate: string;
  cards?: LinkedTask[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkedTask {
  id: string;
  title: string;
  status: string;
  listId: string;
  boardId: string;
  dueDate: string | null;
}

export interface Objective {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  position: number;
  ownerId: string | null;
  projectId: string;
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

export type CreateObjectiveInput = {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  projectId: string;
};

export type UpdateObjectiveInput = Partial<CreateObjectiveInput>;

export type CreateKeyResultInput = {
  title: string;
  target: number;
  current?: number;
  unit?: string;
  startDate: string;
  endDate: string;
};

export type UpdateKeyResultInput = Partial<CreateKeyResultInput>;

export type CreateKeyResultTaskInput = {
  title: string;
  boardId?: string;
  listId?: string;
  newBoardName?: string;
  newListName?: string;
  description?: string;
  dueDate?: string;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const okrsApi = {
  list: () => fetch('/api/okrs').then((r) => handle<Objective[]>(r)),
  get: (id: string) => fetch(`/api/okrs/${id}`).then((r) => handle<Objective>(r)),
  create: (input: CreateObjectiveInput) =>
    fetch('/api/okrs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<Objective>(r)),
  update: (id: string, input: UpdateObjectiveInput) =>
    fetch(`/api/okrs/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<Objective>(r)),
  remove: (id: string) =>
    fetch(`/api/okrs/${id}`, { method: 'DELETE' }).then((r) => handle<{ ok: true }>(r)),
  addKeyResult: (objectiveId: string, input: CreateKeyResultInput) =>
    fetch(`/api/okrs/${objectiveId}/key-results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<KeyResult>(r)),
  updateKeyResult: (objectiveId: string, krId: string, input: UpdateKeyResultInput) =>
    fetch(`/api/okrs/${objectiveId}/key-results/${krId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<KeyResult>(r)),
  removeKeyResult: (objectiveId: string, krId: string) =>
    fetch(`/api/okrs/${objectiveId}/key-results/${krId}`, { method: 'DELETE' }).then(
      (r) => handle<{ ok: true }>(r)
    ),
  reorderKeyResults: (objectiveId: string, krIds: string[]) =>
    fetch(`/api/okrs/${objectiveId}/key-results/reorder`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ krIds }),
    }).then((r) => handle<KeyResult[]>(r)),
  addKeyResultTask: (objectiveId: string, krId: string, input: CreateKeyResultTaskInput) =>
    fetch(`/api/okrs/${objectiveId}/key-results/${krId}/cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<{ card: LinkedTask }>(r)),
};
