"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, Expand, Eye, List, MousePointer2, Rotate3D, X } from "lucide-react";
import { CheckpointLink, saveTrainingCheckpoint } from "@/components/training/TrainingProgressTracker";
import { HAZARDS } from "@/lib/training-data";
import type { HazardDefinition } from "@/types";

const TOOLTIP_KEY = "safety360-scene-guidance-seen";

export function HazardScene({ moduleId }: { moduleId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectHazardRef = useRef<(id: string) => void>(() => undefined);
  const meshesRef = useRef<Map<string, { material: { color: { set: (value: string) => void } } }>>(new Map());
  const identifiedRef = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"visual" | "list">("visual");
  const [selected, setSelected] = useState<HazardDefinition | null>(null);
  const [identified, setIdentified] = useState<Set<string>>(() => new Set());
  const [savingHazard, setSavingHazard] = useState<string | null>(null);
  const [showGuidance, setShowGuidance] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    selectHazardRef.current = (id: string) => {
      const hazard = HAZARDS.find((item) => item.id === id);
      if (hazard) setSelected(hazard);
    };
  }, []);

  useEffect(() => {
    if (mode !== "visual" || !hostRef.current) return;
    const meshMap = meshesRef.current;
    let disposed = false;
    let animationFrame = 0;
    let renderer: import("three").WebGLRenderer | null = null;

    async function initialise() {
      try {
        const THREE = await import("three");
        if (disposed || !hostRef.current) return;
        const host = hostRef.current;
        if (!window.WebGLRenderingContext) throw new Error("WebGL is unavailable");

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const resizeRenderer = () => {
          if (!renderer) return;
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = "panorama-canvas";
        renderer.domElement.setAttribute("aria-label", "Interactive 360 degree automotive warehouse scene. Drag to look around or use the Hazard List View.");
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(74, 1, 0.1, 1100);
        camera.position.set(0, 0, 0.1);
        resizeRenderer();
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(500, 80, 48).scale(-1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0x233746 }),
        );
        scene.add(sphere);

        new THREE.TextureLoader().load(
          "/warehouse-panorama-4k.webp",
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            (sphere.material as import("three").MeshBasicMaterial).map = texture;
            (sphere.material as import("three").MeshBasicMaterial).color.set(0xffffff);
            (sphere.material as import("three").MeshBasicMaterial).needsUpdate = true;
            if (!disposed) {
              setReady(true);
              if (!window.sessionStorage.getItem(TOOLTIP_KEY)) setShowGuidance(true);
            }
          },
          undefined,
          () => { if (!disposed) { setFailed(true); setMode("list"); } },
        );

        const hazardMeshes: import("three").Mesh[] = [];
        HAZARDS.forEach((hazard) => {
          const direction = new THREE.Vector3(...hazard.position.split(" ").map(Number) as [number, number, number]).normalize().multiplyScalar(78);
          const material = new THREE.MeshBasicMaterial({ color: hazard.colour, transparent: true, opacity: 0.92 });
          const marker = new THREE.Mesh(new THREE.SphereGeometry(1.9, 28, 18), material);
          marker.position.copy(direction);
          marker.userData.hazardId = hazard.id;
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2.8, 0.18, 10, 44),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
          );
          ring.lookAt(camera.position);
          marker.add(ring);
          scene.add(marker);
          hazardMeshes.push(marker);
          meshMap.set(hazard.id, marker as unknown as { material: { color: { set: (value: string) => void } } });
        });

        let longitude = -5;
        let latitude = 0;
        let pointerDown = false;
        let downX = 0;
        let downY = 0;
        let startLongitude = 0;
        let startLatitude = 0;
        let movement = 0;
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        const onPointerDown = (event: PointerEvent) => {
          pointerDown = true; movement = 0; downX = event.clientX; downY = event.clientY;
          startLongitude = longitude; startLatitude = latitude;
          renderer?.domElement.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!pointerDown) return;
          const deltaX = event.clientX - downX;
          const deltaY = event.clientY - downY;
          movement = Math.max(movement, Math.abs(deltaX) + Math.abs(deltaY));
          longitude = startLongitude - deltaX * 0.11;
          latitude = Math.max(-78, Math.min(78, startLatitude + deltaY * 0.11));
        };
        const onPointerUp = (event: PointerEvent) => {
          pointerDown = false;
          if (movement > 9 || !renderer) return;
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(hazardMeshes, false)[0];
          if (hit?.object.userData.hazardId) selectHazardRef.current(String(hit.object.userData.hazardId));
        };
        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          camera.fov = Math.max(48, Math.min(88, camera.fov + event.deltaY * 0.035));
          camera.updateProjectionMatrix();
        };
        const resizeObserver = new ResizeObserver(resizeRenderer);
        resizeObserver.observe(host);
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "ArrowLeft") longitude -= 4;
          if (event.key === "ArrowRight") longitude += 4;
          if (event.key === "ArrowUp") latitude = Math.max(-78, latitude - 4);
          if (event.key === "ArrowDown") latitude = Math.min(78, latitude + 4);
        };

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        renderer.domElement.addEventListener("keydown", onKeyDown);
        renderer.domElement.tabIndex = 0;

        const animate = () => {
          if (disposed || !renderer) return;
          const phi = THREE.MathUtils.degToRad(90 - latitude);
          const theta = THREE.MathUtils.degToRad(longitude);
          camera.lookAt(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
          const seconds = performance.now() / 1000;
          hazardMeshes.forEach((mesh, markerIndex) => {
            const found = identifiedRef.current.has(String(mesh.userData.hazardId));
            const scale = found || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 1 + Math.sin(seconds * 2 + markerIndex) * 0.08;
            mesh.scale.setScalar(scale);
            const ring = mesh.children[0] as import("three").Mesh;
            ring.lookAt(camera.position);
          });
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(animate);
        };
        animate();

        return () => {
          renderer?.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer?.domElement.removeEventListener("pointermove", onPointerMove);
          renderer?.domElement.removeEventListener("pointerup", onPointerUp);
          renderer?.domElement.removeEventListener("wheel", onWheel);
          renderer?.domElement.removeEventListener("keydown", onKeyDown);
          resizeObserver.disconnect();
        };
      } catch {
        if (!disposed) { setFailed(true); setMode("list"); }
      }
    }

    let detach: (() => void) | undefined;
    void initialise().then((cleanup) => { detach = cleanup; });
    return () => {
      disposed = true;
      detach?.();
      cancelAnimationFrame(animationFrame);
      renderer?.dispose();
      if (renderer?.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      meshMap.clear();
    };
  }, [mode]);

  useEffect(() => {
    identifiedRef.current = identified;
    meshesRef.current.forEach((mesh, id) => mesh.material.color.set(identified.has(id) ? "#15803d" : HAZARDS.find((hazard) => hazard.id === id)?.colour ?? "#dc2626"));
  }, [identified]);

  useEffect(() => {
    let active = true;
    void fetch("/api/activity/complete?moduleSlug=hazard-perception")
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json() as { events?: Array<{ eventKey?: string }> };
        if (!active) return;
        const validIds = new Set(HAZARDS.map((hazard) => hazard.id));
        const savedIds = (body.events ?? [])
          .map((event) => event.eventKey ?? "")
          .filter((id) => validIds.has(id));
        setIdentified(new Set(savedIds));
        void saveTrainingCheckpoint(moduleId, "activity", Math.round((savedIds.length / HAZARDS.length) * 100)).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [moduleId]);

  useEffect(() => {
    if (selected) window.requestAnimationFrame(() => panelRef.current?.focus());
  }, [selected]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function confirmHazard(hazard: HazardDefinition) {
    if (identified.has(hazard.id) || savingHazard) return;
    const willComplete = identified.size === HAZARDS.length - 1 && !identified.has(hazard.id);
    setSavingHazard(hazard.id);
    if (willComplete) setSaveMessage("Saving the final hazard…");
    try {
      const response = await fetch("/api/activity/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, moduleSlug: "hazard-perception", hazardId: hazard.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "This hazard could not be saved.");
      setIdentified((current) => new Set(current).add(hazard.id));
      void saveTrainingCheckpoint(moduleId, "activity", Math.round(((identified.size + 1) / HAZARDS.length) * 100)).catch(() => undefined);
      setSaveMessage(willComplete ? "All seven hazards identified. Your progress has been saved." : "Hazard saved securely.");
    } catch (requestError) {
      setSaveMessage(requestError instanceof Error ? requestError.message : "This hazard could not be saved.");
    } finally {
      setSavingHazard(null);
    }
  }

  function dismissGuidance() {
    window.sessionStorage.setItem(TOOLTIP_KEY, "true");
    setShowGuidance(false);
  }

  async function enterFullscreen() {
    await hostRef.current?.parentElement?.requestFullscreen?.();
  }

  const score = identified.size * 100;

  return (
    <div className="scene-shell" id="main-content">
      <header className="scene-header">
        <Link href="/training/hazard-perception"><ArrowLeft size={18} /> Exit scene</Link>
        <div className="scene-brand"><span>IFI</span><strong>Safety360</strong><small>Hazard perception / Zone 04</small></div>
        <div className="scene-score"><span>Identified</span><strong>{identified.size} / {HAZARDS.length}</strong><i>{score} pts</i></div>
      </header>

      <div className="scene-stage">
        {mode === "visual" && <div ref={hostRef} className={`panorama-host ${ready ? "ready" : ""}`} />}
        {mode === "visual" && !ready && (
          <div className="scene-loader" role="status"><div className="loader-grid" /><span className="loader-ifi">IFI</span><strong>Preparing 360° Training Scene</strong><p>Loading warehouse environment…</p><i /></div>
        )}

        {mode === "visual" && ready && (
          <>
            <div className="scene-controls">
              <button onClick={() => setMode("list")}><List size={17} /> Hazard List View</button>
              <button onClick={enterFullscreen}><Expand size={17} /> Full screen</button>
            </div>
            <div className="scene-instruction"><Rotate3D size={18} /><span>Drag or use arrow keys to look around. Select a pulsing marker to inspect it.</span></div>
          </>
        )}

        {showGuidance && mode === "visual" && (
          <div className="scene-guidance" role="dialog" aria-modal="false" aria-labelledby="scene-guidance-title">
            <MousePointer2 size={22} /><div><strong id="scene-guidance-title">Inspect from every angle</strong><p>There are seven unique hazards. Each can score once.</p></div><button aria-label="Dismiss instructions" onClick={dismissGuidance}><X size={18} /></button>
          </div>
        )}

        {mode === "list" && (
          <section className="hazard-list-view" aria-labelledby="hazard-list-title">
            <div className="hazard-list-heading">
              <div><p className="eyebrow"><span /> Equivalent accessible activity</p><h1 id="hazard-list-title">Hazard List View</h1><p>Inspect every workplace condition and confirm the safer action. This view provides the same learning and score as the visual scene.</p></div>
              {!failed && <button className="button button-secondary" onClick={() => setMode("visual")}><Eye size={18} /> Return to 360° scene</button>}
            </div>
            {failed && <div className="configuration-notice"><List size={18} /><div><strong>Visual scene unavailable</strong><p>WebGL or the panorama could not load. Continue here with the full equivalent activity.</p></div></div>}
            <div className="hazard-list-grid">
              {HAZARDS.map((hazard) => {
                const found = identified.has(hazard.id);
                return <button key={hazard.id} className={found ? "identified" : ""} onClick={() => setSelected(hazard)}><span>{found ? <Check size={17} /> : hazard.code}</span><div><strong>{hazard.title}</strong><small>{found ? "Identified and reviewed" : hazard.risk}</small></div><span aria-hidden="true">→</span></button>;
              })}
            </div>
          </section>
        )}

        {selected && (
          <div className="hazard-panel-layer">
            <button className="hazard-panel-backdrop" aria-label="Close hazard details" onClick={() => setSelected(null)} />
            <div ref={panelRef} className="hazard-panel" role="dialog" aria-modal="true" aria-labelledby="hazard-panel-title" tabIndex={-1}>
              <div className="hazard-panel-top"><span>{selected.code}</span><button aria-label="Close hazard details" onClick={() => setSelected(null)}><X /></button></div>
              <p className="panel-kicker">Safety observation</p><h2 id="hazard-panel-title">{selected.title}</h2>
              <dl><div><dt>Risk</dt><dd>{selected.risk}</dd></div><div><dt>Potential consequence</dt><dd>{selected.consequence}</dd></div><div className="corrective"><dt>Safer corrective action</dt><dd>{selected.correctiveAction}</dd></div></dl>
              <button className={`button ${identified.has(selected.id) ? "button-success" : "button-primary"}`} onClick={() => void confirmHazard(selected)} disabled={identified.has(selected.id) || Boolean(savingHazard)}>{identified.has(selected.id) ? <><CheckCircle2 size={18} /> Hazard identified</> : savingHazard === selected.id ? <>Saving hazard…</> : <>Confirm hazard <Check size={18} /></>}</button>
            </div>
          </div>
        )}

        {identified.size === HAZARDS.length && (
          <div className="scene-complete" role="status"><CheckCircle2 size={22} /><div><strong>Warehouse scan complete</strong><p>{saveMessage || "Saving your result…"}</p></div><CheckpointLink moduleId={moduleId} stage="quiz" position={100} href="/training/hazard-perception/quiz">Continue to quiz <span>→</span></CheckpointLink></div>
        )}
      </div>
    </div>
  );
}
