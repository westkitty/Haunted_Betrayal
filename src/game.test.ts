// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  act,
  newGame,
  validateSeeds,
  saveGame,
  loadGame,
  isGameSave,
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
  it("blocks game actions behind encounters and lets past promises echo", () => {
    let s = newGame(44);
    s = act(s, "explore");
    expect(s.event).not.toBeNull();
    const frozen = act(s, "search");
    expect(frozen.rooms).toHaveLength(s.rooms.length);
    expect(frozen.ap).toBe(s.ap);
    s = act(s, "resolve", s.event!.choices[1].label);
    s.flags.push("broken-promise");
    s = act(s, "explore");
    expect(s.event?.text).toContain("refused before");
  });

  it("saves and restores a versioned expedition", () => {
    const s = newGame(77, "mara");
    saveGame(s);
    expect(loadGame()?.seed).toBe(77);
    expect(loadGame()?.players[0].id).toBe("mara");
    expect(isGameSave(loadGame())).toBe(true);
    expect(isGameSave({ version: 1, rooms: [], players: [] })).toBe(false);
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
    }
    expect(s.phase).toBe("revelation");
    expect(s.scenario).toBe("last-midnight");
    for (let i = 0; i < 3 && s.phase !== "ended"; i++) {
      if (s.ap < 1) s = act(s, "end-turn");
      s = act(s, "revelation-action");
    }
    expect(s.phase).toBe("ended");
    expect(s.ending.length).toBeGreaterThan(10);
  });
});
