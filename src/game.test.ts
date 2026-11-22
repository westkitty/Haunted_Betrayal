// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  act,
  newGame,
  validateSeeds,
  saveGame,
  loadGame,
  isGameSave,
  isSaveImportSizeAllowed,
  MAX_SAVE_IMPORT_BYTES,
  TEMPLATES,
} from "./game";
describe("house rules engine", () => {
  it("generates deterministic connected, non-overlapping room placements", () => {
    expect(validateSeeds(30)).toBe(true);
    let a = newGame(881),
      b = newGame(881);
    for (let i = 0; i < 10; i++) {
      if (a.ap < 1) a = act(a, "end-turn");
      if (b.ap < 1) b = act(b, "end-turn");
      a = act(a, "explore");
      b = act(b, "explore");
      if (a.event) a = act(a, "resolve", a.event.choices[0].label);
      if (b.event) b = act(b, "resolve", b.event.choices[0].label);
    }
    expect(a.rooms.map((r) => [r.template, r.x, r.y])).toEqual(
      b.rooms.map((r) => [r.template, r.x, r.y]),
    );
  });
  it("spends actions for valid discoveries and rejects an invalid move", () => {
    let s = newGame(42);
    const ap = s.ap;
    s = act(s, "move", "no-such-room");
    expect(s.ap).toBe(ap);
    s = act(s, "explore");
    expect(s.rooms).toHaveLength(3);
    expect(s.ap).toBe(2);
    expect(s.rooms[2].links).toContain(s.rooms[0].id);
  });
  it("gives Ada an extra clue on a successful room search", () => {
    const s = newGame(101, "ada");
    s.players[0].stats.insight = 20;
    const searched = act(s, "search");
    expect(searched.clues.some((clue) => clue.startsWith("Ada notes"))).toBe(true);
    expect(searched.rooms.find((room) => room.id === "r0")?.searched).toBe(true);
  });

  it("assigns generated room floors from their room template", () => {
    const observedFloors = new Set<number>([0]);
    for (let seed = 1; seed <= 40; seed++) {
      let s = newGame(seed);
      for (let i = 0; i < 18 && s.phase === "play"; i++) {
        if (s.ap < 1) s = act(s, "end-turn");
        s = act(s, "explore");
        if (s.event) s = act(s, "resolve", s.event.choices[0].label);
      }
      for (const room of s.rooms) {
        const template = TEMPLATES.find((entry) => entry[0] === room.template);
        expect(room.floor).toBe(
          template?.[2] === "upper" ? 1 : template?.[2] === "basement" ? -1 : 0,
        );
        observedFloors.add(room.floor);
      }
    }
    expect(observedFloors.has(1)).toBe(true);
    expect(observedFloors.has(-1)).toBe(true);
  });

  it("allows directional exploration while rejecting occupied or invalid exits", () => {
    let s = newGame(314);
    const current = s.rooms.find(
      (room) => room.id === s.players[s.current].roomId,
    )!;
    const directions = {
      east: [1, 0],
      west: [-1, 0],
      south: [0, 1],
      north: [0, -1],
    } as const;
    const free = Object.entries(directions).find(
      ([, [dx, dy]]) =>
        !s.rooms.some(
          (room) => room.x === current.x + dx && room.y === current.y + dy,
        ),
    )!;
    const ap = s.ap;
    const roomCount = s.rooms.length;
    expect(act(s, "explore", "diagonal").ap).toBe(ap);
    s = act(s, "explore", free[0]);
    expect(s.rooms).toHaveLength(roomCount + 1);
    const revealed = s.rooms[s.rooms.length - 1];
    expect(revealed).toMatchObject({
      x: current.x + free[1][0],
      y: current.y + free[1][1],
    });
    const template = TEMPLATES.find((entry) => entry[0] === revealed.template);
    expect(revealed.floor).toBe(
      template?.[2] === "upper" ? 1 : template?.[2] === "basement" ? -1 : 0,
    );
  });
  it("resolves event decisions and changes fear, flags or clues", () => {
    let s = newGame(24);
    s = act(s, "explore");
    if (s.event) {
      const c = s.event.choices[s.event.choices.length - 1].label;
      s = act(s, "resolve", c);
      expect(s.event).toBeNull();
      expect(s.ap).toBeLessThan(3);
      expect(s.log.length).toBeGreaterThan(1);
    }
  });
  it("keeps the house pressure within the nine-step meter", () => {
    const s = newGame(63);
    s.pressure = 9;
    s.event = {
      id: "test-break",
      title: "A test event",
      text: "The house is tested.",
      choices: [{ label: "Break", detail: "Raise pressure.", kind: "break" }],
    };
    expect(act(s, "resolve", "Break").pressure).toBe(9);
  });

  it("blocks game actions behind encounters and lets past promises echo", () => {
    let s = newGame(44);
    s.flags.push("broken-promise");
    s = act(s, "explore");
    expect(s.event?.text).toContain("refused before");
    const frozen = act(s, "search");
    expect(frozen.rooms).toHaveLength(s.rooms.length);
    expect(frozen.ap).toBe(s.ap);
    s = act(s, "resolve", s.event!.choices[1].label);
    expect(s.event).toBeNull();
  });

  it("saves and restores a versioned expedition", () => {
    const s = newGame(77, "mara");
    expect(saveGame(s)).toBe(true);
    expect(loadGame()?.seed).toBe(77);
    expect(loadGame()?.players[0].id).toBe("mara");
    expect(isGameSave(loadGame())).toBe(true);
    expect(isGameSave({ version: 1, rooms: [], players: [] })).toBe(false);
  });
  it("bounds imported save size before parsing", () => {
    expect(isSaveImportSizeAllowed(0)).toBe(true);
    expect(isSaveImportSizeAllowed(MAX_SAVE_IMPORT_BYTES)).toBe(true);
    expect(isSaveImportSizeAllowed(MAX_SAVE_IMPORT_BYTES + 1)).toBe(false);
    expect(isSaveImportSizeAllowed(-1)).toBe(false);
    expect(isSaveImportSizeAllowed(Number.POSITIVE_INFINITY)).toBe(false);
  });
  it("keeps gameplay alive when browser storage refuses an autosave", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage is blocked", "SecurityError");
      });
    try {
      expect(saveGame(newGame(91))).toBe(false);
    } finally {
      setItem.mockRestore();
    }
  });
  it("accepts real expedition states but rejects corrupt nested save data", () => {
    let s = newGame(24, "mara");
    for (let i = 0; i < 8 && s.phase === "play"; i++) {
      if (s.ap < 1) s = act(s, "end-turn");
      s = act(s, "explore");
      if (s.event) s = act(s, "resolve", s.event.choices[0].label);
      expect(isGameSave(s)).toBe(true);
    }

    const validEvent = {
      ...s,
      event: {
        id: "wall",
        title: "The Wall",
        text: "A voice answers from behind the plaster.",
        choices: [
          {
            label: "Listen",
            detail: "Nerve · difficulty 8.",
            kind: "check",
            difficulty: 8,
            stat: "nerve",
          },
        ],
      },
    };
    expect(isGameSave(validEvent)).toBe(true);

    const missingSetting = { ...s, settings: { reducedMotion: false } };
    localStorage.setItem("htr-save-v1", JSON.stringify(missingSetting));
    expect(loadGame()).toBeNull();
    const brokenGraph = structuredClone(s);
    brokenGraph.rooms[1].links = [];
    const missingPlayerField = {
      ...s,
      players: [{ ...s.players[0], name: undefined }],
    };
    const invalidEvent = {
      ...s,
      event: {
        id: "unexpected",
        title: "Unexpected",
        text: "A damaged imported event.",
        choices: [{ label: "Continue", detail: "", kind: "run-script" }],
      },
    };
    const oversizedLog = { ...s, log: Array.from({ length: 51 }, () => ({ text: "x" })) };

    for (const damaged of [
      missingSetting,
      brokenGraph,
      missingPlayerField,
      invalidEvent,
      oversizedLog,
    ])
      expect(isGameSave(damaged)).toBe(false);
  });
  it("keeps navigation graph references valid through repeated generation", () => {
    let s = newGame(19);
    for (let i = 0; i < 20 && s.phase === "play"; i++) {
      if (s.ap < 1) s = act(s, "end-turn");
      s = act(s, "explore");
      if (s.event) s = act(s, "resolve", s.event.choices[0].label);
    }
    const ids = new Set(s.rooms.map((r) => r.id));
    expect(s.rooms.every((r) => r.links.every((l) => ids.has(l)))).toBe(true);
  });
  it("runs a solo revelation through to a real ending", () => {
    let s = newGame(508);
    for (let i = 0; i < 16 && s.phase === "play"; i++) {
      if (s.ap < 1) s = act(s, "end-turn");
      s = act(s, "explore");
      if (s.event) s = act(s, "resolve", s.event.choices[0].label);
      expect(isGameSave(s)).toBe(true);
    }
    expect(s.phase).toBe("revelation");
    expect(s.scenario).toBe("last-midnight");
    for (let i = 0; i < 3 && s.phase !== "ended"; i++) {
      if (s.ap < 1) s = act(s, "end-turn");
      s = act(s, "revelation-action");
      expect(isGameSave(s)).toBe(true);
    }
    expect(s.phase).toBe("ended");
    expect(s.ending.length).toBeGreaterThan(10);
  });
});
