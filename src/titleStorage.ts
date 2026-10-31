export const BOARD_TITLE_KEY = "smart-whiteboard:board-title:v1";
export const DEFAULT_BOARD_TITLE = "مساحة جديدة";

type LoadedTitle =
  | { status: "found"; title: string }
  | { status: "missing" | "invalid" | "unavailable" };

export function loadBoardTitle(): LoadedTitle {
  let stored: string | null;

  try {
    stored = window.localStorage.getItem(BOARD_TITLE_KEY);
  } catch {
    return { status: "unavailable" };
  }

  if (stored === null) return { status: "missing" };

  try {
    const value: unknown = JSON.parse(stored);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { status: "invalid" };
    }

    const record = value as Record<string, unknown>;
    if (record.version !== 1 || typeof record.title !== "string") {
      return { status: "invalid" };
    }

    return { status: "found", title: record.title };
  } catch {
    return { status: "invalid" };
  }
}

export function saveBoardTitle(title: string): boolean {
  try {
    window.localStorage.setItem(
      BOARD_TITLE_KEY,
      JSON.stringify({ version: 1, title }),
    );
    return true;
  } catch {
    return false;
  }
}

export function isBoardTitleStorageEvent(event: StorageEvent): boolean {
  if (event.key !== BOARD_TITLE_KEY && event.key !== null) return false;

  try {
    return event.storageArea === window.localStorage;
  } catch {
    return false;
  }
}
