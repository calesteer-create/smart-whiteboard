// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { BOARD_TITLE_KEY } from "./titleStorage";

// These synchronous R1/R2 tests do not exercise board loading.
vi.mock("./boardStorage", () => ({ loadBoard: () => new Promise(() => {}), saveBoard: vi.fn() }));

// R2: every control whose behaviour is not implemented must be visibly unavailable.
// These tests protect against unfinished actions looking like they work.

const UNAVAILABLE = "غير متاح حاليًا";

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

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((element) => element.title === label || element.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findInput(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll<HTMLInputElement>("label input"))
    .find((element) => element.closest("label")?.textContent?.includes(label));
  if (!input) throw new Error(`Input not found: ${label}`);
  return input;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.localStorage.clear();
  root = null;
});

afterEach(() => {
  unmountApp();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("unavailable actions (R2)", () => {
  it.each([
    ["Undo", "تراجع"],
    ["Redo", "إعادة"],
    ["Export", "تصدير"],
    ["AI assistant", "المساعد الذكي"],
  ])("disables the top-bar %s action and explains it is unavailable", (_name, label) => {
    renderApp();
    const button = findButton(`${label} — ${UNAVAILABLE}`);

    expect(button.disabled).toBe(true);
    expect(button.title).toContain(UNAVAILABLE);
  });

  it.each(["تحديد", "أشكال", "شبكة", "لون", "معادلة", "مساعدة"])(
    "disables the tool-rail button %s",
    (label) => {
      renderApp();
      const button = findButton(`${label} — ${UNAVAILABLE}`);

      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain(label);
    },
  );

  it.each(["اكتب معادلة", "ارسم شكلاً"])(
    "disables the starter action %s",
    (label) => {
      renderApp();
      const button = findButton(`${label} — ${UNAVAILABLE}`);

      expect(button.disabled).toBe(true);
    },
  );

  it("disables zoom controls and keeps the zoom value unchanged on click", () => {
    renderApp();
    const zoomOut = findButton(`تصغير — ${UNAVAILABLE}`);
    const zoomIn = findButton(`تكبير — ${UNAVAILABLE}`);

    expect(zoomOut.disabled).toBe(true);
    expect(zoomIn.disabled).toBe(true);

    act(() => {
      zoomOut.click();
      zoomIn.click();
    });
    expect(container.textContent).toContain("100%");
  });

  it("disables colour and size inputs", () => {
    renderApp();

    expect(findInput("اللون").disabled).toBe(true);
    expect(findInput("الحجم").disabled).toBe(true);
  });

  it("explains that unfinished controls remain unavailable", () => {
    renderApp();
    expect(container.textContent).toContain("بقية الأدوات قيد التطوير");
    expect(container.textContent).toContain("الأزرار المعطّلة غير مكتملة بعد");
  });

  it("keeps the board title editable and saving (R1 is not affected)", () => {
    renderApp();
    const input = container.querySelector<HTMLInputElement>('input[aria-label="عنوان اللوحة"]');
    if (!input) throw new Error("Title input not found");

    expect(input.disabled).toBe(false);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter!.call(input, "عنوان بعد R2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(window.localStorage.getItem(BOARD_TITLE_KEY)).toContain("عنوان بعد R2");
  });
});
