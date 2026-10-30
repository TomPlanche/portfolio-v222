import type { PlaneKind } from './shape';
import { clamp, rand, TAU } from './util';

export type Livery = 'airfrance' | 'grey' | 'samu';

export type Plane = {
  id: number;
  kind: PlaneKind;
  livery: Livery;
  length: number;
  /** Nose position. */
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** 0.5 low and dim to 1 high up; it sets the shadow offset and whether contrails form. */
  altitude: number;
};

/** A marker dropped by a click: it falls in, then pings until it expires or a plane passes over it. */
export type Waypoint = {
  x: number;
  y: number;
  born: number;
  /** Seconds after `born` that it settles; until then it is still dropping in. */
  landAt: number;
  landed: boolean;
};

/** The moment a plane passes over a waypoint, drawn as a brief flash where it happened. */
export type Flyover = {
  x: number;
  y: number;
  born: number;
};

export const WAYPOINT_LIFE = 14;
/** Waypoints start to fade this many seconds in, gone by WAYPOINT_LIFE. */
export const WAYPOINT_FADE = 9;
export const FLYOVER_LIFE = 0.45;
const DROP_RADIUS = 34;
const MAX_WAYPOINTS = 24;
/** The share of new planes that are Rafales instead of airliners. */
const RAFALE_CHANCE = 0.25;
/** The share of new planes that are helicopters. */
const HELICOPTER_CHANCE = 0.15;
/**
 * The sky opens on one airliner and one Rafale alone. The rest of the traffic enters from the
 * edges one at a time, from ARRIVAL_START seconds on (when the site content fades in).
 */
const ARRIVAL_START = 2.5;
const ARRIVAL_GAP = 1.5;

const randomKind = (): PlaneKind => {
  const r = Math.random();

  return r < RAFALE_CHANCE
    ? 'rafale'
    : r < RAFALE_CHANCE + HELICOPTER_CHANCE
      ? 'helicopter'
      : 'airliner';
};

/** Distance from (x, y) along (dx, dy) to the edge of the W x H view, for a point inside it. */
const toEdge = (x: number, y: number, dx: number, dy: number, W: number, H: number) => {
  const tx = dx > 0 ? (W - x) / dx : dx < 0 ? -x / dx : Infinity;
  const ty = dy > 0 ? (H - y) / dy : dy < 0 ? -y / dy : Infinity;

  return Math.min(tx, ty);
};

/**
 * Plane traffic seen from above: each plane flies a straight line at a fixed speed and altitude,
 * and once it has left the view a new one enters from the edge.
 */
export class Sky {
  width = 0;
  height = 0;
  time = 0;
  planes: Plane[] = [];
  waypoints: Waypoint[] = [];
  flyovers: Flyover[] = [];
  private nextId = 1;
  private baseLength = 0;
  /** Times at which the planes still to come enter the view, soonest first. */
  private arrivals: number[] = [];

  resize(width: number, height: number) {
    const first = this.width === 0;
    this.width = width;
    this.height = height;

    if (!first) {
      return;
    }

    this.baseLength = clamp(Math.min(width, height) * 0.5, 170, 420);
    const count = clamp(Math.round((width * height) / 240000), 3, 6);

    // The opening pair is already on its way in, so the sky isn't empty on load.
    this.planes = [this.launch(rand(0.25, 0.4), 'airliner'), this.launch(rand(0.1, 0.2), 'rafale')];
    this.arrivals = Array.from({ length: count - 2 }, (_, k) => ARRIVAL_START + k * ARRIVAL_GAP);
  }

  /** A loose handful of waypoints dropped around (x, y), each settling a beat apart. */
  drop(x: number, y: number) {
    const count = Math.min(
      5 + Math.floor(Math.random() * 3),
      MAX_WAYPOINTS - this.waypoints.length
    );

    for (let k = 0; k < count; k++) {
      const a = rand(0, TAU);
      const r = Math.sqrt(Math.random()) * DROP_RADIUS;

      this.waypoints.push({
        x: x + Math.cos(a) * r * 1.3,
        y: y + Math.sin(a) * r,
        born: this.time,
        landAt: rand(0.15, 0.45),
        landed: false
      });
    }
  }

  step(dt: number) {
    this.time += dt;
    const t = this.time;

    while (this.arrivals.length > 0 && t >= this.arrivals[0]) {
      this.arrivals.shift();
      this.planes.push(this.launch(0));
    }

    for (let n = 0; n < this.planes.length; n++) {
      const p = this.planes[n];

      p.x += Math.cos(p.heading) * p.speed * dt;
      p.y += Math.sin(p.heading) * p.speed * dt;

      if (this.hasLeft(p)) {
        this.planes[n] = this.launch(0);
      }
    }

    this.waypoints = this.waypoints.filter((w) => t - w.born < WAYPOINT_LIFE);

    for (const w of this.waypoints) {
      if (!w.landed && t - w.born >= w.landAt) {
        w.landed = true;
      }
    }

    // A plane passing over a waypoint clears it.
    for (const p of this.planes) {
      const r = p.length * 0.12 + 8;
      const before = this.waypoints.length;

      this.waypoints = this.waypoints.filter(
        (w) => !w.landed || (w.x - p.x) ** 2 + (w.y - p.y) ** 2 > r * r
      );

      if (this.waypoints.length < before) {
        this.flyovers.push({ x: p.x, y: p.y, born: t });
      }
    }

    this.flyovers = this.flyovers.filter((f) => t - f.born < FLYOVER_LIFE);
  }

  /** Outside the view with its whole body, and still flying away from it. */
  private hasLeft(p: Plane) {
    const { width: W, height: H } = this;
    const margin = p.length * 1.1;
    const outside = p.x < -margin || p.x > W + margin || p.y < -margin || p.y > H + margin;

    return outside && (p.x - W / 2) * Math.cos(p.heading) + (p.y - H / 2) * Math.sin(p.heading) > 0;
  }

  /**
   * A plane on a straight course through a random point of the view. `progress` places it along
   * that course: 0 just outside the edge it enters from, 1 at the far edge.
   * `kind` is random when left out.
   */
  private launch(progress: number, kind: PlaneKind = randomKind()): Plane {
    const { width: W, height: H } = this;
    const rafale = kind === 'rafale';
    const helicopter = kind === 'helicopter';

    // A Rafale is much smaller than an airliner, and crosses the view about twice as fast.
    // An EC135 is two thirds of a Rafale's length, and cruises at about 250 km/h.
    const length =
      this.baseLength * (rafale ? rand(0.35, 0.45) : helicopter ? rand(0.27, 0.31) : rand(0.6, 1));
    const heading = rand(0, TAU);
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    const cx = rand(W * 0.2, W * 0.8);
    const cy = rand(H * 0.2, H * 0.8);

    // Start far enough back that the wings and the tail are off screen too.
    const back = toEdge(cx, cy, -dx, -dy, W, H) + length * 1.05;
    const ahead = toEdge(cx, cy, dx, dy, W, H);
    const along = -back + (back + ahead) * progress;

    return {
      id: this.nextId++,
      kind,
      livery: rafale ? 'grey' : helicopter ? 'samu' : 'airfrance',
      length,
      x: cx + dx * along,
      y: cy + dy * along,
      heading,
      speed: length * (rafale ? rand(1, 1.3) : helicopter ? rand(0.3, 0.4) : rand(0.2, 0.32)),
      // Helicopters fly low, under the altitude where contrails form.
      altitude: helicopter ? rand(0.5, 0.65) : rand(0.5, 1)
    };
  }
}
