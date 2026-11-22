import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  act,
  CHARACTERS,
  GameState,
  isGameSave,
  isSaveImportSizeAllowed,
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
import "./visual-polish.css";
const createRunId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [runId, setRunId] = useState(() => {
    try {
      return localStorage.getItem("htr-active-run") || "";
    } catch {
      return "";
    }
  });
  const completedRuns = useRef(new Set<string>());
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
  const [systemReduced, setSystemReduced] = useState(prefersReducedMotion);
  const [reduced, setReduced] = useState(
    () => loadGame()?.settings.reducedMotion ?? prefersReducedMotion(),
  );
  const [importMessage, setImportMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<GameState | null>(null);
  const [saveWarning, setSaveWarning] = useState("");
  const [seed, setSeed] = useState("");
  const [showJournal, setShowJournal] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showHouse, setShowHouse] = useState(false);
  const [hudOpen, setHudOpen] = useState(true);
  const update = (action: string, payload?: string) =>
    setGame((g) => (g ? act(g, action, payload) : g));
  const beginRunRecord = () => {
    const id = createRunId();
    setRunId(id);
    try {
      localStorage.setItem("htr-active-run", id);
    } catch {
      // In-memory id still prevents duplicate history in this page session.
    }
    return id;
  };
  const resumeRunRecord = () => {
    let id = runId;
    try {
      id = localStorage.getItem("htr-active-run") || id;
    } catch {
      // Continue with the in-memory run id when storage is unavailable.
    }
    if (!id) id = createRunId();
    setRunId(id);
    try {
      localStorage.setItem("htr-active-run", id);
    } catch {
      // In-memory id still prevents duplicate history in this page session.
    }
    return id;
  };
  const toggleHud = () => setHudOpen((open) => !open);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setSystemReduced(preference.matches);
    updatePreference();
    if (preference.addEventListener) {
      preference.addEventListener("change", updatePreference);
      return () =>
        preference.removeEventListener("change", updatePreference);
    }
    preference.addListener(updatePreference);
    return () => preference.removeListener(updatePreference);
  }, []);
  useEffect(() => {
    if (!game) return;
    if (saveGame(game)) {
      setHasSave(true);
      setSaveWarning("");
    } else {
      setSaveWarning(
        "Autosave is unavailable in this browser. Export your expedition to keep a backup.",
      );
    }
    if (game.phase === "ended") {
      const completedRunId = runId || createRunId();
      if (!runId) setRunId(completedRunId);
      if (!completedRuns.current.has(completedRunId)) {
        completedRuns.current.add(completedRunId);
        try {
          const historyKey = `htr-ended-run-${completedRunId}`;
          if (!localStorage.getItem(historyKey)) {
            const item = {
              runId: completedRunId,
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
            localStorage.setItem(historyKey, "1");
          }
        } catch {
          // A history write must not interrupt the completed expedition.
        }
      }
    }
  }, [game, runId]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowExplorer(false);
        setShowHouse(false);
        setShowJournal(false);
        setHudOpen(false);
        if (screen === "settings") closeSettings();
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
  useEffect(() => {
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"]',
      ),
    );
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const selector =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.getClientRects().length > 0,
      );
    focusable()[0]?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      requestAnimationFrame(() => {
        if (previous?.isConnected) {
          previous.focus();
        } else if (screen === "play") {
          document
            .querySelector<HTMLElement>(
              ".game-shell .action-button:not(:disabled)",
            )
            ?.focus();
        }
      });
    };
  }, [screen, showJournal, pendingImport?.seed, game?.event?.id, game?.phase]);
  const start = () => {
    const s = newGame(
      seed ? Number(seed) : Math.floor(Math.random() * 0x7fffffff),
      chosen,
    );
    s.settings.reducedMotion = reduced;
    beginRunRecord();
    setGame(s);
    setScreen("play");
  };
  const continueGame = () => {
    const s = loadGame();
    if (s) {
      resumeRunRecord();
      setGame(s);
      setReduced(s.settings.reducedMotion);
      setScreen("play");
    }
  };
  const leave = () => {
    if (game && !saveGame(game))
      setSaveWarning(
        "Autosave is unavailable in this browser. Export your expedition to keep a backup.",
      );
    setScreen("menu");
  };
  const closeSettings = () => {
    setScreen(game ? "play" : "menu");
    requestAnimationFrame(() => {
      const target = game
        ? document.querySelector<HTMLElement>(
            '.game-topbar [aria-label="Accessibility and sound settings"]',
          )
        : document.querySelector<HTMLElement>('.menu-top [aria-label="Settings"]');
      target?.focus();
    });
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
    setPendingImport(null);
    if (!isSaveImportSizeAllowed(file.size)) {
      setImportMessage("Save files must be 1 MiB (1,048,576 bytes) or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setImportMessage("Could not read save file.");
    reader.onabort = () => setImportMessage("Save import was cancelled.");
    reader.onload = () => {
      try {
        const s: unknown = JSON.parse(String(reader.result));
        if (!isGameSave(s))
          throw Error(
            "This save is malformed or from an unsupported expedition version.",
          );
        setPendingImport(s);
        setImportMessage("");
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
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <button
          className="close"
          onClick={closeSettings}
          aria-label="Close settings"
        >
          <X />
        </button>
        <div className="eyebrow">HOUSEKEEPING</div>
        <h2 id="settings-title">Expedition settings</h2>
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
        <button
          className="setting-row button-row"
          onClick={toggleAudio}
          aria-pressed={audio}
        >
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
          aria-pressed={reduced || systemReduced}
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
          <span className="switch">
            {systemReduced && !reduced ? "SYSTEM ON" : reduced ? "ON" : "OFF"}
          </span>
        </button>
        {systemReduced && (
          <p className="setting-note">
            Reduced motion is enabled by your device preference and remains active
            in the 3D scene.
          </p>
        )}
        <div className="note-box">
          The low atmospheric tone is synthesized in your browser. All story,
          choices, and gameplay information are shown as text; sound is optional.
        </div>
        <button
          className="primary-btn"
          onClick={closeSettings}
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
              <p className="network-note">
                <strong>Online play unavailable</strong>
                <span>No multiplayer backend is configured in this build.</span>
              </p>
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
              aria-pressed={chosen === c.id}
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
                  <Info size={13} />
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
              inputMode="numeric"
              maxLength={10}
              aria-label="Optional numeric expedition seed"
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
  const danger = Math.max(0, Math.min(9, game.pressure));
  const reducedMotion = reduced || systemReduced;
  const stageState = reducedMotion && !game.settings.reducedMotion
    ? { ...game, settings: { ...game.settings, reducedMotion: true } }
    : game;
  return (
    <main
      className={`game-shell immersive ${hudOpen ? "hud-open" : ""} ${reducedMotion ? "reduce-motion" : ""}`}
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
        <nav className="top-meta" aria-label="Expedition navigation">
          <span aria-label={`Seed ${game.seed}`}>
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
          <button
            className="top-action"
            aria-label="Export expedition save"
            onClick={exportSave}
          >
            <Download size={15} /> EXPORT
          </button>
          <button
            className="top-action"
            aria-label="Import expedition save"
            onClick={() => document.getElementById("import-save")?.click()}
          >
            <Upload size={15} /> IMPORT
          </button>
          <input
            id="import-save"
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              importSave(file);
            }}
          />
          <button
            className="top-action"
            aria-label="Accessibility and sound settings"
            onClick={() => setScreen("settings")}
          >
            <Settings size={15} />
          </button>
        </nav>
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
              <strong aria-label={`${player.hp} of 4 health`}>
                {"◆".repeat(player.hp)}
                <i>{"◇".repeat(4 - player.hp)}</i>
              </strong>
            </div>
            <div>
              <span>FEAR</span>
              <strong
                className="fear-icons"
                aria-label={`${player.fear} of 5 fear`}
              >
                {"●".repeat(player.fear)}
                <i>{"○".repeat(5 - player.fear)}</i>
              </strong>
            </div>
          </div>
          <div className="ability-note">
            <div className="eyebrow">EXPLORER RULE</div>
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
              hudOpen ? "Hide scene controls" : "Show scene controls"
            }
            aria-expanded={hudOpen}
            title="Scene controls · F1 or ?"
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
                  {room.floor < 0
                    ? "BASEMENT"
                    : room.floor > 0
                      ? "UPPER FLOOR"
                      : "GROUND FLOOR"}
                </span>
              </h2>
            </div>
            <button
              className="mode-toggle"
              aria-label={
                game.mode === "dollhouse"
                  ? "Switch to room exploration view"
                  : "Switch to floor plan view"
              }
              aria-pressed={game.mode === "dollhouse"}
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
              state={stageState}
              onMove={(id) => update("move", id)}
              onToggleMode={() => update("toggle-map")}
              onExplore={(direction) => update("explore", direction)}
              onSearch={() => update("search")}
              onEndTurn={() => update("end-turn")}
              hudOpen={hudOpen}
            />
          </Suspense>
          <div className="play-status-strip" aria-label="Current expedition status">
            <div>
              <span className="eyebrow">CURRENT OBJECTIVE</span>
              <p>{game.objective}</p>
            </div>
            <span className="status-pressure">
              Watch {game.turn}{" · "}
              {danger < 3 ? "Listening" : danger < 6 ? "Awakening" : "Near"}
              {" · "}Pressure {danger} of 9{` · ${game.omens} of 3 omens`}
            </span>
            <button
              onClick={() => {
                setShowExplorer(false);
                setShowHouse(true);
              }}
            >
              House details
            </button>
          </div>
          <div className="action-bar">
          <div
            className="action-count"
            role="status"
            aria-live="polite"
            aria-label={`${game.ap} actions remaining`}
          >
            <span className="eyebrow">ACTIONS REMAINING</span>
              <div aria-hidden="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <i key={i} className={i < game.ap ? "active" : ""} />
                ))}
              </div>
              {game.ap < 1 && game.phase !== "ended" && (
                <small className="action-reason">
                  End watch to continue.
                </small>
              )}
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
              <p className="ending-action-note">
                Expedition complete. Review the ending to continue.
              </p>
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
            <div className="pressure-track" aria-hidden="true">
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
            <div
              role="img"
              aria-label={`${game.omens} of 3 omens gathered`}
            >
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
              <p className="turn-hint">End watch from the action bar when you are ready.</p>
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
        <div className="event-backdrop" role="presentation">
          <section
            className="event-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-title"
            tabIndex={-1}
          >
            <div className="event-art">
              <div className="event-orbit" />
              <Eye size={45} />
              <span>AN ENCOUNTER</span>
            </div>
            <div className="event-copy">
              <div className="eyebrow">THE HOUSE MAKES AN OFFER</div>
              <h2 id="event-title">{game.event.title}</h2>
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
          <p className="revelation-hint">
            Use “Act on the revelation” in the action bar to continue.
          </p>
        </div>
      )}
      {game.phase === "ended" && (
        <div className="ending-backdrop" role="presentation">
          <section
            className="ending-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ending-title"
            tabIndex={-1}
          >
            <div className="eyebrow">
              EXPEDITION {game.ending.includes("closes") ? "LOST" : "CONCLUDED"}
            </div>
            <div className="ending-seal">
              <Eye size={30} />
            </div>
            <h1 id="ending-title">
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
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowJournal(false)}
        >
          <section
            className="modal journal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close field journal"
              onClick={() => setShowJournal(false)}
            >
              <X />
            </button>
            <div className="eyebrow">FIELD NOTES · SEED {game.seed}</div>
            <h2 id="journal-title">The house, in fragments.</h2>
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
      {pendingImport && (
        <div className="modal-backdrop import-backdrop" role="presentation">
          <section
            className="modal import-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-confirm-title"
            tabIndex={-1}
          >
            <div className="eyebrow">RESTORE EXPEDITION</div>
            <h2 id="import-confirm-title">Replace this expedition?</h2>
            <p>
              The selected save uses seed {pendingImport.seed} and contains{" "}
              {pendingImport.rooms.length} rooms, {pendingImport.clues.length} clues,
              and watch {pendingImport.turn}.
            </p>
            <p>
              Confirming replaces the current expedition and its local autosave.
              Export the current run first if you want a separate backup.
            </p>
            <div className="import-confirm-actions">
              <button
                className="secondary-btn"
                onClick={() => setPendingImport(null)}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={() => {
                  if (!pendingImport) return;
                  const restored = pendingImport;
                  setPendingImport(null);
                  beginRunRecord();
                  setGame(restored);
                  setScreen("play");
                  setImportMessage("Expedition restored.");
                }}
              >
                Replace and restore
              </button>
            </div>
          </section>
        </div>
      )}
      {importMessage && (
        <div className="toast" role="status" aria-live="polite">
          <span>{importMessage}</span>
          <button
            className="toast-dismiss"
            aria-label="Dismiss notification"
            onClick={() => setImportMessage("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {saveWarning && (
        <div className="toast save-warning-toast" role="status" aria-live="polite">
          {saveWarning}
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
