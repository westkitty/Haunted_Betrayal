export type Stat = "body" | "grace" | "insight" | "nerve";
export type Phase = "menu" | "select" | "play" | "revelation" | "ended";
export type Room = {
  id: string;
  template: string;
  name: string;
  x: number;
  y: number;
  floor: number;
  links: string[];
  searched: boolean;
  secret: boolean;
  eventDone: boolean;
  haunted?: string;
};
export type Character = {
  id: string;
  name: string;
  role: string;
  bio: string;
  stats: Record<Stat, number>;
  passive: string;
  weakness: string;
  hp: number;
  fear: number;
  items: string[];
  roomId: string;
};
export type LogEntry = {
  text: string;
  kind?: "event" | "roll" | "discovery" | "omen";
};
export type GameState = {
  version: 1;
  seed: number;
  rng: number;
  phase: Phase;
  rooms: Room[];
  players: Character[];
  current: number;
  ap: number;
  turn: number;
  pressure: number;
  attention: number;
  omens: number;
  scenario: string;
  objective: string;
  anchor: string | null;
  clues: string[];
  flags: string[];
  log: LogEntry[];
  event: null | {
    id: string;
    title: string;
    text: string;
    choices: {
      label: string;
      detail: string;
      kind: string;
      difficulty?: number;
      stat?: Stat;
    }[];
  };
  lastRoll: string;
  ending: string;
  mode: "explore" | "dollhouse";
  settings: { reducedMotion: boolean; captions: boolean };
};
export const CHARACTERS: Omit<Character, "roomId">[] = [
  {
    id: "ada",
    name: "Ada Vale",
    role: "The Archivist",
    bio: "A meticulous cataloguer tracing a missing folio to the estate.",
    stats: { body: 1, grace: 2, insight: 4, nerve: 2 },
    passive: "Once per room, a search reveals an extra clue.",
    weakness: "Physical checks are made at −1.",
    hp: 4,
    fear: 0,
    items: ["Brass Lantern"],
  },
  {
    id: "mara",
    name: "Mara Voss",
    role: "The Medium",
    bio: "She came to return a voice that has followed her for years.",
    stats: { body: 2, grace: 2, insight: 3, nerve: 3 },
    passive: "Sees spirit traces before they manifest.",
    weakness: "Ghosts notice her at a distance.",
    hp: 4,
    fear: 0,
    items: ["Threadbare Charm"],
  },
  {
    id: "eli",
    name: "Elias Rook",
    role: "The Locksmith",
    bio: "A quiet specialist hired to open the house’s sealed rooms.",
    stats: { body: 2, grace: 4, insight: 2, nerve: 1 },
    passive: "Locks and mechanisms yield to a Grace check once per room.",
    weakness: "The house can unsettle his confidence.",
    hp: 4,
    fear: 0,
    items: ["Tension Wrench"],
  },
  {
    id: "iona",
    name: "Dr. Iona Bell",
    role: "The Physician",
    bio: "The family doctor vanished here; she has inherited his notes.",
    stats: { body: 3, grace: 1, insight: 3, nerve: 2 },
    passive: "Can tend one injury with a Search action.",
    weakness: "Her old casebook contains a dangerous name.",
    hp: 4,
    fear: 0,
    items: ["Field Kit"],
  },
  {
    id: "silas",
    name: "Silas Quill",
    role: "The Illusionist",
    bio: "A stage magician seeking the trick behind a vanished audience.",
    stats: { body: 1, grace: 4, insight: 2, nerve: 2 },
    passive: "May evade one supernatural consequence per expedition.",
    weakness: "Reflections can imitate his gestures.",
    hp: 4,
    fear: 0,
    items: ["Silver Coin"],
  },
  {
    id: "theo",
    name: "Theo Ashcombe",
    role: "The Heir",
    bio: "The last heir returns to learn why every family portrait is turned away.",
    stats: { body: 2, grace: 2, insight: 3, nerve: 3 },
    passive: "Recognizes family marks and hidden architecture.",
    weakness: "The house knows his name.",
    hp: 4,
    fear: 0,
    items: ["Estate Key"],
  },
];
export const TEMPLATES = [
  ["library", "Candlelit Library", "ground"],
  ["nursery", "Abandoned Nursery", "upper"],
  ["conservatory", "Glass Conservatory", "ground"],
  ["gallery", "Portrait Gallery", "upper"],
  ["music", "Music Room", "ground"],
  ["ballroom", "Dusty Ballroom", "ground"],
  ["bedroom", "Master Bedroom", "upper"],
  ["chapel", "Forgotten Chapel", "ground"],
  ["cellar", "Wine Cellar", "basement"],
  ["boiler", "Boiler Room", "basement"],
  ["laboratory", "Sealed Laboratory", "basement"],
  ["study", "Clockwork Study", "upper"],
  ["dining", "Abandoned Dining Room", "ground"],
  ["flooded", "Flooded Basement", "basement"],
  ["mirror", "Mirror Chamber", "upper"],
  ["parlor", "Funeral Parlor", "ground"],
  ["archive", "Secret Archive", "basement"],
  ["passage", "Hidden Passage", "basement"],
  ["vault", "Locked Vault", "basement"],
  ["impossible", "The Room That Should Not Exist", "secret"],
  ["observatory", "Attic Observatory", "upper"],
  ["servants", "Servants’ Quarters", "upper"],
  ["taxidermy", "Taxidermy Room", "ground"],
  ["stair", "Grand Staircase", "ground"],
] as const;
const ITEMS = [
  "Brass Lantern",
  "Threadbare Charm",
  "Tension Wrench",
  "Field Kit",
  "Silver Coin",
  "Estate Key",
  "Salt Packet",
  "Pocket Watch",
  "Music Box",
  "Blackthorn Cane",
  "Candle Stub",
  "Glass Eye",
  "Whispering Compass",
  "Iron Clapper",
  "Ashwood Mirror",
  "Red Thread",
];
const EVENT_DEFS: {
  id: string;
  title: string;
  text: string;
  choices: {
    label: string;
    detail: string;
    kind: string;
    difficulty?: number;
    stat?: Stat;
  }[];
}[] = [
  {
    id: "place",
    title: "The Extra Place Setting",
    text: "One more setting than there are explorers. A chair draws itself back from the table.",
    choices: [
      {
        label: "Inspect the place setting",
        detail: "Insight · difficulty 8. Learn what is expected.",
        kind: "check",
        stat: "insight",
      },
      {
        label: "Sit in the chair",
        detail: "Nerve · difficulty 9. Accept the invitation.",
        kind: "sit",
        stat: "nerve",
      },
      {
        label: "Refuse the invitation",
        detail: "Leave a promise in the house’s memory.",
        kind: "refuse",
      },
    ],
  },
  {
    id: "wall",
    title: "The Voice Behind the Wall",
    text: "A familiar voice calls from inside the sealed plaster: “I’m here. Let me out.”",
    choices: [
      {
        label: "Answer the voice",
        detail: "Nerve · difficulty 8. Its reply may be useful.",
        kind: "check",
        stat: "nerve",
      },
      {
        label: "Search the seams",
        detail: "Insight · difficulty 7. Find the hidden catch.",
        kind: "secret",
        stat: "insight",
      },
      {
        label: "Walk away",
        detail: "The house remembers who you left behind.",
        kind: "abandon",
      },
    ],
  },
  {
    id: "portrait",
    title: "The Portrait’s Correction",
    text: "The painted figure turns its face toward a door you have not yet opened.",
    choices: [
      {
        label: "Study the brushwork",
        detail: "Insight · difficulty 8. Gain a warning.",
        kind: "clue",
        stat: "insight",
      },
      {
        label: "Cover the portrait",
        detail: "Lower the pressure, but lose the warning.",
        kind: "calm",
      },
      {
        label: "Ask who is missing",
        detail: "Nerve · difficulty 9. A risky question.",
        kind: "check",
        stat: "nerve",
      },
    ],
  },
  {
    id: "clock",
    title: "The Clock Without Hands",
    text: "A clock ticks from inside its wooden case. The sound stops whenever you look away.",
    choices: [
      {
        label: "Wind the empty clock",
        detail: "Grace · difficulty 8. Read the impossible hour.",
        kind: "check",
        stat: "grace",
      },
      {
        label: "Listen without touching",
        detail: "Gain a clockwork clue.",
        kind: "clue",
      },
      {
        label: "Break the case",
        detail: "The house notices your violence.",
        kind: "break",
      },
    ],
  },
  {
    id: "moth",
    title: "A Moth in the Lantern",
    text: "A pale moth circles your flame. Its wings carry tiny letters: COME DOWN.",
    choices: [
      {
        label: "Follow its flight",
        detail: "Grace · difficulty 7. It may lead to something.",
        kind: "check",
        stat: "grace",
      },
      {
        label: "Release it",
        detail: "A small kindness is not forgotten.",
        kind: "kind",
      },
      {
        label: "Burn the message",
        detail: "Gain an item, at a cost.",
        kind: "burn",
      },
    ],
  },
  {
    id: "music",
    title: "The Unplayed Measure",
    text: "A piano plays a three-note phrase. A fourth note waits beneath the keys.",
    choices: [
      {
        label: "Complete the phrase",
        detail: "Insight · difficulty 9. A clue chain begins.",
        kind: "check",
        stat: "insight",
      },
      {
        label: "Hum along",
        detail: "Nerve · difficulty 7. Calm the room.",
        kind: "calm",
      },
      {
        label: "Close the lid",
        detail: "The notes continue from upstairs.",
        kind: "abandon",
      },
    ],
  },
  {
    id: "footsteps",
    title: "Footsteps Above You",
    text: "Wet footsteps cross the ceiling, stop overhead, then begin down the stairs.",
    choices: [
      {
        label: "Hold your ground",
        detail: "Nerve · difficulty 8. Face what descends.",
        kind: "check",
        stat: "nerve",
      },
      {
        label: "Hide in the furniture",
        detail: "Grace · difficulty 7. Let it pass.",
        kind: "check",
        stat: "grace",
      },
      {
        label: "Call out",
        detail: "The answer comes from your own throat.",
        kind: "fear",
      },
    ],
  },
  {
    id: "mirror",
    title: "A Reflection Arrives Late",
    text: "Your reflection finishes turning several seconds after you do. It points behind you.",
    choices: [
      {
        label: "Ask it what it saw",
        detail: "Insight · difficulty 9. It knows another room.",
        kind: "check",
        stat: "insight",
      },
      {
        label: "Touch the glass",
        detail: "A dangerous bargain with your double.",
        kind: "touch",
      },
      {
        label: "Turn away",
        detail: "Keep your fear, but gain no clue.",
        kind: "abandon",
      },
    ],
  },
  {
    id: "candles",
    title: "The Candle Census",
    text: "Every candle in the room burns with a different blue flame. One flame has no wick.",
    choices: [
      {
        label: "Count the flames",
        detail: "Insight · difficulty 7. Discover the absent guest.",
        kind: "clue",
      },
      {
        label: "Take the wickless flame",
        detail: "Nerve · difficulty 8. Useful, but hungry.",
        kind: "check",
      },
      {
        label: "Blow them out",
        detail: "Reduce supernatural pressure.",
        kind: "calm",
      },
    ],
  },
  {
    id: "bargain",
    title: "The Mourner’s Bargain",
    text: "A veiled figure offers a brass key in exchange for a memory you treasure.",
    choices: [
      {
        label: "Accept the bargain",
        detail: "Gain the Estate Key; take one fear.",
        kind: "item",
      },
      {
        label: "Ask what the key opens",
        detail: "Insight · difficulty 8. Demand clarity.",
        kind: "check",
        stat: "insight",
      },
      {
        label: "Offer a promise instead",
        detail: "Promise to return. The house will remember.",
        kind: "promise",
      },
    ],
  },
  {
    id: "doors",
    title: "The Door That Breathes",
    text: "The door expands and contracts like a sleeping chest. Something on the other side matches your breath.",
    choices: [
      {
        label: "Open it on the exhale",
        detail: "Grace · difficulty 8. Reach the next room safely.",
        kind: "check",
        stat: "grace",
      },
      {
        label: "Knock three times",
        detail: "A courteous response, perhaps.",
        kind: "clue",
      },
      {
        label: "Mark the door",
        detail: "The house may move it later.",
        kind: "mark",
      },
    ],
  },
  {
    id: "dust",
    title: "Names in the Dust",
    text: "A list of names has been written on the mantel. Yours is last, still wet.",
    choices: [
      {
        label: "Erase your name",
        detail: "Body · difficulty 8. Defy the house.",
        kind: "check",
        stat: "body",
      },
      {
        label: "Read the other names",
        detail: "Record a clue about the former guests.",
        kind: "clue",
      },
      {
        label: "Write another name",
        detail: "A cruel distraction.",
        kind: "betray",
      },
    ],
  },
];
const roomNames = (id: string) =>
  TEMPLATES.find((t) => t[0] === id)?.[1] || "Entrance Hall";
export function newGame(
  seed: number = Math.floor(Math.random() * 0x7fffffff),
  character = "ada",
): GameState {
  const c = CHARACTERS.find((x) => x.id === character) || CHARACTERS[0];
  const hall: Room = {
    id: "r0",
    template: "entrance",
    name: "Entrance Hall",
    x: 0,
    y: 0,
    floor: 0,
    links: ["r1"],
    searched: false,
    secret: false,
    eventDone: false,
  };
  const stair: Room = {
    id: "r1",
    template: "stair",
    name: "Grand Staircase",
    x: 1,
    y: 0,
    floor: 0,
    links: ["r0"],
    searched: false,
    secret: false,
    eventDone: false,
  };
  return {
    version: 1,
    seed: seed >>> 0,
    rng: seed >>> 0 || 1,
    phase: "play",
    rooms: [hall, stair],
    players: [{ ...structuredClone(c), roomId: "r0" }],
    current: 0,
    ap: 3,
    turn: 1,
    pressure: 0,
    attention: 0,
    omens: 0,
    scenario: "",
    objective: "Explore, gather omens, and learn what the house wants.",
    anchor: null,
    clues: [],
    flags: [],
    log: [
      {
        text: "The front door closes without a sound. Your expedition begins.",
        kind: "discovery",
      },
    ],
    event: null,
    lastRoll: "",
    ending: "",
    mode: "explore",
    settings: { reducedMotion: false, captions: true },
  };
}
export function rand(s: GameState) {
  let x = s.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return (s.rng >>> 0) / 4294967296;
}
export function roll(s: GameState, stat: Stat, difficulty = 8) {
  const p = s.players[s.current];
  const a = 1 + Math.floor(rand(s) * 6),
    b = 1 + Math.floor(rand(s) * 6);
  const fearPenalty = p.fear >= 3 ? 1 : 0;
  const mod =
    p.stats[stat] - (stat === "body" && p.id === "ada" ? 1 : 0) - fearPenalty;
  const total = a + b + mod;
  const success = total >= difficulty;
  s.lastRoll = `${a} + ${b} ${mod >= 0 ? "+" : ""}${mod} = ${total} vs ${difficulty} · ${success ? "SUCCESS" : "FAILURE"}`;
  return success;
}
function log(s: GameState, text: string, kind?: LogEntry["kind"]) {
  s.log.unshift({ text, kind });
  s.log = s.log.slice(0, 50);
}
function neighbors(x: number, y: number) {
  return [
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
    [x, y - 1],
  ];
}
function availableSlot(s: GameState, from: Room) {
  const dirs = neighbors(from.x, from.y);
  const offset = Math.floor(rand(s) * 4);
  for (let i = 0; i < 4; i++) {
    const [x, y] = dirs[(i + offset) % 4];
    if (!s.rooms.some((r) => r.floor === from.floor && r.x === x && r.y === y))
      return { x, y };
  }
  return null;
}
function maybeEvent(s: GameState, room: Room) {
  if (room.eventDone || s.event) return;
  room.eventDone = true;
  const pool = EVENT_DEFS.filter((e) => !s.flags.includes(`event:${e.id}`));
  let def = pool[Math.floor(rand(s) * pool.length)] || EVENT_DEFS[0];
  let text = def.text;
  if (
    s.flags.includes("broken-promise") &&
    !s.flags.includes("promise-recalled")
  ) {
    def = EVENT_DEFS.find((e) => e.id === "wall") || def;
    text =
      "The wall repeats the voice you refused before. This time it uses your own voice: ‘You said you would stay.’";
    s.flags.push("promise-recalled");
    s.attention++;
  }
  s.flags.push(`event:${def.id}`);
  s.event = {
    id: def.id,
    title: def.title,
    text,
    choices: def.choices,
  };
}
function maybeRevelation(s: GameState) {
  if (s.phase !== "play" || s.omens < 3) return;
  s.phase = "revelation";
  s.pressure += 2;
  const options = [
    "house-chosen",
    "last-midnight",
    "mirror-jury",
    "heart-beneath",
  ];
  const solo = s.players.length === 1;
  const scenario = solo
    ? options[1]
    : options[Math.floor(rand(s) * options.length)];
  s.scenario = scenario;
  const names: { [k: string]: [string, string] } = {
    "house-chosen": [
      "The House Has Chosen",
      "Find the anchor before the chosen one completes the house’s design.",
    ],
    "last-midnight": [
      "The Last Midnight",
      "Find two clock clues and silence the impossible hour.",
    ],
    "mirror-jury": [
      "The Mirror Jury",
      "Expose the double; gather two reliable clues before making an accusation.",
    ],
    "heart-beneath": [
      "The Heart Beneath the House",
      "Reach the buried heart. Destroy it, bargain, or use what the house remembers.",
    ],
  };
  s.objective = names[scenario][1];
  s.anchor = null;
  if (scenario === "house-chosen" && s.players.length > 1) {
    const traitor = Math.floor(rand(s) * s.players.length);
    s.players[traitor].items.push("The House’s Seal");
    s.flags.push(`chosen:${s.players[traitor].id}`);
  }
  log(s, `REVELATION — ${names[scenario][0]}. ${s.objective}`, "omen");
}
export function act(s: GameState, action: string, payload?: string): GameState {
  const n = structuredClone(s);
  if (n.phase === "ended") return n;
  if (n.event && action !== "resolve" && action !== "toggle-map") return n;
  if (action === "new-turn") {
    if (n.phase !== "play" && n.phase !== "revelation") return n;
    n.current = (n.current + 1) % n.players.length;
    if (n.current === 0) n.turn++;
    n.ap = 3;
    n.pressure = Math.min(9, n.pressure + 1);
    log(n, `${n.players[n.current].name} takes the next watch.`);
    return n;
  }
  if (action === "move") {
    if ((n.phase !== "play" && n.phase !== "revelation") || n.ap < 1) return n;
    const dest = n.rooms.find((r) => r.id === payload);
    const p = n.players[n.current];
    const here = n.rooms.find((r) => r.id === p.roomId)!;
    if (!dest || !here.links.includes(dest.id)) return n;
    p.roomId = dest.id;
    n.ap--;
    log(n, `${p.name} enters ${dest.name}.`);
    maybeEvent(n, dest);
    return n;
  }
  if (action === "explore") {
    if (n.phase !== "play" || n.ap < 1) return n;
    const p = n.players[n.current],
      from = n.rooms.find((r) => r.id === p.roomId)!;
    const slot = availableSlot(n, from);
    if (!slot) {
      log(
        n,
        "No safe adjoining space remains. The house has folded its doors inward.",
      );
      n.ap--;
      return n;
    }
    const floorRoll = rand(n);
    const options = TEMPLATES.filter(
      (t) =>
        t[2] === "ground" ||
        (floorRoll > 0.72 && t[2] === "upper") ||
        (floorRoll > 0.9 && t[2] === "basement"),
    );
    let t = options[Math.floor(rand(n) * options.length)];
    if (n.rooms.length > 7 && rand(n) < 0.035)
      t = TEMPLATES.find((x) => x[0] === "impossible")!;
    const id = `r${n.rooms.length}`,
      room: Room = {
        id,
        template: t[0],
        name: roomNames(t[0]),
        x: slot.x,
        y: slot.y,
        floor: 0,
        links: [from.id],
        searched: false,
        secret: false,
        eventDone: false,
      };
    from.links.push(id);
    n.rooms.push(room);
    p.roomId = id;
    n.ap--;
    n.pressure = Math.min(9, n.pressure + 1);
    log(
      n,
      `A new room unfolds from the doorway: ${room.name}. The architecture settles around you.`,
      "discovery",
    );
    if (rand(n) < 0.24) {
      n.omens++;
      log(
        n,
        "An omen stirs in the room. The house is paying closer attention.",
        "omen",
      );
    }
    const inevitableOmens = Math.min(
      3,
      Math.max(0, Math.floor((n.pressure - 2) / 2)),
    );
    while (n.omens < inevitableOmens) {
      n.omens++;
      log(
        n,
        "A pattern becomes impossible to ignore: an omen gathers in the house.",
        "omen",
      );
    }
    if (n.pressure >= 4 && !n.flags.includes("watcher")) {
      n.flags.push("watcher");
      room.haunted = "watcher";
      log(
        n,
        "A figure appears at the edge of the lantern light. When you look again, it has moved.",
        "event",
      );
    } else if (n.pressure >= 6 && rand(n) < 0.42) {
      room.haunted = rand(n) < 0.5 ? "mourner" : "wisp";
      log(
        n,
        room.haunted === "mourner"
          ? "A veiled mourner gathers where the wallpaper darkens."
          : "A small lantern-colored spirit dances just beyond reach.",
        "event",
      );
    }
    maybeEvent(n, room);
    maybeRevelation(n);
    return n;
  }
  if (action === "search") {
    if (n.phase !== "play" || n.ap < 1) return n;
    const p = n.players[n.current],
      r = n.rooms.find((x) => x.id === p.roomId)!;
    n.ap--;
    if (r.searched) {
      log(n, `Nothing new in ${r.name}. Even dust can be exhausted.`);
      return n;
    }
    r.searched = true;
    const ok = roll(n, "insight", 7);
    if (ok) {
      const item = ITEMS[Math.floor(rand(n) * ITEMS.length)];
      p.items.push(item);
      log(n, `${n.lastRoll} — ${p.name} finds ${item}.`, "roll");
      if (rand(n) < 0.65) {
        const clue = [
          "The family crest is missing its central eye.",
          "A note says: “The house listens through the clocks.”",
          "A child drew the staircase with one extra landing.",
          "The dead were promised a way home.",
        ][Math.floor(rand(n) * 4)];
        if (!n.clues.includes(clue)) {
          n.clues.push(clue);
          log(n, `Journal: ${clue}`, "discovery");
        }
      }
    } else {
      p.fear = Math.min(5, p.fear + 1);
      n.attention++;
      log(n, `${n.lastRoll} — the room resists. Fear rises.`, "roll");
    }
    return n;
  }
  if (action === "resolve" && n.event) {
    const event = n.event,
      choice = event.choices.find((c) => c.label === payload);
    if (!choice) return n;
    const p = n.players[n.current];
    let success = true;
    if (choice.stat) success = roll(n, choice.stat, choice.difficulty || 8);
    switch (choice.kind) {
      case "check":
        if (success) {
          n.clues.push(`${event.title}: a useful truth`);
          p.fear = Math.max(0, p.fear - 1);
          log(
            n,
            `${n.lastRoll} — the house answers. A clue enters the journal.`,
            "roll",
          );
        } else {
          p.fear = Math.min(5, p.fear + 1);
          n.attention++;
          log(n, `${n.lastRoll} — the answer comes too close.`, "roll");
        }
        break;
      case "sit":
        if (success) {
          p.items.push("Silver Place Card");
          n.omens++;
        } else p.fear = Math.min(5, p.fear + 2);
        break;
      case "refuse":
      case "abandon":
        n.flags.push("broken-promise");
        n.attention++;
        log(n, "The house remembers the refusal. Something may answer later.");
        break;
      case "secret":
        if (success) {
          n.clues.push("A hidden passage is concealed behind the wall.");
          n.rooms.find((r) => r.id === p.roomId)!.secret = true;
        } else p.fear++;
        break;
      case "clue":
        n.clues.push(`${event.title}: the house has shown you a pattern.`);
        break;
      case "calm":
        n.pressure = Math.max(0, n.pressure - 1);
        p.fear = Math.max(0, p.fear - 1);
        break;
      case "break":
        n.pressure++;
        n.attention++;
        break;
      case "kind":
        n.flags.push("spared-moth");
        p.fear = Math.max(0, p.fear - 1);
        break;
      case "burn":
        p.items.push("Blue Wick");
        p.fear++;
        n.attention++;
        break;
      case "fear":
        p.fear = Math.min(5, p.fear + 1);
        break;
      case "touch":
        if (success) {
          p.items.push("Mirror Shard");
          n.clues.push("The reflection points toward the room below.");
        } else p.fear += 2;
        break;
      case "item":
        p.items.push("Estate Key");
        p.fear++;
        break;
      case "promise":
        n.flags.push("promise-return");
        n.omens++;
        break;
      case "mark":
        n.flags.push("marked-door");
        break;
      case "betray":
        n.attention += 2;
        n.flags.push("cruel-name");
        break;
    }
    if (n.omens >= 3) maybeRevelation(n);
    n.event = null;
    return n;
  }
  if (action === "investigate-ghost") {
    if ((n.phase !== "play" && n.phase !== "revelation") || n.ap < 1) return n;
    const p = n.players[n.current],
      r = n.rooms.find((x) => x.id === p.roomId)!;
    if (!r.haunted) return n;
    const kind = r.haunted,
      stat: Stat =
        kind === "watcher" ? "insight" : kind === "mourner" ? "nerve" : "grace";
    const ok =
      p.id === "mara" && kind !== "wisp"
        ? true
        : roll(n, stat, kind === "wisp" ? 7 : 8);
    n.ap--;
    if (ok) {
      n.clues.push(
        `${kind === "watcher" ? "The Watcher" : kind === "mourner" ? "The Mourner" : "The Lantern Wisp"}: a spirit’s trace, recorded at ${r.name}.`,
      );
      if (kind === "wisp") p.items.push("Wisp-light");
      if (kind === "mourner") n.flags.push("spared-mourner");
      log(
        n,
        `${n.lastRoll || "Mara recognizes the spirit’s trace."} — it offers a fragment of its story.`,
        "discovery",
      );
      r.haunted = undefined;
    } else {
      p.fear = Math.min(5, p.fear + 1);
      n.attention++;
      log(
        n,
        `${n.lastRoll} — the apparition turns its attention toward you.`,
        "event",
      );
    }
    return n;
  }
  if (action === "use-item") {
    if ((n.phase !== "play" && n.phase !== "revelation") || n.ap < 1) return n;
    const p = n.players[n.current];
    if (!payload || !p.items.includes(payload)) return n;
    if (payload === "Field Kit" && p.hp < 4) {
      p.hp++;
      p.items.splice(p.items.indexOf(payload), 1);
      log(n, "The field kit steadies a shaking hand. One injury eased.");
    } else if (payload === "Brass Lantern") {
      n.pressure = Math.max(0, n.pressure - 1);
      log(n, "Lantern light holds the dark at arm’s length.");
    } else if (payload === "Threadbare Charm") {
      p.fear = Math.max(0, p.fear - 2);
      p.items.splice(p.items.indexOf(payload), 1);
      log(n, "The charm warms. Your fear recedes.");
    } else {
      n.clues.push(
        `Used ${payload} at ${n.rooms.find((r) => r.id === p.roomId)?.name}.`,
      );
      log(n, `${payload} is put to use. The house takes note.`);
      n.attention++;
    }
    n.ap = Math.max(0, n.ap - 1);
    return n;
  }
  if (action === "end-turn") {
    return act(n, "new-turn");
  }
  if (action === "toggle-map") {
    n.mode = n.mode === "explore" ? "dollhouse" : "explore";
    return n;
  }
  if (action === "revelation-action") {
    if (n.phase !== "revelation" || n.ap < 1) return n;
    n.ap--;
    const p = n.players[n.current];
    if (n.scenario === "last-midnight" || n.scenario === "mirror-jury") {
      if (
        !n.clues.some(
          (c) =>
            c.includes("Clock") || c.includes("clock") || c.includes("pattern"),
        )
      )
        n.clues.push("Clockwork pattern recovered");
      else n.clues.push("A second clock pattern");
      log(n, "A mechanism yields. The final bell draws closer.");
      if (n.clues.filter((c) => c.includes("pattern")).length >= 2) {
        n.phase = "ended";
        n.ending = n.flags.includes("spared-mourner")
          ? "The mourner rings the last bell for you. The impossible hour breaks, and the house releases its guests into the grey dawn."
          : "The impossible hour breaks. The house releases its guests into the grey dawn.";
        log(n, n.ending, "discovery");
      }
    } else {
      const room =
        n.rooms.find(
          (r) =>
            r.template === "chapel" ||
            r.template === "archive" ||
            r.template === "impossible",
        ) || n.rooms[n.rooms.length - 1];
      if (
        p.roomId !== room.id &&
        n.rooms.find((r) => r.id === p.roomId)?.links.includes(room.id)
      ) {
        p.roomId = room.id;
        log(n, `You reach ${room.name}. The heart is close.`);
      } else if (n.rooms.length >= 5) {
        n.phase = "ended";
        n.ending = n.flags.includes("promise-return")
          ? "The bargain is honored. The house opens a door onto morning."
          : "The buried heart falls silent. The mansion keeps its shape, but forgets your names.";
        log(n, n.ending, "discovery");
      } else {
        n.rooms[n.rooms.length - 1].haunted = "mourner";
        n.pressure++;
        log(
          n,
          "The house shifts its corridors. Find the buried heart by exploring.",
        );
      }
    }
    if (n.phase !== "ended" && n.pressure >= 9) {
      n.phase = "ended";
      n.ending =
        "The final bell sounds. The house closes around the unfinished expedition.";
      log(n, n.ending, "event");
    }
    return n;
  }
  if (action === "end-game") {
    n.phase = "ended";
    n.ending = payload || "The expedition ends.";
    return n;
  }
  return n;
}
export const saveGame = (s: GameState) =>
  localStorage.setItem("htr-save-v1", JSON.stringify(s));
export function isGameSave(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<GameState>;
  const phases: Phase[] = ["menu", "select", "play", "revelation", "ended"];
  if (s.version !== 1 || !phases.includes(s.phase as Phase)) return false;
  if (!Number.isInteger(s.seed) || !Number.isInteger(s.rng)) return false;
  if (!Array.isArray(s.rooms) || s.rooms.length < 2 || s.rooms.length > 128)
    return false;
  if (!Array.isArray(s.players) || s.players.length < 1 || s.players.length > 4)
    return false;
  const ids = new Set(s.rooms.map((r) => r?.id));
  if (
    ids.size !== s.rooms.length ||
    s.rooms.some(
      (r) =>
        !r ||
        typeof r.id !== "string" ||
        typeof r.name !== "string" ||
        !Number.isFinite(r.x) ||
        !Number.isFinite(r.y) ||
        !Number.isInteger(r.floor) ||
        !Array.isArray(r.links) ||
        r.links.some((id) => typeof id !== "string"),
    )
  )
    return false;
  if (s.rooms.some((r) => r.links.some((id) => !ids.has(id)))) return false;
  if (
    !Number.isInteger(s.current) ||
    (s.current as number) < 0 ||
    (s.current as number) >= s.players.length
  )
    return false;
  if (!Number.isInteger(s.ap) || (s.ap as number) < 0 || (s.ap as number) > 3)
    return false;
  if (
    !s.players.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        ids.has(p.roomId) &&
        p.stats &&
        ["body", "grace", "insight", "nerve"].every((k) =>
          Number.isFinite(p.stats[k as Stat]),
        ) &&
        Array.isArray(p.items) &&
        Number.isInteger(p.hp) &&
        Number.isInteger(p.fear),
    )
  )
    return false;
  return (
    Array.isArray(s.log) &&
    Array.isArray(s.clues) &&
    Array.isArray(s.flags) &&
    (s.event === null || (!!s.event && Array.isArray(s.event.choices))) &&
    (s.mode === "explore" || s.mode === "dollhouse") &&
    !!s.settings
  );
}
export function loadGame(): GameState | null {
  try {
    const x = localStorage.getItem("htr-save-v1");
    if (!x) return null;
    const s: unknown = JSON.parse(x);
    return isGameSave(s) ? s : null;
  } catch {
    return null;
  }
}
export function validateSeeds(count = 100) {
  for (let seed = 1; seed <= count; seed++) {
    let s = newGame(seed);
    for (let i = 0; i < 12 && s.phase === "play"; i++) {
      if (s.ap < 1) s = act(s, "end-turn");
      s = act(s, "explore");
      if (s.event) s = act(s, "resolve", s.event.choices[0].label);
      const ids = new Set(s.rooms.map((r) => r.id));
      if (s.rooms.some((r) => !r.links.every((id) => ids.has(id))))
        throw Error(`broken link seed ${seed}`);
      const keys = s.rooms.map((r) => `${r.floor}:${r.x}:${r.y}`);
      if (new Set(keys).size !== keys.length)
        throw Error(`overlap seed ${seed}`);
    }
  }
  return true;
}
