// Version the complete document independently of the title and the database schema.
export type TextElement = { id: string; type: "text"; x: number; y: number; text: string };
export type BoardDocument = { version: 1; elements: TextElement[] };

export function emptyBoard(): BoardDocument {
  return { version: 1, elements: [] };
}

// Reject unknown versions and element types rather than silently destroying future data.
export function parseBoard(value: unknown): BoardDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid board");
  const board = value as Record<string, unknown>;
  if (board.version !== 1 || !Array.isArray(board.elements)) throw new Error("Unsupported board version");
  const ids = new Set<string>();
  for (const item of board.elements) {
    if (!item || typeof item !== "object" || item.type !== "text" || typeof item.id !== "string" ||
      !item.id || ids.has(item.id) || typeof item.text !== "string" ||
      typeof item.x !== "number" || !Number.isFinite(item.x) || item.x < 0 ||
      typeof item.y !== "number" || !Number.isFinite(item.y) || item.y < 0) throw new Error("Invalid board element");
    ids.add(item.id);
  }
  return value as BoardDocument;
}
