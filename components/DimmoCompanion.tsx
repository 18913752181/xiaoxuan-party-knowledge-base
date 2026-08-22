"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import atlas from "@/public/images/dimmo-motion-atlas.json";
import timeline from "@/motion/dimmo/build/timeline.json";

type DimmoState = "resting" | "rising" | "awake" | "yawning" | "settling";

const WAKE_DELAY = 2_000;
const IDLE_DELAY = 10_000;
const YAWN_HOLD_DELAY = 240;
const FPS = timeline.fps;

const frameForState = (id: string) => {
  const state = timeline.states.find((item) => item.id === id);
  if (!state) throw new Error(`Missing Dimmo timeline state: ${id}`);
  return Math.round(state.hold * FPS);
};

const REST_START_FRAME = frameForState("resting-start");
const AWAKE_FRAME = frameForState("awake");
const YAWN_FRAME = frameForState("yawning");
const REST_END_FRAME = frameForState("resting-end");

const staticSprites: Record<"resting" | "awake" | "yawning", string> = {
  resting: "/images/dimmo-resting-transparent-v2.png",
  awake: "/images/dimmo-default-transparent.png",
  yawning: "/images/dimmo-yawning-transparent-v2.png"
};

function staticStateFor(state: DimmoState): keyof typeof staticSprites {
  if (state === "resting" || state === "rising" || state === "settling") return "resting";
  if (state === "yawning") return "yawning";
  return "awake";
}

export function DimmoCompanion() {
  const [state, setState] = useState<DimmoState>("resting");
  const [atlasReady, setAtlasReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const textureRef = useRef<HTMLImageElement>(null);
  const stateRef = useRef<DimmoState>("resting");
  const currentFrameRef = useRef(REST_START_FRAME);
  const actionTokenRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const wakeTimer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const wakeDeadlineRef = useRef<number | null>(null);

  const clearTimer = useCallback((timer: MutableRefObject<number | null>) => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const updateState = useCallback((next: DimmoState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const renderFrame = useCallback((frame: number) => {
    const boundedFrame = Math.max(0, Math.min(atlas.frameCount - 1, Math.round(frame)));
    currentFrameRef.current = boundedFrame;
    const element = textureRef.current;
    if (!element) return;
    const column = boundedFrame % atlas.columns;
    const row = Math.floor(boundedFrame / atlas.columns);
    const x = -(column / atlas.columns) * 100;
    const y = -(row / atlas.rows) * 100;
    element.style.transform = `translate3d(${x}%, ${y}%, 0)`;
  }, []);

  const cancelAction = useCallback(() => {
    actionTokenRef.current += 1;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    clearTimer(holdTimer);
  }, [clearTimer]);

  const playRange = useCallback((
    from: number,
    to: number,
    token: number,
    onComplete: () => void
  ) => {
    renderFrame(from);
    const startedAt = performance.now();
    const duration = Math.max(1, Math.abs(to - from) / FPS * 1_000);

    const tick = (now: number) => {
      if (token !== actionTokenRef.current) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      renderFrame(from + (to - from) * progress);
      if (progress >= 1) {
        animationFrameRef.current = null;
        onComplete();
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [renderFrame]);

  const scheduleRestRef = useRef<() => void>(() => undefined);

  const finishAwake = useCallback(() => {
    updateState("awake");
    renderFrame(AWAKE_FRAME);
    scheduleRestRef.current();
  }, [renderFrame, updateState]);

  const rise = useCallback(() => {
    clearTimer(idleTimer);
    cancelAction();
    if (reduceMotion) {
      updateState("awake");
      return;
    }
    updateState("rising");
    const token = actionTokenRef.current;
    const startFrame = currentFrameRef.current;
    playRange(startFrame, AWAKE_FRAME, token, finishAwake);
  }, [cancelAction, clearTimer, finishAwake, playRange, reduceMotion, updateState]);

  const settle = useCallback(() => {
    cancelAction();
    if (reduceMotion) {
      updateState("resting");
      return;
    }
    updateState("settling");
    const token = actionTokenRef.current;
    playRange(currentFrameRef.current, REST_END_FRAME, token, () => {
      updateState("resting");
      renderFrame(REST_END_FRAME);
    });
  }, [cancelAction, playRange, reduceMotion, renderFrame, updateState]);

  const scheduleRest = useCallback(() => {
    clearTimer(idleTimer);
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null;
      if (stateRef.current === "awake") settle();
    }, IDLE_DELAY);
  }, [clearTimer, settle]);

  useEffect(() => {
    scheduleRestRef.current = scheduleRest;
  }, [scheduleRest]);

  const yawn = useCallback(() => {
    clearTimer(idleTimer);
    cancelAction();
    if (reduceMotion) return;
    updateState("yawning");
    const token = actionTokenRef.current;
    playRange(AWAKE_FRAME, YAWN_FRAME, token, () => {
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        if (token !== actionTokenRef.current) return;
        playRange(YAWN_FRAME, AWAKE_FRAME, token, finishAwake);
      }, YAWN_HOLD_DELAY);
    });
  }, [cancelAction, clearTimer, finishAwake, playRange, reduceMotion, updateState]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    wakeDeadlineRef.current = performance.now() + WAKE_DELAY;
  }, []);

  useEffect(() => {
    let active = true;
    const image = new window.Image();
    image.src = "/images/dimmo-motion-atlas.webp";
    void image.decode().then(() => {
      if (active) setAtlasReady(true);
    }).catch(() => {
      if (active) setAtlasReady(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!atlasReady || reduceMotion) return;
    renderFrame(REST_START_FRAME);
    const remainingDelay = Math.max(
      0,
      (wakeDeadlineRef.current ?? performance.now()) - performance.now()
    );
    wakeTimer.current = window.setTimeout(() => {
      wakeTimer.current = null;
      rise();
    }, remainingDelay);
    return () => clearTimer(wakeTimer);
  }, [atlasReady, clearTimer, reduceMotion, renderFrame, rise]);

  useEffect(() => {
    if (state !== "awake") return;
    const noteActivity = () => scheduleRest();
    const options: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", noteActivity, options);
    window.addEventListener("touchstart", noteActivity, options);
    window.addEventListener("scroll", noteActivity, options);
    window.addEventListener("keydown", noteActivity);
    return () => {
      window.removeEventListener("pointerdown", noteActivity);
      window.removeEventListener("touchstart", noteActivity);
      window.removeEventListener("scroll", noteActivity);
      window.removeEventListener("keydown", noteActivity);
    };
  }, [scheduleRest, state]);

  useEffect(() => () => {
    cancelAction();
    clearTimer(wakeTimer);
    clearTimer(idleTimer);
  }, [cancelAction, clearTimer]);

  function interact() {
    clearTimer(wakeTimer);
    if (stateRef.current === "resting" || stateRef.current === "settling") {
      rise();
      return;
    }
    if (stateRef.current === "awake") yawn();
  }

  const label = state === "resting"
    ? "Dimmo 正趴着休息，点击叫醒"
    : state === "rising"
      ? "Dimmo 正在伸懒腰坐起来"
      : state === "settling"
        ? "Dimmo 正在打哈欠后趴下休息"
        : state === "yawning"
          ? "Dimmo 正在打哈欠"
          : "Dimmo 已经坐起来，点击看看反应";

  const showAtlas = atlasReady && !reduceMotion;
  const fallbackState = staticStateFor(state);

  return (
    <button
      type="button"
      onClick={interact}
      className="dimmo-companion relative h-24 w-24 shrink-0 rounded-2xl sm:h-28 sm:w-28"
      aria-label={label}
      title={label}
      data-dimmo-state={state}
    >
      {!showAtlas ? (
        <Image
          src={staticSprites[fallbackState]}
          alt=""
          fill
          unoptimized
          priority
          sizes="(min-width: 640px) 112px, 96px"
          className="dimmo-static-sprite object-contain"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="dimmo-atlas-sprite absolute inset-0"
        hidden={!showAtlas}
      >
        {/* One persistent atlas texture; only its compositor transform changes per frame. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={textureRef}
          src="/images/dimmo-motion-atlas.webp"
          alt=""
          draggable={false}
          decoding="async"
          className="dimmo-atlas-texture"
          style={{
            width: `${atlas.columns * 100}%`,
            height: `${atlas.rows * 100}%`
          }}
        />
      </div>
    </button>
  );
}
