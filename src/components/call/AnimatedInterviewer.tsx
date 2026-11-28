"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Level 1 lip-sync: the interviewer's mouth is driven by the loudness of the agent's audio.
 *
 * - The portrait (a normal next/image) is always rendered as the base layer, so if anything in the
 *   animation fails, the user simply sees the same static image as before.
 * - For the built-in interviewers (Lisa / Bob) an SVG overlay covers the drawn mouth with a skin
 *   patch and renders an animated mouth on top of it.
 * - For any other image (custom interviewers) there is no known mouth position, so the avatar
 *   gets a subtle voice-reactive ring instead.
 * - Animation is applied straight to DOM nodes inside a requestAnimationFrame loop, so React does
 *   not re-render 60 times per second.
 */

// ---------------------------------------------------------------------------
// Audio level
// ---------------------------------------------------------------------------

/** Minimal shape of the retell `AnalyzerComponent.analyser` that we need. */
type AnalyserLike = Pick<AnalyserNode, "fftSize" | "getFloatTimeDomainData">;

/**
 * Builds a function returning the current RMS level (0..~1) of the agent's audio, or `null` when
 * no analyser is available (e.g. the call has not started, or `emitRawAudioSamples` was not set).
 *
 * We read the time-domain RMS from the analyser ourselves instead of using
 * `analyzerComponent.calculateVolume()`, because that helper has a different scale depending on the
 * transport (livekit: frequency-domain, very sensitive; gateway: time-domain RMS).
 */
export function createLevelReader(
  getAnalyser: () => AnalyserLike | null | undefined,
): () => number | null {
  let buffer: Float32Array<ArrayBuffer> | null = null;

  return () => {
    const analyser = getAnalyser();
    if (!analyser) {
      return null;
    }
    if (!buffer || buffer.length !== analyser.fftSize) {
      buffer = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i];
      sum += sample * sample;
    }
    return Math.sqrt(sum / buffer.length);
  };
}

// ---------------------------------------------------------------------------
// Level -> mouth openness mapping (tweak these to taste)
// ---------------------------------------------------------------------------

/** RMS below this is treated as silence (noise gate). */
const NOISE_GATE = 0.015;
/** RMS that maps to a fully open mouth. */
const FULL_SCALE = 0.16;
/** Values < 1 open the mouth more readily on quiet speech. */
const RESPONSE_CURVE = 0.65;
/** Smoothing time constants in seconds: fast to open, slower to close. */
const ATTACK_TAU = 0.035;
const RELEASE_TAU = 0.11;
/** After this many consecutive failing frames we give up and show the static image. */
const MAX_CONSECUTIVE_ERRORS = 3;

function levelToOpenness(level: number): number {
  const x = (level - NOISE_GATE) / (FULL_SCALE - NOISE_GATE);
  if (!(x > 0)) {
    return 0;
  }
  return Math.min(1, x ** RESPONSE_CURVE);
}

/** Used only when no audio analyser is available but the agent is known to be talking. */
function syntheticOpenness(timeSec: number): number {
  const syllable = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2 * 5.2);
  const phrase = 0.65 + 0.35 * Math.sin(timeSec * Math.PI * 2 * 1.3 + 1);
  return 0.15 + 0.6 * syllable * phrase;
}

// ---------------------------------------------------------------------------
// Per-interviewer mouth geometry (coordinates are in the portrait's pixel space)
// ---------------------------------------------------------------------------

type MouthShape = {
  /** Height of the upper lip curve above the mouth corners (negative = sags below them). */
  up: number;
  /** Depth of the lower lip curve below the mouth corners. */
  low: number;
};

type MouthSpec = {
  /** Width/height of the (square) portrait image in px. */
  size: number;
  /** Mouth centre x and the y of the mouth corners. */
  cx: number;
  cy: number;
  /** Half the mouth width when closed. */
  halfWidth: number;
  /** How much the mouth narrows (0..1) when fully open. */
  narrowing: number;
  /** Rotation of the mouth in degrees around its centre. */
  tilt: number;
  /** Rectangle (white) that hides the mouth drawn in the original portrait. */
  patch: { x: number; y: number; width: number; height: number; radius: number };
  rest: MouthShape;
  max: MouthShape;
};

const MOUTH_SPECS: Record<string, MouthSpec> = {
  lisa: {
    size: 361,
    cx: 220,
    cy: 231,
    halfWidth: 21,
    narrowing: 0.12,
    tilt: 0,
    patch: { x: 192, y: 221, width: 52, height: 26, radius: 9 },
    rest: { up: 3.2, low: 5 },
    max: { up: 5, low: 17 },
  },
  bob: {
    size: 360,
    cx: 203,
    cy: 247,
    halfWidth: 29,
    narrowing: 0.1,
    tilt: 0,
    patch: { x: 167, y: 240, width: 69, height: 36, radius: 10 },
    rest: { up: -2.5, low: 15 },
    max: { up: -1, low: 30 },
  },
};

function resolveMouthSpec(src: string): MouthSpec | null {
  const match = /^\/interviewers\/(lisa|bob)\.png(?:\?.*)?$/i.exec(src);
  return match ? MOUTH_SPECS[match[1].toLowerCase()] : null;
}

const INK = "#0a0a0a";
const TEETH_INSET = 0.8;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mouth outline: two parabolic lips meeting at the corners. */
function mouthPath(spec: MouthSpec, openness: number): string {
  const w = spec.halfWidth * (1 - spec.narrowing * openness);
  const up = lerp(spec.rest.up, spec.max.up, openness);
  const low = lerp(spec.rest.low, spec.max.low, openness);
  const x1 = round(spec.cx - w);
  const x2 = round(spec.cx + w);
  const { cx, cy } = spec;
  return `M${x1} ${cy}Q${cx} ${round(cy - 2 * up)} ${x2} ${cy}Q${cx} ${round(cy + 2 * low)} ${x1} ${cy}Z`;
}

/**
 * Upper teeth: the part of the mouth between the upper lip and a shallower curve, inset from the
 * corners. Both edges are sub-segments of parabolas (y = cy -/+ depth * (1 - u^2)), so the shape
 * always stays inside the mouth.
 */
function teethPath(spec: MouthSpec, openness: number): string {
  const w = spec.halfWidth * (1 - spec.narrowing * openness);
  const up = lerp(spec.rest.up, spec.max.up, openness);
  const low = lerp(spec.rest.low, spec.max.low, openness);
  const depth = Math.min(low * 0.38, 5.5);
  const a = TEETH_INSET;
  const { cx, cy } = spec;
  const left = round(cx - a * w);
  const right = round(cx + a * w);
  const topEnd = round(cy - up * (1 - a * a));
  const topCtrl = round(cy - up * (1 + a * a));
  const bottomEnd = round(cy + depth * (1 - a * a));
  const bottomCtrl = round(cy + depth * (1 + a * a));
  return `M${left} ${topEnd}Q${cx} ${topCtrl} ${right} ${topEnd}L${right} ${bottomEnd}Q${cx} ${bottomCtrl} ${left} ${bottomEnd}Z`;
}

// ---------------------------------------------------------------------------
// prefers-reduced-motion
// ---------------------------------------------------------------------------

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type AnimatedInterviewerProps = {
  /** Portrait URL (same value that used to be passed to <Image>). */
  src: string;
  alt: string;
  /** Total outer size in px, including the 4px highlight border. */
  size?: number;
  /** Colour of the "agent is talking" border. */
  themeColor?: string | null;
  /** True while the call is live; the animation loop only runs then. */
  active: boolean;
  /** True while Retell reports the agent as talking (used for the border highlight). */
  speaking: boolean;
  /** Returns the agent's current audio level (RMS), or null if unavailable. */
  getLevel: () => number | null;
};

const BORDER_WIDTH = 4;
const DEFAULT_THEME_COLOR = "#4F46E5";

export default function AnimatedInterviewer({
  src,
  alt,
  size = 128,
  themeColor,
  active,
  speaking,
  getLevel,
}: AnimatedInterviewerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  const spec = useMemo(() => resolveMouthSpec(src), [src]);
  const color = themeColor || DEFAULT_THEME_COLOR;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const motionRef = useRef<HTMLDivElement | null>(null);
  const mouthRef = useRef<SVGPathElement | null>(null);
  const innerRef = useRef<SVGPathElement | null>(null);
  const teethRef = useRef<SVGPathElement | null>(null);

  // Latest props for the animation loop, without restarting it on every change.
  const speakingRef = useRef(speaking);
  const getLevelRef = useRef(getLevel);
  speakingRef.current = speaking;
  getLevelRef.current = getLevel;

  const animate = active && !reducedMotion && !failed;
  const showMouthOverlay = animate && spec !== null;

  useEffect(() => {
    if (!animate) {
      return;
    }

    const applyFrame = (openness: number) => {
      if (spec) {
        const d = mouthPath(spec, openness);
        mouthRef.current?.setAttribute("d", d);
        innerRef.current?.setAttribute("d", d);
        innerRef.current?.setAttribute("opacity", String(Math.min(1, openness * 6)));
        const teeth = teethRef.current;
        if (teeth) {
          teeth.setAttribute("d", teethPath(spec, openness));
          teeth.setAttribute("opacity", String(Math.min(1, Math.max(0, (openness - 0.15) * 3))));
        }
        const motion = motionRef.current;
        if (motion) {
          motion.style.transform = `translateY(${round(-openness * 1.2)}px) rotate(${round(
            openness * 0.7,
          )}deg)`;
        }
      } else {
        // Unknown portrait: voice-reactive ring + tiny scale pulse.
        const container = containerRef.current;
        if (container) {
          container.style.boxShadow =
            openness > 0.02 ? `0 0 0 ${round(openness * 9)}px ${color}33` : "none";
          container.style.transform = `scale(${round(1 + openness * 0.03)})`;
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    const start = last;
    let smooth = 0;
    let consecutiveErrors = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
      last = now;

      try {
        const level = getLevelRef.current();
        let target = 0;
        if (level === null) {
          // No analyser: fall back to a procedural mouth while the agent is talking.
          target = speakingRef.current ? syntheticOpenness((now - start) / 1000) : 0;
        } else {
          // Rely on the audio level (with a noise gate) rather than on the talking events,
          // because Retell's start/stop-talking boundaries are not exact.
          target = levelToOpenness(level);
        }

        const tau = target > smooth ? ATTACK_TAU : RELEASE_TAU;
        smooth += (target - smooth) * (1 - Math.exp(-dt / tau));
        if (smooth < 0.01 && target === 0) {
          smooth = 0;
        }
        applyFrame(smooth);
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error("Lip-sync disabled, falling back to the static image:", error);
          setFailed(true);
          return;
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      try {
        applyFrame(0);
      } catch {
        // Nothing to reset if the DOM nodes are already gone.
      }
      const container = containerRef.current;
      if (container) {
        container.style.boxShadow = "none";
        container.style.transform = "";
      }
      if (motionRef.current) {
        motionRef.current.style.transform = "";
      }
    };
  }, [animate, spec, color]);

  const closedPath = spec ? mouthPath(spec, 0) : "";

  return (
    <div
      ref={containerRef}
      className="relative mx-auto my-auto overflow-hidden rounded-full bg-white box-border"
      style={{
        width: size,
        height: size,
        borderWidth: BORDER_WIDTH,
        borderStyle: "solid",
        borderColor: speaking ? color : "transparent",
        transition: reducedMotion ? "none" : "border-color 150ms ease-out",
      }}
    >
      <div ref={motionRef} className="absolute inset-0 will-change-transform">
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover object-center"
        />
        {showMouthOverlay && spec && (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox={`0 0 ${spec.size} ${spec.size}`}
            className="absolute inset-0 h-full w-full pointer-events-none"
          >
            <g transform={`rotate(${spec.tilt} ${spec.cx} ${spec.cy})`}>
              <rect
                x={spec.patch.x}
                y={spec.patch.y}
                width={spec.patch.width}
                height={spec.patch.height}
                rx={spec.patch.radius}
                fill="#fff"
              />
              <path
                ref={mouthRef}
                d={closedPath}
                fill="#fff"
                stroke={INK}
                strokeWidth={3.6}
                strokeLinejoin="round"
              />
              <path ref={innerRef} d={closedPath} fill={INK} opacity={0} />
              <path ref={teethRef} d={closedPath} fill="#fff" opacity={0} />
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
