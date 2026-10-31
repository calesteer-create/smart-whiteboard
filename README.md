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
