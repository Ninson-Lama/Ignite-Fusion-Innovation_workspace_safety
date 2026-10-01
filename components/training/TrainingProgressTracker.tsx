"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { learningSectionPosition, type TrainingResumeStage } from "@/lib/training-resume";

export async function saveTrainingCheckpoint(
  moduleId: string,
  stage: Exclude<TrainingResumeStage, "completed">,
  position: number,
) {
  const response = await fetch("/api/progress/checkpoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleId, stage, position: Math.max(0, Math.min(100, Math.round(position))) }),
    keepalive: true,
  });
  if (!response.ok) throw new Error("Training progress could not be saved.");
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function TrainingProgressTracker({
  moduleId,
  sectionCount,
  enabled,
}: {
  moduleId: string;
  sectionCount: number;
  enabled: boolean;
}) {
  const lastPositionRef = useRef(-1);

  useEffect(() => {
    if (!enabled) return;
    const sectionElements = Array.from({ length: sectionCount }, (_, index) => {
      const position = learningSectionPosition(index, sectionCount);
      return document.getElementById(`learning-${position}`);
    }).filter((element): element is HTMLElement => Boolean(element));

    if (!sectionElements.length) {
      void saveTrainingCheckpoint(moduleId, "overview", 0).catch(() => undefined);
      return;
    }

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const savePosition = (position: number) => {
      if (position === lastPositionRef.current) return;
      lastPositionRef.current = position;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void saveTrainingCheckpoint(moduleId, "learning", position).catch(() => undefined);
      }, 300);
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const position = Number((visible.target as HTMLElement).dataset.resumePosition);
      if (Number.isFinite(position)) savePosition(position);
    }, { rootMargin: "-18% 0px -45%", threshold: [0.2, 0.5, 0.8] });

    sectionElements.forEach((element) => observer.observe(element));
    return () => {
      if (saveTimer && lastPositionRef.current >= 0) {
        void saveTrainingCheckpoint(moduleId, "learning", lastPositionRef.current).catch(() => undefined);
      }
      clearTimeout(saveTimer);
      observer.disconnect();
    };
  }, [enabled, moduleId, sectionCount]);

  return null;
}

export function CheckpointLink({
  moduleId,
  stage,
  position,
  href,
  className,
  children,
}: {
  moduleId: string;
  stage: "activity" | "quiz";
  position: number;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <Link
      className={className}
      href={href}
      aria-busy={saving}
      onClick={(event) => {
        if (saving) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        setSaving(true);
        void Promise.race([
          saveTrainingCheckpoint(moduleId, stage, position).catch(() => undefined),
          wait(800),
        ]).finally(() => window.location.assign(href));
      }}
    >
      {saving && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
      {children}
    </Link>
  );
}
