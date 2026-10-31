// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { BOARD_TITLE_KEY, DEFAULT_BOARD_TITLE } from "./titleStorage";

const storedTitle = (title: string) => JSON.stringify({ version: 1, title });

let container: HTMLDivElement;
let root: Root | null;

function renderApp() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<StrictMode><App /></StrictMode>);
  });
}

function unmountApp() {
  if (root !== null) {
    act(() => root!.unmount());
    root = null;
    container.remove();
  }
}

function titleInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="عنوان اللوحة"]');
  if (!input) throw new Error("Title input not found");
  return input;
}

function titleStatus(): HTMLElement {
  const status = container.querySelector<HTMLElement>('[role="status"]');
  if (!status) throw new Error("Title status not found");
  return status;
}

function changeTitle(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Input value setter not found");
  act(() => {
    setter.call(titleInput(), value);
    titleInput().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function finishSaving() {
  act(() => vi.runOnlyPendingTimers());
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.localStorage.clear();
  vi.useFakeTimers();
  root = null;
});

afterEach(() => {
  unmountApp();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("board title persistence", () => {
  it("uses the default title without claiming or performing a save on first visit", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderApp();

    expect(titleInput().value).toBe(DEFAULT_BOARD_TITLE);
    expect(titleStatus().textContent).toContain("العنوان غير محفوظ");
    expect(titleStatus().dataset.saveStatus).toBe("unsaved");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("restores a saved title without overwriting it with the default, even in StrictMode", () => {
    const existing = storedTitle("لوحة موجودة");
    window.localStorage.setItem(BOARD_TITLE_KEY, existing);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderApp();

    expect(titleInput().value).toBe("لوحة موجودة");
    expect(titleStatus().textContent).toContain("العنوان محفوظ محليًا");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(existing);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("saves a changed title immediately and shows saving before saved", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderApp();
    changeTitle("لوحة المشاريع");

    expect(titleInput().value).toBe("لوحة المشاريع");
    expect(titleStatus().dataset.saveStatus).toBe("saving");
    expect(titleStatus().textContent).toContain("جارٍ حفظ العنوان");
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(BOARD_TITLE_KEY, storedTitle("لوحة المشاريع"));
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(storedTitle("لوحة المشاريع"));

    finishSaving();
    expect(titleStatus().dataset.saveStatus).toBe("saved");
    expect(titleStatus().textContent).toContain("العنوان محفوظ محليًا");
  });

  it("restores the changed title after a simulated reload, including before the status timer runs", () => {
    renderApp();
    changeTitle("عنوان محفوظ");
    unmountApp();
    renderApp();

    expect(titleInput().value).toBe("عنوان محفوظ");
    expect(titleStatus().dataset.saveStatus).toBe("saved");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(storedTitle("عنوان محفوظ"));
  });

  it("reports a read failure without overwriting a title that may already be saved", () => {
    const existing = storedTitle("عنوان سابق");
    window.localStorage.setItem(BOARD_TITLE_KEY, existing);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderApp();

    expect(titleInput().value).toBe(DEFAULT_BOARD_TITLE);
    expect(titleStatus().dataset.saveStatus).toBe("read-error");
    expect(titleStatus().textContent).toContain("تعذّر قراءة العنوان");
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(existing);
  });

  it("keeps the edited title and reports a write failure without claiming it was saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    renderApp();
    changeTitle("عنوان لا يجب فقده في الصفحة");
    finishSaving();

    expect(titleInput().value).toBe("عنوان لا يجب فقده في الصفحة");
    expect(titleStatus().dataset.saveStatus).toBe("save-error");
    expect(titleStatus().textContent).toContain("تعذّر حفظ العنوان");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBeNull();
  });

  it("handles a blocked localStorage getter for both reads and writes", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    renderApp();
    expect(titleInput().value).toBe(DEFAULT_BOARD_TITLE);
    expect(titleStatus().dataset.saveStatus).toBe("read-error");

    changeTitle("عنوان في الذاكرة");
    finishSaving();
    expect(titleInput().value).toBe("عنوان في الذاكرة");
    expect(titleStatus().dataset.saveStatus).toBe("save-error");
  });

  it.each([
    ["invalid JSON", "not-json"],
    ["a JSON string", '"not an object"'],
    ["a non-string title", JSON.stringify({ version: 1, title: 42 })],
    ["an unknown version", JSON.stringify({ version: 2, title: "future title" })],
  ])("handles %s without overwriting it", (_description, value) => {
    window.localStorage.setItem(BOARD_TITLE_KEY, value);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderApp();

    expect(titleInput().value).toBe(DEFAULT_BOARD_TITLE);
    expect(titleStatus().dataset.saveStatus).toBe("read-error");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(value);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("restores an intentionally empty saved title", () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle(""));
    renderApp();

    expect(titleInput().value).toBe("");
    expect(titleStatus().dataset.saveStatus).toBe("saved");
  });

  it("does not write when an input event leaves the title unchanged", () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle("نفس العنوان"));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderApp();

    changeTitle("نفس العنوان");
    finishSaving();
    expect(setItem).not.toHaveBeenCalled();
    expect(titleStatus().dataset.saveStatus).toBe("saved");
  });

  it("does not let a previous failed write replace the result of a later successful edit", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    renderApp();
    changeTitle("الأول");
    changeTitle("الثاني");
    finishSaving();

    expect(titleInput().value).toBe("الثاني");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(storedTitle("الثاني"));
    expect(titleStatus().dataset.saveStatus).toBe("saved");
  });

  it("preserves the current title and stops claiming it is saved after another tab changes it", () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle("عنواني"));
    renderApp();
    const otherTitle = storedTitle("عنوان آخر");
    window.localStorage.setItem(BOARD_TITLE_KEY, otherTitle);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: BOARD_TITLE_KEY,
        newValue: otherTitle,
        storageArea: window.localStorage,
      }));
    });

    expect(titleInput().value).toBe("عنواني");
    expect(titleStatus().dataset.saveStatus).toBe("changed-elsewhere");
    expect(titleStatus().textContent).toContain("عنوانك غير محفوظ");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe(otherTitle);
  });

  it("does not let a pending save status hide a later change from another tab", () => {
    renderApp();
    changeTitle("عنواني");
    expect(titleStatus().dataset.saveStatus).toBe("saving");
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle("عنوان آخر"));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: BOARD_TITLE_KEY,
        storageArea: window.localStorage,
      }));
    });
    finishSaving();

    expect(titleInput().value).toBe("عنواني");
    expect(titleStatus().dataset.saveStatus).toBe("changed-elsewhere");
  });

  it("reports an external clear without changing the current title", () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle("عنواني"));
    renderApp();
    window.localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: null,
        storageArea: window.localStorage,
      }));
    });

    expect(titleInput().value).toBe("عنواني");
    expect(titleStatus().dataset.saveStatus).toBe("changed-elsewhere");
  });

  it("reports invalid data written in another tab without discarding the current title", () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle("عنواني"));
    renderApp();
    window.localStorage.setItem(BOARD_TITLE_KEY, "invalid-json");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: BOARD_TITLE_KEY,
        storageArea: window.localStorage,
      }));
    });

    expect(titleInput().value).toBe("عنواني");
    expect(titleStatus().dataset.saveStatus).toBe("read-error");
    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toBe("invalid-json");
  });

  it("ignores unrelated localStorage and sessionStorage events", () => {
    window.localStorage.setItem(BOARD_TITLE_KEY, storedTitle("عنواني"));
    renderApp();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "unrelated-key",
        storageArea: window.localStorage,
      }));
      window.dispatchEvent(new StorageEvent("storage", {
        key: BOARD_TITLE_KEY,
        storageArea: window.sessionStorage,
      }));
    });

    expect(titleInput().value).toBe("عنواني");
    expect(titleStatus().dataset.saveStatus).toBe("saved");
  });
});
