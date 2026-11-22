# The House That Remembers

A procedural haunted-house exploration game built with React, TypeScript, and Three.js. The house is a seeded room graph that grows through turn-based door discoveries; encounters, clues, items, fear, house pressure, and a Revelation are resolved by a deterministic rules engine independent of rendering.

## Run

```sh
npm install
npm run dev
```

`npm test` checks the core rules and generated room graph; `npm run build` type-checks and produces the static web build.

## Play

Choose an explorer and optional numeric seed. Open doors to reveal rooms, search for clues and supplies, resolve the house's encounters, and watch for three omens to trigger the Revelation. Use the dollhouse view to survey the growing connected map, or stay in room view and rotate the camera. The game autosaves locally; export/import expedition saves from the top bar.

## Current scope

The local single-player vertical slice is playable, with 24 room templates, six explorers, data-driven encounters, items, seeded layout, a solo Revelation, win/loss endings, a journal, and local save/resume. Multiplayer is deliberately marked unavailable: no Firebase project, authenticated action service, or Firestore security rules have been provisioned in this repository, so the interface does not simulate online play. Room visuals are authored procedural modular set dressing rather than externally sourced art assets.
