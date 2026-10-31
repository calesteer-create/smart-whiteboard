# Smart Whiteboard

An Arabic-first, accessible, scientific smart whiteboard built with React, TypeScript, Vite, and KaTeX.

## Product goals

- Arabic RTL and English LTR writing
- Smart text formatting and optional AI-assisted proofreading/rephrasing through a secure server-side API
- Scientific notation and LaTeX math rendering with KaTeX
- Drawing tools, geometric shapes, arrows, grids, colors, and adjustable typography
- Autosave, restore, undo/redo, zoom, and export to PNG/PDF
- Modular architecture, tests, and accessible controls

## Pull request workflow

Each feature is developed in its own branch and pull request. Pull requests are reviewed before merging.

## Planned stack

- React + TypeScript + Vite
- Fabric.js is available for evaluation; R4 uses DOM and SVG without depending on Fabric for document data
- KaTeX for scientific mathematics
- IndexedDB for local persistence
- Server-side AI integration (API keys must never be exposed in client code)

## Free writing (R4)

Click a blank spot and type immediately; no tool selection is required. Double-click an existing text to edit it in place; select it for edit/delete actions. Click away or press Ctrl+Enter to finish, or Esc to cancel the current edit. Text direction is automatic and the native editor supports IME. A stylus draws pressure-sensitive ink directly; touch is not used for ink. Original strokes are retained, with no recognition or AI service.

R3 version 1 documents load into the version 2 text/ink model without changing the stored record until an edit is saved. Unknown versions and malformed documents are never overwritten. The title remains separate.

Production builds register a service worker under the Vite base path. Once installation completes on a secure origin, the app shell is cached for offline reopening; the first visit and installation require a connection. Private browsing, blocked storage, failed installation or eviction can prevent offline use. The service worker does not synchronize data. Physical stylus, palm rejection, and browser offline behaviour should be verified on target devices.

The board is stored locally in IndexedDB, separately from the title in localStorage. Save status reflects transaction completion. If reading fails, editing remains available in memory but saving is blocked to avoid overwriting an unreadable board; preserve the text before reloading. On a write failure, the current content remains in memory and can be retried. Storage is browser/device-local; clearing site data removes it. Concurrent edits in multiple tabs are not synchronized and can overwrite one another; use one tab at a time. Wait for the saved status before closing or reloading.
