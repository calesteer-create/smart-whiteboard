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
- Fabric.js for the interactive canvas
- KaTeX for scientific mathematics
- IndexedDB for local persistence
- Server-side AI integration (API keys must never be exposed in client code)

## Text canvas (R3)

Choose **نص** or **أضف نصاً**, then click an empty area of the board. Type in the editor; click away or press Ctrl+Enter to finish, or Esc to cancel the current edit (and remove a new item). Select an existing item to edit or delete it; deletion requires confirmation. Text direction is detected automatically.

The board is stored locally in IndexedDB, separately from the title in localStorage. Save status reflects transaction completion. If reading fails, editing remains available in memory but saving is blocked to avoid overwriting an unreadable board; preserve the text before reloading. On a write failure, the current content remains in memory and can be retried. Storage is browser/device-local; clearing site data removes it. Concurrent edits in multiple tabs are not synchronized and can overwrite one another; use one tab at a time. Wait for the saved status before closing or reloading.
