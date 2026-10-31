import { emptyBoard, parseBoard, type BoardDocument } from "./boardModel";

const DB_NAME = "smart-whiteboard";
const STORE = "boards";
const BOARD_KEY = "default";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let blocked = false;
    try { request = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("Database upgrade blocked")); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export async function loadBoard(): Promise<BoardDocument> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(BOARD_KEY);
      let value: unknown;
      request.onsuccess = () => { value = request.result; };
      tx.oncomplete = () => { try { resolve(value === undefined ? emptyBoard() : parseBoard(value)); } catch (error) { reject(error); } };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Read aborted"));
    });
  } finally { db.close(); }
}

export async function saveBoard(board: BoardDocument): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(board, BOARD_KEY);
      // A request success alone does not mean the transaction committed.
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Write aborted"));
    });
  } finally { db.close(); }
}
