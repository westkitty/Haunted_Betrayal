import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  act,
  CHARACTERS,
  GameState,
  isGameSave,
  loadGame,
  newGame,
  saveGame,
  Stat,
} from "./game";
const Stage = lazy(() => import("./Stage"));
import {
  BookOpen,
  Compass,
  DoorOpen,
  Eye,
  Footprints,
  Flame,
  Heart,
  Map,
  Package,
  Search,
  Settings,
  Shield,
  Skull,
  Volume2,
  VolumeX,
  ArrowRight,
  Play,
  RotateCcw,
  Save,
  Download,
  Upload,
  ChevronRight,
  Clock3,
  KeyRound,
  Sun,
  Moon,
  Info,
  MoreHorizontal,
  X,
} from "lucide-react";
import "./style.css";
function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<
    "menu" | "select" | "play" | "settings" | "history"
  >("menu");
  const [chosen, setChosen] = useState("ada");
  const [hasSave, setHasSave] = useState(!!loadGame());
  const [history, setHistory] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("htr-history") || "[]");
    } catch {
      return [];
    }
  });
  const [audio, setAudio] = useState(false);
  const [master, setMaster] = useState(0.35);
  const [reduced, setReduced] = useState(
    () => loadGame()?.settings.reducedMotion ?? false,
  );
  const [importMessage, setImportMessage] = useState("");
  const [seed, setSeed] = useState("");
  const [showJournal, setShowJournal] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showHouse, setShowHouse] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const update = (action: string, payload?: string) =>
    setGame((g) => (g ? act(g, action, payload) : g));
  const toggleHud = () =>
    setHudOpen((open) => {
      if (open) {
        setShowExplorer(false);
        setShowHouse(false);
        setShowJournal(false);
      }
      return !open;
    });
  useEffect(() => {
    if (game) {
      saveGame(game);
      setHasSave(true);
      if (
        game.phase === "ended" &&
        !localStorage.getItem("htr-ended-" + game.seed)
      ) {
        const item = {
          seed: game.seed,
          scenario: game.scenario,
          ending: game.ending,
          rooms: game.rooms.length,
          character: game.players[0]?.name,
          turn: game.turn,
          date: new Date().toLocaleDateString(),
        };
        const h = [item, ...history].slice(0, 12);
        setHistory(h);
        localStorage.setItem("htr-history", JSON.stringify(h));
        localStorage.setItem("htr-ended-" + game.seed, "1");
      }
    }
  }, [game]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowExplorer(false);
        setShowHouse(false);
        setShowJournal(false);
        setHudOpen(false);
        if (screen === "settings") setScreen(game ? "play" : "menu");
        return;
      }
      const target = event.target as HTMLElement;
      if (
        target?.matches("input,textarea,select,button,[contenteditable=true]")
      )
        return;
      if (event.key === "F1" || event.key === "?") {
        event.preventDefault();
        toggleHud();
        return;
      }
      if (event.key.toLowerCase() === "i") {
        setHudOpen(true);
        setShowExplorer((open) => !open);
        setShowHouse(false);
        return;
      }
      if (event.key.toLowerCase() === "h") {
        setHudOpen(true);
        setShowHouse((open) => !open);
        setShowExplorer(false);
        return;
      }
      if (event.key.toLowerCase() === "j") {
        setHudOpen(true);
        setShowJournal(true);
        return;
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [screen, game]);
  const start = () => {
    const s = newGame(
      seed ? Number(seed) : Math.floor(Math.random() * 0x7fffffff),
      chosen,
    );
    s.settings.reducedMotion = reduced;
    setGame(s);
    setScreen("play");
  };
  const continueGame = () => {
    const s = loadGame();
    if (s) {
      setGame(s);
      setReduced(s.settings.reducedMotion);
      setScreen("play");
    }
  };
  const leave = () => {
    if (game) saveGame(game);
    setScreen("menu");
  };
  const toggleAudio = () => {
    if (!audio) {
      try {
        const Ctx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 54;
        gain.gain.value = master * 0.035;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        (window as any).__htrAudio = { ctx, osc, gain };
      } catch {}
    } else {
      const a = (window as any).__htrAudio;
      if (a) {
        a.osc.stop();
        a.ctx.close();
        (window as any).__htrAudio = null;
      }
    }
    setAudio(!audio);
  };
  const exportSave = () => {
    if (!game) return;
    const blob = new Blob([JSON.stringify(game, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `house-expedition-${game.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importSave = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s: unknown = JSON.parse(String(reader.result));
        if (!isGameSave(s))
          throw Error(
            "This save is malformed or from an unsupported expedition version.",
          );
        setGame(s);
        setScreen("play");
        setImportMessage("Expedition restored.");
      } catch (e) {
        setImportMessage(
          e instanceof Error ? e.message : "Could not read save.",
        );
      }
    };
    reader.readAsText(file);
  };
  const settings = () => (
    <div className="modal-backdrop" role="presentation">
      <section className="modal settings-modal">
        <button
          className="close"
          onClick={() => setScreen(game ? "play" : "menu")}
          aria-label="Close settings"
        >
          <X />
        </button>
        <div className="eyebrow">HOUSEKEEPING</div>
        <h2>Expedition settings</h2>
        <label className="setting-row">
          <span>
            <Volume2 /> Master sound
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step=".05"
            value={master}
            onChange={(e) => {
              setMaster(+e.target.value);
              const a = (window as any).__htrAudio;
              if (a) a.gain.gain.value = +e.target.value * 0.035;
            }}
          />
        </label>
        <button className="setting-row button-row" onClick={toggleAudio}>
          <span>
            {audio ? (
              <>
                <VolumeX /> Ambient soundscape
              </>
            ) : (
              <>
                <Volume2 /> Ambient soundscape
              </>
            )}
          </span>
          <span className="switch">{audio ? "ON" : "OFF"}</span>
        </button>
        <button
          className="setting-row button-row"
          onClick={() => {
            const next = !reduced;
            setReduced(next);
            setGame((g) =>
              g
                ? { ...g, settings: { ...g.settings, reducedMotion: next } }
                : g,
            );
          }}
        >
          <span>
            <Eye /> Reduced motion
          </span>
          <span className="switch">{reduced ? "ON" : "OFF"}</span>
        </button>
        <div className="note-box">
          The low atmospheric tone is synthesized in your browser. Gameplay has
          captions and does not require sound.
        </div>
        <button
          className="primary-btn"
          onClick={() => setScreen(game ? "play" : "menu")}
        >
          Return to expedition
        </button>
      </section>
    </div>
  );
  if (screen === "menu")
    return (
      <main className="menu-screen">
        <div className="menu-grain" />
        <div className="menu-top">
          <span className="seal">
            <Eye size={18} />
          </span>
          <span>
            FIELD ARCHIVE <i>·</i> EXPEDITION RECORDS
          </span>
          <button
            className="icon-btn"
            onClick={() => setScreen("settings")}
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
        <div className="menu-content">
          <div className="hero-copy">
            <div className="eyebrow">AN INTERACTIVE HAUNTED HOUSE</div>
            <h1>
              THE HOUSE
              <br />
              <em>THAT REMEMBERS</em>
            </h1>
            <p className="tagline">Every door remembers who opened it.</p>
            <p className="intro-copy">
              A living mansion. A gathering of uneasy strangers.
              <br />A house that has been waiting for you to come home.
            </p>
            <div className="menu-actions">
              <button
                className="primary-btn"
                onClick={() => setScreen("select")}
              >
                <Play size={16} fill="currentColor" /> Begin expedition{" "}
                <ArrowRight size={16} />
              </button>
              {hasSave && (
                <button className="secondary-btn" onClick={continueGame}>
                  <RotateCcw size={15} /> Continue expedition
                </button>
              )}
              <button
                className="secondary-btn"
                onClick={() => setScreen("history")}
              >
                <BookOpen size={15} /> Previous expeditions{" "}
                <span className="count">{history.length}</span>
              </button>
              <button
                className="network-btn"
                disabled
                title="Online play requires a configured Firebase backend"
              >
                Play with friends <span>NETWORK UNAVAILABLE</span>
              </button>
            </div>
            <p className="solo-note">
              <span className="live-dot" /> SOLO EXPEDITION · AUTOSAVES LOCALLY
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="moon" />
            <div className="house-shadow">
              <div className="roof" />
              <div className="tower" />
              <div className="facade">
                <div className="window w1" />
                <div className="window w2" />
                <div className="window w3" />
                <div className="door" />
                <div className="balcony" />
              </div>
              <div className="front-steps" />
            </div>
            <div className="art-vignette" />
            <div className="art-label">
              PLATE 01 <span>— THE ASHCOMBE ESTATE</span>
            </div>
          </div>
        </div>
        <footer className="menu-footer">
          <span>AN ORIGINAL PROCEDURAL MYSTERY</span>
          <span>ONE HOUSE · MANY HISTORIES</span>
          <span>BUILD 01.26</span>
        </footer>
      </main>
    );
  if (screen === "select")
    return (
      <main className="select-screen">
        <div className="select-head">
          <button className="text-back" onClick={() => setScreen("menu")}>
            ← MAIN HALL
          </button>
          <div className="eyebrow">BEFORE THE DOOR OPENS</div>
          <h1>
            Choose your <em>visitor.</em>
          </h1>
          <p>Each explorer brings a different way of surviving the house.</p>
        </div>
        <div className="character-grid">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setChosen(c.id)}
              className={`character-card ${chosen === c.id ? "selected" : ""}`}
            >
              <div className={`portrait p${i}`}>
                <span className="portrait-initial">
                  {c.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                </span>
                <span className="portrait-number">0{i + 1}</span>
              </div>
              <div className="character-info">
                <div className="eyebrow">{c.role}</div>
                <h2>{c.name}</h2>
                <p>{c.bio}</p>
                <div className="stats-mini">
                  {(["body", "grace", "insight", "nerve"] as Stat[]).map(
                    (a) => (
                      <span key={a}>
                        {a.slice(0, 3).toUpperCase()} <b>{c.stats[a]}</b>
                      </span>
                    ),
                  )}
                </div>
                <div className="ability">
                  <Shield size={13} />
                  <span>{c.passive}</span>
                </div>
                <div className="weakness">
                  <Skull size={13} />
                  <span>{c.weakness}</span>
                </div>
              </div>
              {chosen === c.id && (
                <div className="selected-stamp">
                  SELECTED <ChevronRight size={14} />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="start-panel">
          <label className="seed-entry">
            <span>
              SEED <small>optional</small>
            </span>
            <input
              placeholder="Random"
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button className="primary-btn" onClick={start}>
            Enter the house <ArrowRight size={16} />
          </button>
          <p>Solo mode is a complete story. Progress saves automatically.</p>
        </div>
      </main>
    );
  if (screen === "history")
    return (
      <main className="history-screen">
        <button className="text-back" onClick={() => setScreen("menu")}>
          ← MAIN HALL
        </button>
        <div className="eyebrow">THE HOUSE KEEPS A RECORD</div>
        <h1>
          Previous <em>expeditions.</em>
        </h1>
        {history.length === 0 ? (
          <div className="empty-history">
            <BookOpen />
            <h2>No expeditions yet.</h2>
            <p>The first journey becomes a memory here.</p>
            <button className="primary-btn" onClick={() => setScreen("select")}>
              Begin an expedition
            </button>
          </div>
        ) : (
          <div className="history-list">
            {history.map((h, i) => (
              <article key={h.seed + i} className="history-item">
                <div className="history-index">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="eyebrow">
                    {h.scenario || "UNFINISHED"} · SEED {h.seed}
                  </div>
                  <h2>
                    {h.character} <span>· {h.date}</span>
                  </h2>
                  <p>
                    {h.rooms} rooms discovered · {h.turn} watches
                  </p>
                  <blockquote>{h.ending}</blockquote>
                </div>
                <Compass />
              </article>
            ))}
          </div>
        )}
      </main>
    );
  if (screen === "settings")
    return <main className="menu-screen">{settings()}</main>;
  if (!game) return null;
  const player = game.players[game.current];
  const room = game.rooms.find((r) => r.id === player.roomId)!;
  const exits = room.links
    .map((id) => game.rooms.find((r) => r.id === id)!)
    .filter(Boolean);
  const danger = game.pressure;
  return (
    <main
      className={`game-shell immersive ${hudOpen ? "hud-open" : ""} ${game.settings.reducedMotion ? "reduce-motion" : ""}`}
    >
      <header className="game-topbar">
        <button className="brand-mark" onClick={leave}>
          <span className="seal">
            <Eye size={16} />
          </span>
          <span>
            THE HOUSE <i>THAT REMEMBERS</i>
          </span>
        </button>
        <div className="top-meta">
          <span>
            <Compass size={14} /> SEED {game.seed}
          </span>
          <span>
            <Clock3 size={14} /> WATCH {String(game.turn).padStart(2, "0")}
          </span>
          <button
            aria-label="Toggle explorer details"
            aria-expanded={showExplorer}
            className={`top-action drawer-trigger ${showExplorer ? "selected" : ""}`}
            onClick={() => {
              setShowExplorer(!showExplorer);
              setShowHouse(false);
            }}
          >
            <Eye size={15} /> <span>EXPLORER</span>
          </button>
          <button
            aria-label="Toggle house details"
            aria-expanded={showHouse}
            className={`top-action drawer-trigger ${showHouse ? "selected" : ""}`}
            onClick={() => {
              setShowHouse(!showHouse);
              setShowExplorer(false);
            }}
          >
            <Flame size={15} /> <span>THE HOUSE</span>
          </button>
          <button className="top-action" onClick={() => setShowJournal(true)}>
            <BookOpen size={15} /> JOURNAL <b>{game.clues.length}</b>
          </button>
          <button className="top-action" onClick={exportSave}>
            <Download size={15} /> EXPORT
          </button>
          <button
            className="top-action"
            onClick={() => document.getElementById("import-save")?.click()}
          >
            <Upload size={15} /> IMPORT
          </button>
          <input
            id="import-save"
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => importSave(e.target.files?.[0])}
          />
          <button className="top-action" onClick={() => setScreen("settings")}>
            <Settings size={15} />
          </button>
        </div>
      </header>
      <section
        className={`game-layout ${showExplorer ? "show-explorer" : ""} ${showHouse ? "show-house" : ""}`}
      >
        <aside className="left-rail">
          <div className="rail-title">
            THE EXPLORER <span className="active-dot" />
            <button
              className="panel-close"
              aria-label="Close explorer details"
              onClick={() => setShowExplorer(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div
            className={`avatar-portrait p${CHARACTERS.findIndex((c) => c.id === player.id)}`}
          >
            <div className="avatar-initial">
              {player.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </div>
            <span>{player.role.toUpperCase()}</span>
          </div>
          <h2>{player.name}</h2>
          <p className="bio-small">{player.bio}</p>
          <div className="stat-list">
            {(["body", "grace", "insight", "nerve"] as Stat[]).map((stat) => (
              <div className="stat-row" key={stat}>
                <span>{stat.toUpperCase()}</span>
                <div className="stat-track">
                  {Array.from({ length: 5 }, (_, i) => (
                    <i
                      key={i}
                      className={i < player.stats[stat] ? "filled" : ""}
                    />
                  ))}
                </div>
                <b>{player.stats[stat]}</b>
              </div>
            ))}
          </div>
          <div className="vitals">
            <div>
              <span>BODY</span>
              <strong>
                {"◆".repeat(player.hp)}
                <i>{"◇".repeat(4 - player.hp)}</i>
              </strong>
            </div>
            <div>
              <span>FEAR</span>
              <strong className="fear-icons">
                {"●".repeat(player.fear)}
                <i>{"○".repeat(5 - player.fear)}</i>
              </strong>
            </div>
          </div>
          <div className="ability-note">
            <div className="eyebrow">INSTINCT</div>
            {CHARACTERS.find((c) => c.id === player.id)?.passive}
          </div>
          <div className="rail-title inventory-head">
            <Package size={14} /> CARRIED OBJECTS{" "}
            <span>{player.items.length}</span>
          </div>
          <div className="inventory">
            {player.items.map((item, i) => (
              <button
                key={item + i}
                title="Use this item"
                onClick={() => update("use-item", item)}
              >
                <KeyRound size={13} />
                {item}
                <span>↗</span>
              </button>
            ))}
            {player.items.length === 0 && (
              <small>Empty pockets. For now.</small>
            )}
          </div>
          <button className="rail-link" onClick={() => setShowJournal(true)}>
            <BookOpen size={14} /> Open field journal <ChevronRight size={14} />
          </button>
        </aside>
        <section className="center-stage">
          <button
            className="immersive-toggle"
            aria-label={
              hudOpen ? "Hide expedition controls" : "Show expedition controls"
            }
            aria-expanded={hudOpen}
            title="Expedition controls · F1 or ?"
            onClick={() => {
              toggleHud();
              requestAnimationFrame(() =>
                document.querySelector<HTMLCanvasElement>("canvas")?.focus(),
              );
            }}
          >
            <MoreHorizontal size={17} />
          </button>
          <div className="scene-header">
            <div>
              <div className="eyebrow">
                {game.phase === "play"
                  ? "CURRENT LOCATION"
                  : game.phase === "revelation"
                    ? "THE HOUSE HAS REVEALED ITSELF"
                    : "EXPEDITION COMPLETE"}
              </div>
              <h2>
                {room.name}
                <span>
                  {" "}
                  ·{" "}
                  {["BASEMENT", "GROUND FLOOR", "UPPER FLOOR"][room.floor] ||
                    "GROUND FLOOR"}
                </span>
              </h2>
            </div>
            <button
              className="mode-toggle"
              onClick={() => update("toggle-map")}
            >
              {game.mode === "dollhouse" ? (
                <Footprints size={15} />
              ) : (
                <Map size={15} />
              )}{" "}
              {game.mode === "dollhouse" ? "EXPLORE" : "DOLLHOUSE"}
            </button>
          </div>
          <Suspense
            fallback={<div className="stage-loading">The house is waking…</div>}
          >
            <Stage
              state={game}
              onMove={(id) => update("move", id)}
              onToggleMode={() => update("toggle-map")}
              onExplore={(direction) => update("explore", direction)}
              onSearch={() => update("search")}
              onEndTurn={() => update("end-turn")}
              hudOpen={hudOpen}
            />
          </Suspense>
          <div className="action-bar">
            <div className="action-count">
              <span className="eyebrow">ACTIONS REMAINING</span>
              <div>
                {Array.from({ length: 3 }, (_, i) => (
                  <i key={i} className={i < game.ap ? "active" : ""} />
                ))}
              </div>
            </div>
            {game.phase === "play" ? (
              <>
                <button
                  className="action-button discover"
                  disabled={game.ap < 1}
                  onClick={() => update("explore")}
                >
                  <DoorOpen />
                  <span>
                    Open a new door<small>Reveal a room · 1 action</small>
                  </span>
                </button>
                <button
                  className="action-button"
                  disabled={game.ap < 1}
                  onClick={() => update("search")}
                >
                  <Search />
                  <span>
                    Search this room<small>Insight check · find supplies</small>
                  </span>
                </button>
                {room.haunted && (
                  <button
                    className="action-button spirit-action"
                    disabled={game.ap < 1}
                    onClick={() => update("investigate-ghost")}
                  >
                    <Eye />
                    <span>
                      Attend to the spirit<small>Learn why it remains</small>
                    </span>
                  </button>
                )}
                <button
                  className="action-button end-action"
                  onClick={() => update("end-turn")}
                >
                  <ArrowRight />
                  <span>
                    End watch<small>Pass to the next watch</small>
                  </span>
                </button>
              </>
            ) : game.phase === "revelation" ? (
              <button
                className="action-button discover scenario-action"
                disabled={game.ap < 1}
                onClick={() => update("revelation-action")}
              >
                <Flame />
                <span>
                  Act on the revelation
                  <small>Advance the scenario · 1 action</small>
                </span>
              </button>
            ) : (
              <button
                className="action-button discover"
                onClick={() => {
                  setGame(null);
                  setScreen("select");
                }}
              >
                <RotateCcw />
                <span>
                  Begin another expedition<small>The house remembers</small>
                </span>
              </button>
            )}
          </div>
          {hudOpen && game.lastRoll && (
            <div className="roll-banner">
              <span className="dice">⚄</span>
              <div>
                <small>LAST CHECK</small>
                <strong>{game.lastRoll}</strong>
              </div>
              <button
                onClick={() => setGame({ ...game, lastRoll: "" })}
                aria-label="Dismiss roll"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>
        <aside className="right-rail">
          <div className="rail-title">
            THE HOUSE’S ATTENTION{" "}
            <span className="attention-number">{game.attention}</span>
            <button
              className="panel-close"
              aria-label="Close house details"
              onClick={() => setShowHouse(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="pressure-meter">
            <div className="pressure-track">
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} className={i < danger ? "lit" : ""} />
              ))}
            </div>
            <div className="pressure-copy">
              <Flame size={14} />
              <span>
                {danger < 3 ? "Listening" : danger < 6 ? "Awakening" : "Near"}{" "}
                <small>PRESSURE {danger}/9</small>
              </span>
            </div>
          </div>
          <div className="omen-line">
            <span>OMENS GATHERED</span>
            <div>
              {Array.from({ length: 3 }, (_, i) => (
                <i key={i} className={i < game.omens ? "lit" : ""} />
              ))}
            </div>
          </div>
          <div className="objective-card">
            <div className="eyebrow">
              {game.phase === "play"
                ? "SHARED INTENTION"
                : "SCENARIO OBJECTIVE"}
            </div>
            <h3>
              {game.phase === "play"
                ? "Find out what it wants."
                : game.scenario.replaceAll("-", " ").toUpperCase()}
            </h3>
            <p>{game.objective}</p>
            {game.phase === "play" && (
              <small>Three omens may reveal the house’s true design.</small>
            )}
          </div>
          <div className="turn-panel">
            <div className="rail-title">
              THE CURRENT WATCH <span>#{game.turn}</span>
            </div>
            <div className="turn-person">
              <div className="tiny-monogram">
                {player.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </div>
              <div>
                <strong>{player.name}</strong>
                <small>At {room.name}</small>
              </div>
              <span className="your-turn">YOU</span>
            </div>
            <button className="end-turn-btn" onClick={() => update("end-turn")}>
              End watch <ArrowRight size={15} />
            </button>
          </div>
          <div className="log-panel">
            <div className="rail-title">
              <span>THE HOUSE REMEMBERS</span>
              <span className="log-live">LIVE</span>
            </div>
            <div className="log-list">
              {game.log.slice(0, 7).map((entry, i) => (
                <div className={`log-entry ${entry.kind || ""}`} key={i}>
                  <span className="log-glyph">
                    {entry.kind === "discovery"
                      ? "✦"
                      : entry.kind === "omen"
                        ? "◉"
                        : entry.kind === "roll"
                          ? "⚄"
                          : "·"}
                  </span>
                  <p>{entry.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="right-footer">
            <button onClick={() => setScreen("settings")}>
              <Settings size={13} /> ACCESSIBILITY & SOUND
            </button>
            <span>LOCAL EXPEDITION SAVED</span>
          </div>
        </aside>
      </section>
      {game.event && (
        <div className="event-backdrop">
          <section className="event-card">
            <div className="event-art">
              <div className="event-orbit" />
              <Eye size={45} />
              <span>AN ENCOUNTER</span>
            </div>
            <div className="event-copy">
              <div className="eyebrow">THE HOUSE MAKES AN OFFER</div>
              <h2>{game.event.title}</h2>
              <p>{game.event.text}</p>
              <div className="choice-list">
                {game.event.choices.map((c, i) => (
                  <button key={i} onClick={() => update("resolve", c.label)}>
                    <span className="choice-key">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>
                      <strong>{c.label}</strong>
                      <small>{c.detail}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
              <div className="event-foot">
                <span>YOUR CHOICE WILL BE REMEMBERED</span>
                <span>NO WAY BACK</span>
              </div>
            </div>
          </section>
        </div>
      )}
      {game.phase === "revelation" && (
        <div className="revelation-ribbon">
          <div className="eyebrow">A REVELATION</div>
          <h2>{game.scenario.replaceAll("-", " ").toUpperCase()}</h2>
          <p>{game.objective}</p>
          <button onClick={() => update("revelation-action")}>
            Face what comes next <ArrowRight size={15} />
          </button>
        </div>
      )}
      {game.phase === "ended" && (
        <div className="ending-backdrop">
          <section className="ending-card">
            <div className="eyebrow">
              EXPEDITION {game.ending.includes("closes") ? "LOST" : "CONCLUDED"}
            </div>
            <div className="ending-seal">
              <Eye size={30} />
            </div>
            <h1>
              The house
              <br />
              <em>remembers.</em>
            </h1>
            <p>{game.ending}</p>
            <div className="ending-stats">
              <span>
                {game.rooms.length}
                <small>ROOMS</small>
              </span>
              <span>
                {game.clues.length}
                <small>CLUES</small>
              </span>
              <span>
                {game.turn}
                <small>WATCHES</small>
              </span>
              <span>
                {game.seed}
                <small>SEED</small>
              </span>
            </div>
            <button
              className="primary-btn"
              onClick={() => {
                setGame(null);
                setScreen("select");
              }}
            >
              Begin another expedition <ArrowRight size={15} />
            </button>
            <button className="secondary-btn" onClick={leave}>
              Return to field archive
            </button>
          </section>
        </div>
      )}
      {showJournal && (
        <div className="modal-backdrop" onClick={() => setShowJournal(false)}>
          <section
            className="modal journal-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setShowJournal(false)}>
              <X />
            </button>
            <div className="eyebrow">FIELD NOTES · SEED {game.seed}</div>
            <h2>The house, in fragments.</h2>
            <div className="journal-tabs">
              <span>
                <BookOpen size={14} /> CLUES {game.clues.length}
              </span>
              <span>
                <Compass size={14} /> ROOMS {game.rooms.length}
              </span>
              <span>
                <Eye size={14} /> OMENS {game.omens}
              </span>
            </div>
            <div className="journal-content">
              <h3>What we have learned</h3>
              {game.clues.length ? (
                game.clues.map((c, i) => (
                  <p className="clue-entry" key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {c}
                  </p>
                ))
              ) : (
                <p className="muted">
                  No clues recorded. Look closer. The house leaves evidence in
                  odd places.
                </p>
              )}
              <h3>Places that have opened</h3>
              <div className="room-list">
                {game.rooms.map((r) => (
                  <span key={r.id}>
                    {r.name}
                    {r.haunted && <i> · presence</i>}
                  </span>
                ))}
              </div>
            </div>
            <button
              className="primary-btn"
              onClick={() => setShowJournal(false)}
            >
              Close journal
            </button>
          </section>
        </div>
      )}
      {importMessage && (
        <div className="toast" onClick={() => setImportMessage("")}>
          {importMessage}
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
