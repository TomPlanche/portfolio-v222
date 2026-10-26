import { smoothstep } from './util';

export const PART_FUSELAGE = 1;
export const PART_WING = 2;
export const PART_STABILIZER = 3;
export const PART_ENGINE = 4;
export const PART_COCKPIT = 5;
export const PART_FIN = 6;

export type PlaneKind = 'airliner' | 'rafale';

/** Where a point landed on the plane; `chord` runs 0 at a leading edge to 1 at the trailing edge. */
export type PlaneHit = {
  part: number;
  across: number;
  chord: number;
  span: number;
};

/** The geometry of one kind of plane, in body coordinates as fractions of its length. */
export type PlaneShape = {
  classify: (s: number, a: number, out: PlaneHit) => boolean;
  /** Sweep of the main wing and of the small front or rear surfaces, for the edge glyphs. */
  wingSweep: number;
  stabilizerSweep: number;
  /** Where the contrails leave the plane: back from the nose, and out from the centreline. */
  exhaustS: number;
  exhaustA: number;
};

/** Test a point against a swept, tapered surface whose root sits on the centreline. */
const inSurface = (
  s: number,
  a: number,
  rootLe: number,
  rootChord: number,
  tipChord: number,
  span: number,
  sweep: number,
  out: PlaneHit
) => {
  const t = a / span;
  if (t > 1) {
    return false;
  }

  const le = rootLe + sweep * a;
  const chord = rootChord + (tipChord - rootChord) * t;
  if (s < le || s > le + chord) {
    return false;
  }

  out.chord = (s - le) / chord;
  out.span = t;

  return true;
};

/** Test a point against an elliptical pod, with `chord` running 0 at its front to 1 at its back. */
const inPod = (
  s: number,
  a: number,
  podS: number,
  podA: number,
  halfLength: number,
  halfWidth: number,
  out: PlaneHit
) => {
  const ps = (s - podS) / halfLength;
  const pa = (a - podA) / halfWidth;

  if (ps * ps + pa * pa >= 1) {
    return false;
  }

  out.chord = (ps + 1) / 2;

  return true;
};

const resetHit = (out: PlaneHit) => {
  out.part = 0;
  out.across = 1;
  out.chord = 0;
  out.span = 0;
};

// ── airliner ────────────────────────────────────────────────────────

/** Top-down outline as a fraction of length: rounded nose, straight cabin, tapering tail cone. */
const airlinerHalfWidth = (s: number) => {
  if (s < 0.1) {
    return 0.05 * Math.pow(Math.sin(((s / 0.1) * Math.PI) / 2), 0.6);
  }

  if (s < 0.78) {
    return 0.05;
  }

  return 0.05 - 0.035 * smoothstep(0.78, 1, s);
};

// Engine nacelles hang under each wing, poking out ahead of the leading edge.
const AIRLINER_ENGINE_S = 0.43;
const AIRLINER_ENGINE_A = 0.16;

/**
 * Classify a point given in body coordinates, as fractions of length:
 * `s` back from the nose (0) to the tail (1), and `a` out from the centreline on either side.
 */
const classifyAirliner = (s: number, a: number, out: PlaneHit) => {
  resetHit(out);

  if (s < 0 || s > 1) {
    return false;
  }

  const w = airlinerHalfWidth(s);

  if (a <= w) {
    const across = a / w;
    out.across = across;

    if (s > 0.8 && a < 0.02) {
      out.part = PART_FIN;
    } else if (s > 0.035 && s < 0.075 && across > 0.2 && across < 0.85) {
      out.part = PART_COCKPIT;
    } else {
      out.part = PART_FUSELAGE;
    }

    return true;
  }

  if (inSurface(s, a, 0.34, 0.22, 0.07, 0.5, AIRLINER.wingSweep, out)) {
    out.part = PART_WING;

    return true;
  }

  if (inPod(s, a, AIRLINER_ENGINE_S, AIRLINER_ENGINE_A, 0.065, 0.026, out)) {
    out.part = PART_ENGINE;

    return true;
  }

  if (inSurface(s, a, 0.83, 0.11, 0.045, 0.18, AIRLINER.stabilizerSweep, out)) {
    out.part = PART_STABILIZER;

    return true;
  }

  return false;
};

const AIRLINER: PlaneShape = {
  classify: classifyAirliner,
  wingSweep: 0.55,
  stabilizerSweep: 0.6,
  exhaustS: AIRLINER_ENGINE_S + 0.08,
  exhaustA: AIRLINER_ENGINE_A
};

// ── rafale ──────────────────────────────────────────────────────────

/** A long pointed radome that widens into the cockpit, then a straight body over the twin engines. */
const rafaleHalfWidth = (s: number) => {
  if (s < 0.3) {
    return 0.06 * Math.pow(Math.sin(((s / 0.3) * Math.PI) / 2), 0.8);
  }

  return 0.06;
};

/**
 * Same body coordinates as `classifyAirliner`. A delta wing, canards just behind the cockpit,
 * air intakes on the sides, a single fin and two nozzles at the very back.
 */
const classifyRafale = (s: number, a: number, out: PlaneHit) => {
  resetHit(out);
  if (s < 0 || s > 1) {
    return false;
  }

  const w = rafaleHalfWidth(s);
  if (a <= w) {
    const across = a / w;
    out.across = across;

    if (s > 0.95 && across > 0.15) {
      // The nozzles: `chord` 0 at the outlet, so the dark ring sits at the back.
      out.part = PART_ENGINE;
      out.chord = (1 - s) / 0.05;
    } else if (s > 0.7 && a < 0.012) {
      out.part = PART_FIN;
    } else if (s > 0.15 && s < 0.28 && across < 0.7) {
      out.part = PART_COCKPIT;
    } else {
      out.part = PART_FUSELAGE;
    }

    return true;
  }

  if (inPod(s, a, 0.4, 0.07, 0.08, 0.02, out)) {
    out.part = PART_ENGINE;

    return true;
  }

  if (inSurface(s, a, 0.31, 0.09, 0.04, 0.19, RAFALE.stabilizerSweep, out)) {
    out.part = PART_STABILIZER;

    return true;
  }

  if (inSurface(s, a, 0.44, 0.54, 0.07, 0.36, RAFALE.wingSweep, out)) {
    out.part = PART_WING;

    return true;
  }

  return false;
};

const RAFALE: PlaneShape = {
  classify: classifyRafale,
  wingSweep: 1.15,
  stabilizerSweep: 0.95,
  exhaustS: 1,
  exhaustA: 0.03
};

export const SHAPES: Record<PlaneKind, PlaneShape> = {
  airliner: AIRLINER,
  rafale: RAFALE
};
