# The House That Remembers

A procedural haunted-house exploration game built with React, TypeScript, and Three.js. The house is a seeded room graph that grows through turn-based door discoveries; encounters, clues, items, fear, house pressure, and a Revelation are resolved by a deterministic rules engine independent of rendering.

## Run

```sh
npm install
npm run dev
```

`npm test` checks the core rules and generated room graph; `npm run build` type-checks and produces the static web build.

## Play

Choose an explorer and optional numeric seed. Open doors to reveal rooms, search for clues and supplies, resolve the house's encounters, and watch for three omens to trigger the Revelation. Core expedition actions and navigation remain visible during play. Explorer and House detail drawers are opt-in; F1 / ? toggles the additional scene controls.

**Controls:** WASD or arrow keys move relative to camera; hold Shift to hurry; drag to orbit; scroll or +/- to zoom; R recenters; E opens a new door; Q searches; M switches to dollhouse; number keys 1–4 enter a listed connected room. Touch players can use the on-screen directional pad and camera buttons. The live hint strip shows the relevant shortcuts. In the dollhouse, click a connected room to enter it. Walls facing the camera fold down; the dollhouse view lowers all walls for legibility.

The game autosaves locally; export/import expedition saves from the always-visible top navigation. Imports are validated, limited to 1 MiB (1,048,576 bytes), and require confirmation before replacing the current expedition. Upper-floor and basement room templates are placed on their corresponding levels. Ada gains an extra clue on a successful search; Mara automatically succeeds when investigating Watchers and Mourners. Other explorer profile notes describe their actual stat strengths and limitations.

## Current scope

The local single-player vertical slice is playable, with 24 room templates, six explorers, data-driven encounters, items, seeded layout, a solo Revelation, win/loss endings, a journal, and local save/resume. Multiplayer is deliberately marked unavailable: no Firebase project, authenticated action service, or Firestore security rules have been provisioned in this repository, so the interface does not simulate online play. Room visuals are authored procedural modular set dressing rather than externally sourced art assets.
