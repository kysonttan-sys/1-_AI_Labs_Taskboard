export interface BoardWithLists {
  id: string;
  name: string;
  lists: { id: string; title: string }[];
}

export const boardsApi = {
  listByProject: (projectId: string) =>
    fetch(`/api/projects/${projectId}/boards`).then(async (r) => {
      if (!r.ok) throw new Error('Failed to load boards');
      return r.json() as Promise<BoardWithLists[]>;
    }),
};
