"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Forklift, HardHat, Package, RotateCcw, UserRound } from "lucide-react";
import { GAME_NAMES, LOADS, PPE_ITEMS, PPE_SCENES, SORT_BINS, SORT_CARDS, WALLS, emptyGame, gameReview, replayDrive, type GameId, type LearningGameState } from "@/lib/learning-games";
import "./learning-games.css";

interface SavedGame { state: LearningGameState; revision: number; completed: boolean; score: number | null }
export function LearningGame({ gameId, moduleId = null, moduleSlug }: { gameId: GameId; moduleId?: string | null; moduleSlug?: string }) {
  const [state, setState] = useState<LearningGameState>(emptyGame);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [scene, setScene] = useState(0);
  const [result, setResult] = useState<SavedGame | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [review, setReview] = useState<string[]>([]);
  const revision = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(state);
  const dirty = useRef(false);
  const busy = useRef(false);
  const conflict = useRef(false);
  const mounted = useRef(true);
  const exitHref = moduleSlug ? `/training/${moduleSlug}` : "/games";
  const drive = replayDrive(state.moves);
  const locked = !ready || !!result?.completed || saving || !!loadError;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/games?gameId=${gameId}${moduleId ? `&moduleId=${moduleId}` : ""}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Saved game could not be loaded.");
      if (controller.signal.aborted) return;
      const saved = body.run as SavedGame | null;
      const restored = saved?.state ?? emptyGame();
      latest.current = restored; revision.current = saved?.revision ?? 0; dirty.current = false; conflict.current = false;
      setState(restored); setResult(saved); setReady(true); setLoadError(""); setReview(saved?.completed ? gameReview(gameId, restored).feedback : []); setNotice(saved ? "Resumed your saved challenge." : "Ready. Your moves will save automatically.");
    }).catch((error) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Game unavailable."); });
    return () => controller.abort();
  }, [gameId, moduleId, retry]);

  async function persist(finish = false) {
    // Serialize saves so an older autosave cannot overwrite a newer move or result.
    const task = queue.current.catch(() => undefined).then(async () => {
      if (conflict.current) throw new Error("This game changed in another tab. Reload the saved game before continuing.");
      const snapshot = latest.current;
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId, moduleId, state: snapshot, revision: revision.current, finish }), keepalive: true, signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) { conflict.current = true; if (mounted.current) setLoadError("This game changed in another tab. Reload to use the latest saved progress."); }
        throw new Error(body.error || "Save failed. Your current moves are still on screen; retry before leaving.");
      }
      const saved = body.run as SavedGame;
      revision.current = saved.revision;
      if (latest.current === snapshot || saved.completed) dirty.current = false;
      if (saved.completed) latest.current = saved.state;
      if (mounted.current) {
        setResult(saved); setNotice(saved.completed ? "Result saved. Your administrator can see this completion." : dirty.current ? "Saving newer moves…" : "Progress saved.");
        if (saved.completed) { setState(saved.state); setReview(gameReview(gameId, saved.state).feedback); }
      }
      return saved;
    });
    queue.current = task;
    return task;
  }

  useEffect(() => {
    if (!ready || result?.completed) return;
    const timer = window.setTimeout(() => { if (dirty.current) void persist().catch((error) => setNotice(error.message)); }, 650);
    return () => window.clearTimeout(timer);
    // persist uses refs for the current snapshot and revision, not an old render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready]);

  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    const flush = () => { if (dirty.current && !conflict.current) void persist().catch(() => undefined); };
    const onHidden = () => { if (document.hidden) flush(); };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", onHidden);
    return () => { mounted.current = false; flush(); window.removeEventListener("beforeunload", warn); document.removeEventListener("visibilitychange", onHidden); };
    // On unmount, flush the latest ref-backed state, not the initial render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next: LearningGameState) { if (locked) return; latest.current = next; dirty.current = true; setState(next); setNotice("Saving progress…"); setReview([]); }
  function move(action: string) { if (state.moves.length >= 300) { setNotice("Route limit reached. Reset the route to try again."); return; } update({ ...state, moves: [...state.moves, action] }); }
  function place(item: string, target: string) { update({ ...state, placements: { ...state.placements, [item]: target } }); setSelected(null); }
  function drag(event: DragEvent<HTMLElement>, item: string) { event.dataTransfer.setData("text/plain", item); event.dataTransfer.effectAllowed = "move"; setSelected(item); }
  function dropped(event: DragEvent<HTMLElement>, target: string, allowed: readonly string[]) { event.preventDefault(); const item = event.dataTransfer.getData("text/plain"); if (allowed.includes(item)) place(item, target); }
  async function finish() {
    if (locked || busy.current) return;
    const checked = gameReview(gameId, state); setReview(checked.feedback);
    if (!checked.complete) { setNotice("Complete every part of the challenge before submitting."); return; }
    busy.current = true; setSaving(true);
    try { await persist(true); } catch (error) { setNotice(error instanceof Error ? error.message : "Result could not be saved."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <section className="learning-game" aria-label={GAME_NAMES[gameId]}>
    <header className="lg-header"><Link href={exitHref} onClick={(event) => { if (dirty.current || busy.current) { event.preventDefault(); setNotice("Save your current moves before leaving."); } }}><ArrowLeft size={18} />{moduleSlug ? "Back to module" : "All mini-games"}</Link><span>MINI-GAME TO LEARN</span></header>
    <div className="lg-title"><div><h1>{GAME_NAMES[gameId]}</h1><p>Practice only. Follow your site’s assessment and procedures; this does not qualify anyone to operate equipment.</p></div>{result?.completed && <strong className="lg-score"><CheckCircle2 size={22} />{result.score}%</strong>}</div>
    {loadError ? <div className="lg-status" role="alert"><p>{loadError}</p><button className="button button-secondary" onClick={() => { setLoadError(""); setReady(false); setRetry((n) => n + 1); }}>Reload saved game</button></div> : !ready ? <p role="status">Loading saved progress…</p> : <>
      {gameId === "forklift" && <div className="lg-drive-layout">
        {/* The board is a documented keyboard surface with equivalent button controls alongside it. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div className="lg-driving-board" tabIndex={locked ? -1 : 0} role="group" aria-label="Forklift route. Arrow keys move when this board is focused. B brake, F forks, H horn."
          onKeyDown={(event) => { if (locked || event.target !== event.currentTarget) return; const action = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", b: "brake", f: "forks", h: "horn" } as Record<string, string>)[event.key]; if (action) { event.preventDefault(); move(action); } }}>
          {Array.from({ length: 35 }, (_, index) => { const x = index % 7, y = Math.floor(index / 7); const truck = drive.x === x && drive.y === y;
            return <div key={index} role="img" aria-label={`Column ${x + 1}, row ${y + 1}: ${truck ? "forklift, " : ""}${x === 0 && y === 0 ? "collection bay" : x === 6 && y === 0 ? "delivery bay" : x === 6 && y === 4 ? "parking bay" : WALLS.includes(`${x},${y}`) ? "racking" : x === 3 ? "crossing" : "clear route"}`} className={`lg-cell${WALLS.includes(`${x},${y}`) ? " lg-wall" : ""}${x === 3 ? " lg-crossing" : ""}${truck ? " lg-truck" : ""}`}>
              {truck ? <><Forklift size={32} /><small>{drive.load ? "Loaded" : "Truck"}</small></> : x === 0 && y === 0 ? <><Package /><small>Collect</small></> : x === 6 && y === 0 ? <><Package /><small>Deliver</small></> : x === 6 && y === 4 ? <strong>P</strong> : WALLS.includes(`${x},${y}`) ? <small>Racking</small> : x === 3 ? <small>Crossing</small> : <small>{x + 1},{y + 1}</small>}
            </div>; })}
        </div>
        <div className="lg-controls"><h2>Route controls</h2><p>Collect → deliver → park. Stop beside the crossing (column 3 or 5), check for people and sound the horn before crossing.</p><p className="lg-telemetry">Brake {drive.brake ? "ON" : "OFF"} · Forks {drive.raised ? "RAISED" : "LOW"} · {drive.faults} faults</p>
          <div className="lg-directions">{([["up", ArrowUp], ["left", ArrowLeft], ["down", ArrowDown], ["right", ArrowRight]] as const).map(([action, Icon]) => <button key={action} disabled={locked} onClick={() => move(action)} aria-label={`Move ${action}`}><Icon /></button>)}</div>
          <div className="lg-control-buttons">{[["brake", drive.brake ? "Release brake" : "Apply brake"], ["forks", drive.raised ? "Lower forks" : "Raise forks"], ["horn", "Sound horn"], ["yield", "Check & yield"], ["pickup", "Collect load"], ["drop", "Deliver load"]].map(([action, label]) => <button key={action} disabled={locked} onClick={() => move(action)}>{label}</button>)}</div><p role="status" aria-atomic="true" className="lg-instruction">Column {drive.x + 1}, row {drive.y + 1}{drive.x === 0 && drive.y === 0 ? " · collection bay" : drive.x === 6 && drive.y === 0 ? " · delivery bay" : drive.x === 6 && drive.y === 4 ? " · parking bay" : drive.x === 3 ? " · crossing" : ""}. {drive.message}</p>
        </div>
      </div>}
      {gameId === "ppe" && <>
        <div className="lg-scene-tabs" role="group" aria-label="Workplace scenarios">{PPE_SCENES.map((s, i) => <button key={s.id} aria-pressed={scene === i} onClick={() => { setScene(i); setSelected(null); }}>{i + 1}. {s.title}</button>)}</div><p className="lg-instruction">{PPE_SCENES[scene].text}</p>
        <div className="lg-ppe-layout"><div className="lg-avatar" onDragOver={(event) => { if (!locked) event.preventDefault(); }} onDrop={(event) => dropped(event, "equipped", PPE_ITEMS.map(([id]) => `${PPE_SCENES[scene].id}:${id}`))}>
          <UserRound size={100} aria-hidden="true" /><h2>{PPE_SCENES[scene].title}</h2><p>Drag individual items here, or tap them to equip. Tap an equipped item to remove it.</p><div className="lg-equipped">{PPE_ITEMS.filter(([id]) => state.placements[`${PPE_SCENES[scene].id}:${id}`] === "equipped").map(([id, label]) => <button key={id} disabled={locked} onClick={() => place(`${PPE_SCENES[scene].id}:${id}`, "")}><HardHat size={17} />{label} ×</button>)}</div>
        </div><div className="lg-item-grid">{PPE_ITEMS.map(([id, label]) => { const item = `${PPE_SCENES[scene].id}:${id}`, equipped = state.placements[item] === "equipped"; return <button key={id} aria-pressed={equipped} disabled={locked} draggable={!locked} onDragStart={(event) => drag(event, item)} onClick={() => place(item, equipped ? "" : "equipped")}><HardHat size={23} /><span>{label}</span>{equipped && <CheckCircle2 size={18} />}</button>; })}</div></div>
      </>}
      {gameId === "sorting" && <><p className="lg-instruction">Sort all six cards. Drag a card to a destination, or select a card and tap its destination. Incident cards describe a response—not an instruction to move hazardous material.</p><div className="lg-sort-layout"><div className="lg-card-list">{SORT_CARDS.map((card) => <button key={card.id} disabled={locked} draggable={!locked} onDragStart={(event) => drag(event, card.id)} aria-pressed={selected === card.id} onClick={() => setSelected(card.id)}><Package size={22} /><span>{card.label}<small>{SORT_BINS.find(([id]) => id === state.placements[card.id])?.[1] ?? "Not sorted"}</small></span></button>)}</div><div className="lg-bin-grid">{SORT_BINS.map(([id, label]) => <button key={id} disabled={locked} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropped(event, id, SORT_CARDS.map((card) => card.id))} onClick={() => { if (selected) place(selected, id); }}><strong>{label}</strong><small>{SORT_CARDS.filter((card) => state.placements[card.id] === id).length} cards</small></button>)}</div></div></>}
      {gameId === "stacking" && <><p className="lg-instruction">Exercise loading plan: 900 kg per bay; bottom 700 kg, middle 450 kg, top 200 kg. One pallet per slot, load bottom-up with heavier loads below lighter ones. Hold the damaged pallet. These ratings apply only to this puzzle.</p><div className="lg-stack-layout"><div className="lg-card-list">{LOADS.map((load) => <button key={load.id} disabled={locked} draggable={!locked} aria-pressed={selected === load.id} onDragStart={(event) => drag(event, load.id)} onClick={() => setSelected(load.id)}><Package size={24} /><span>{load.label}<small>{load.weight} kg · {state.placements[load.id] === "hold" ? "Hold" : state.placements[load.id] ? `Bay ${state.placements[load.id][0].toUpperCase()}, level ${Number(state.placements[load.id][1]) + 1}` : "Unplaced"}</small></span></button>)}</div>
        <div className="lg-racks">{["a", "b"].map((bay) => <div key={bay} className="lg-rack"><h2>Bay {bay.toUpperCase()} <small>{LOADS.filter((load) => state.placements[load.id]?.startsWith(bay)).reduce((sum, load) => sum + load.weight, 0)} / 900 kg</small></h2>{[2, 1, 0].map((level) => { const slot = `${bay}${level}`; return <button key={slot} disabled={locked} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropped(event, slot, LOADS.map((load) => load.id))} onClick={() => { if (selected) place(selected, slot); }}><small>Level {level + 1} · {[700, 450, 200][level]} kg max</small><strong>{LOADS.filter((load) => state.placements[load.id] === slot).map((load) => load.label).join(" + ") || "Place pallet"}</strong></button>; })}</div>)}<button className="lg-hold" disabled={locked} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropped(event, "hold", LOADS.map((load) => load.id))} onClick={() => { if (selected) place(selected, "hold"); }}>Hold for assessment / rebuilding</button></div></div></>}
      <footer className="lg-footer"><div><p role="status">{notice}</p>{review.length > 0 && <ul>{review.map((line) => <li key={line}>{line}</li>)}</ul>}</div><div className="lg-actions">{!result?.completed ? <><button className="button button-secondary" disabled={locked} onClick={() => { update(emptyGame()); setSelected(null); }}><RotateCcw size={16} />Reset puzzle</button><button className="button button-secondary" disabled={locked} onClick={() => void persist().catch((error) => setNotice(error.message))}>Save progress</button><button className="button button-primary" disabled={locked} onClick={() => void finish()}>{saving ? "Saving result…" : "Submit challenge"}<ArrowRight size={17} /></button></> : <Link className="button button-primary" href={moduleSlug ? `/training/${moduleSlug}/quiz` : "/games"}>{moduleSlug ? "Continue to knowledge check" : "Choose another game"}<ArrowRight size={17} /></Link>}</div></footer>
    </>}
  </section>;
}
