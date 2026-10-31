// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import App from "./App";
import * as storage from "./boardStorage";
import { BOARD_TITLE_KEY } from "./titleStorage";

let root: Root | null;
let container: HTMLDivElement;
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 15));
async function settle() { await act(async () => { await tick(); await tick(); }); }
async function render() {
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<StrictMode><App /></StrictMode>); await tick(); });
  await settle();
}
function unmount() { if (root) { act(() => root!.unmount()); root = null; container.remove(); } }
function button(text: string) {
  const result = Array.from(container.querySelectorAll("button")).find(el => el.textContent?.trim() === text);
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}
function click(el: Element) { act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 80, clientY: 90 })); }); }
function edit(value: string) {
  const area = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="تحرير النص"]');
  if (!area) throw new Error("Missing editor");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function finish() {
  const area = container.querySelector("textarea")!;
  act(() => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
}
function canvas() {
  const el = container.querySelector('[data-testid="board-canvas"]')!;
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) });
  return el;
}
function status() { return container.querySelector<HTMLElement>('[data-board-status]')!.dataset.boardStatus; }
function textButton(text: string) {
  const el = Array.from(container.querySelectorAll<HTMLButtonElement>(".text-content")).find(b => b.textContent === text);
  if (!el) throw new Error(`Missing text ${text}`);
  return el;
}
async function add(text: string) { click(canvas()); edit(text); finish(); await settle(); }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, indexedDB: new IDBFactory() });
  window.localStorage.clear(); root = null;
});
afterEach(() => { unmount(); vi.restoreAllMocks(); window.localStorage.clear(); });

describe("board text and IndexedDB", () => {
  it("adds multiple Arabic and English items, saves and restores them after reload independently of the title", async () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, JSON.stringify({ version: 1, title: "عنوان" }));
    await render();
    click(button("أضف نصاً"));
    await add("مرحبا بالعالم");
    await add("Hello world");
    expect(container.querySelector(".welcome-card")).toBeNull();
    expect(status()).toBe("saved");
    const data = await storage.loadBoard();
    expect(data.elements.map(item => item.type === "text" ? item.text : "")).toEqual(["مرحبا بالعالم", "Hello world"]);
    expect(data.elements[0]).toMatchObject({ type: "text", x: 80, y: 90 });
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toContain("عنوان");
    unmount(); await render();
    expect(textButton("مرحبا بالعالم").getAttribute("dir")).toBe("auto");
    expect(textButton("Hello world").getAttribute("dir")).toBe("auto");
    expect(container.querySelector<HTMLInputElement>('input[aria-label="عنوان اللوحة"]')!.value).toBe("عنوان");
  });
  it("edits existing text, preserves other items, cancels edits and persists the result", async () => {
    await render(); click(button("نص")); await add("الأول"); await add("Second");
    click(textButton("الأول")); click(button("تحرير")); edit("تعديل"); finish(); await settle();
    click(textButton("Second")); click(button("تحرير")); edit("discard");
    act(() => container.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await settle(); unmount(); await render();
    expect(textButton("تعديل")).toBeTruthy(); expect(textButton("Second")).toBeTruthy();
    expect((await storage.loadBoard()).elements.map(e => e.type === "text" ? e.text : "")).toEqual(["تعديل", "Second"]);
  });
  it("requires selection and confirmation before deletion and persists the deletion", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await render(); click(button("نص")); await add("Keep"); await add("Delete");
    click(textButton("Delete")); click(button("حذف"));
    expect(textButton("Delete")).toBeTruthy();
    click(button("حذف")); await settle();
    expect(confirm).toHaveBeenCalledTimes(2);
    unmount(); await render();
    expect(textButton("Keep")).toBeTruthy();
    expect((await storage.loadBoard()).elements.map(e => e.type === "text" ? e.text : "")).toEqual(["Keep"]);
  });
  it("cancels a newly created item with Escape", async () => {
    await render(); click(button("نص")); click(canvas()); edit("temporary");
    act(() => container.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await settle(); expect((await storage.loadBoard()).elements).toEqual([]);
    expect(container.querySelector(".welcome-card")).toBeTruthy();
  });
  it("keeps edits in memory and never overwrites storage after a read failure", async () => {
    const save = vi.spyOn(storage, "saveBoard");
    vi.spyOn(storage, "loadBoard").mockRejectedValue(new Error("read failed"));
    await render(); expect(status()).toBe("read-error");
    click(button("نص")); await add("ذاكرة فقط");
    expect(textButton("ذاكرة فقط")).toBeTruthy(); expect(status()).toBe("read-error");
    expect(save).not.toHaveBeenCalled();
  });
  it("reports a failed write, retains the content and retries successfully", async () => {
    const save = vi.spyOn(storage, "saveBoard").mockRejectedValue(new Error("quota"));
    await render(); click(button("نص")); await add("Unsaved");
    expect(status()).toBe("save-error"); expect(textButton("Unsaved")).toBeTruthy();
    save.mockRestore(); click(button("إعادة محاولة الحفظ")); await settle();
    expect(status()).toBe("saved"); unmount(); await render(); expect(textButton("Unsaved")).toBeTruthy();
  });
  it("handles IndexedDB open and transaction write failures without losing in-memory text", async () => {
    const open = vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    await render(); expect(status()).toBe("read-error");
    click(button("نص")); await add("read failure"); expect(textButton("read failure")).toBeTruthy();
    unmount(); open.mockRestore(); await render();
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    click(button("نص")); await add("write failure");
    expect(status()).toBe("save-error"); expect(textButton("write failure")).toBeTruthy();
    put.mockRestore(); click(button("إعادة محاولة الحفظ")); await settle();
    expect((await storage.loadBoard()).elements.map(e => e.type === "text" ? e.text : "")).toEqual(["write failure"]);
  });
  it("serializes rapid saves and reports saved only after the newest commit", async () => {
    const pending: Array<() => void> = [];
    const save = vi.spyOn(storage, "saveBoard").mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    await render(); click(button("نص")); click(canvas()); edit("A"); edit("AB"); finish();
    await act(async () => { await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(1); expect(status()).toBe("saving");
    await act(async () => { pending[0](); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(2); expect(status()).toBe("saving");
    await act(async () => { pending[1](); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(3); expect(status()).toBe("saving");
    await act(async () => { pending[2](); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(status()).toBe("saved");
    expect((save.mock.calls[2][0].elements[0] as { text: string }).text).toBe("AB");
  });
  it("does not overwrite unrecognized future documents", async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("smart-whiteboard", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("boards");
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>(resolve => { const tx = db.transaction("boards", "readwrite"); tx.objectStore("boards").put({ version: 99, elements: [] }, "default"); tx.oncomplete = () => resolve(); });
    db.close(); await render(); expect(status()).toBe("read-error");
    click(button("نص")); await add("local"); expect(status()).toBe("read-error");
    await expect(storage.loadBoard()).rejects.toThrow();
  });
});

describe("free writing foundation", () => {
  function pen(type: string, x: number, y: number, pressure: number) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerType: { value: "pen" }, pointerId: { value: 7 }, pressure: { value: pressure } });
    act(() => canvas().dispatchEvent(event));
  }
  it("starts typing at a click when the text tool is on and preserves IME composition", async () => {
    await render(); click(button("نص")); click(canvas());
    const area = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="تحرير النص"]')!;
    expect(document.activeElement).toBe(area);
    edit("مرحبا English");
    act(() => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, isComposing: true, bubbles: true })));
    expect(container.querySelector("textarea")).toBe(area);
    finish(); await settle(); unmount(); await render();
    expect(textButton("مرحبا English")).toBeTruthy();
    expect((await storage.loadBoard()).elements[0]).toMatchObject({ x: 80, y: 90 });
  });
  it("records multiple pressure-sensitive strokes and restores them alongside text", async () => {
    await render(); click(button("نص")); await add("mixed");
    pen("pointerdown", 20, 30, 0.2); pen("pointermove", 35, 40, 0.8); pen("pointerup", 35, 40, 0);
    pen("pointerdown", 70, 80, 0.4); pen("pointerup", 70, 80, 0);
    await settle();
    const saved = await storage.loadBoard();
    expect(saved.elements.map(e => e.type)).toEqual(["text", "ink", "ink"]);
    expect(saved.elements[1]).toMatchObject({ points: [{ x: 20, y: 30, pressure: 0.2 }, { x: 35, y: 40, pressure: 0.8 }] });
    unmount(); await render();
    expect(textButton("mixed")).toBeTruthy();
    expect(container.querySelectorAll(".ink-layer circle")).toHaveLength(2);
  });
  it("keeps ink in memory after a write failure and persists it on retry", async () => {
    const save = vi.spyOn(storage, "saveBoard").mockRejectedValue(new Error("quota"));
    await render(); pen("pointerdown", 12, 13, 0.5); pen("pointercancel", 12, 13, 0);
    await settle(); expect(status()).toBe("save-error");
    expect(container.querySelectorAll(".ink-layer circle")).toHaveLength(1);
    save.mockRestore(); click(button("إعادة محاولة الحفظ")); await settle();
    expect((await storage.loadBoard()).elements[0]).toMatchObject({ type: "ink" });
  });
  it("loads and safely migrates an R3 document on the next save", async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("smart-whiteboard", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("boards");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>(resolve => { const tx = db.transaction("boards", "readwrite"); tx.objectStore("boards").put({ version: 1, elements: [{ id: "old", type: "text", x: 19, y: 28, text: "نص قديم" }] }, "default"); tx.oncomplete = () => resolve(); }); db.close();
    window.localStorage.setItem(BOARD_TITLE_KEY, JSON.stringify({ version: 1, title: "عنوان محفوظ" }));
    await render(); click(textButton("نص قديم")); click(button("تحرير")); edit("نص معدّل"); finish(); await settle();
    const saved = await storage.loadBoard();
    expect(saved.version).toBe(2); expect(saved.elements[0]).toMatchObject({ id: "old", x: 19, y: 28, text: "نص معدّل" });
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toContain("عنوان محفوظ");
  });
});

describe("text tool gating", () => {
  it("does not create text when the text tool is off", async () => {
    await render();
    click(canvas());
    await settle();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector(".welcome-card")).toBeTruthy();
  });

  it("creates text when the text tool is on", async () => {
    await render();
    click(button("نص")); // enable the text tool
    click(canvas());
    const area = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="تحرير النص"]');
    expect(area).toBeTruthy();
    expect(document.activeElement).toBe(area);
  });

  it("edits existing text with the text tool off", async () => {
    await render();
    click(button("نص")); await add("الأول"); // create with the tool on
    click(button("نص"));                     // disable the text tool
    click(textButton("الأول"));               // select existing item without creating text
    click(button("تحرير"));                   // start in-place editing
    edit("معدل");
    finish();
    await settle();
    const content = container.querySelector(".text-content");
    expect(content).toBeTruthy();
    expect(content?.textContent).toBe("معدل");
    expect(container.querySelector('.text-content')?.textContent).not.toBe("الأول");
  });
});
