export function reorder<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export function cuid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}