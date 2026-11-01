// The persisted document is independent of the rendering implementation.
export type TextElement = { id: string; type: "text"; x: number; y: number; text: string };
export type InkPoint = { x: number; y: number; pressure: number };
export type InkElement = { id: string; type: "ink"; points: InkPoint[] };
export type BoardElement = TextElement | InkElement;
export type BoardDocument = { version: 2; elements: BoardElement[] };

export function emptyBoard(): BoardDocument { return { version: 2, elements: [] }; }

export function parseBoard(value: unknown): BoardDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid board");
  const board = value as Record<string, unknown>;
  if ((board.version !== 1 && board.version !== 2) || !Array.isArray(board.elements)) throw new Error("Unsupported board version");
  const ids = new Set<string>();
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
  for (const item of board.elements) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error("Invalid board element");
    ids.add(item.id);
    if (item.type === "text") {
      if (!finite(item.x) || !finite(item.y) || typeof item.text !== "string") throw new Error("Invalid text");
    } else if (board.version === 2 && item.type === "ink") {
      if (!Array.isArray(item.points) || !item.points.length || item.points.some((p: InkPoint) => !p || !finite(p.x) || !finite(p.y) || typeof p.pressure !== "number" || !Number.isFinite(p.pressure) || p.pressure < 0 || p.pressure > 1)) throw new Error("Invalid ink");
    } else throw new Error("Unsupported board element");
  }
  // Migration is in memory; the old record is only replaced on a successful edit/save.
  return { version: 2, elements: board.elements as BoardElement[] };
}
