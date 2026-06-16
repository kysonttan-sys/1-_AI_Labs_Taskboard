export function getIo(): any {
  return (globalThis as any).io;
}

export function broadcastToBoard(
  boardId: string,
  event: string,
  payload: Record<string, unknown>,
  senderId?: string
) {
  const io = getIo();
  if (!io) return;
  if (senderId) {
    io.to(`board:${boardId}`).except(senderId).emit(event, payload);
  } else {
    io.to(`board:${boardId}`).emit(event, payload);
  }
}
