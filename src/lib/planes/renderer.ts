import {
  PART_COCKPIT,
  PART_ENGINE,
  PART_FIN,
  PART_STABILIZER,
  PART_WING,
  type PlaneHit,
  type PlaneShape,
  SHAPES
} from './shape';
import {
  FLYOVER_LIFE,
  type Livery,
  type Plane,
  type Sky,
  WAYPOINT_FADE,
  WAYPOINT_LIFE
} from './sky';
import { clamp, hash3, lineGlyph, mix, packRgb, type Rgb, shade, smoothstep } from './util';

// Colours from the site's own palette (`main.scss`): the page background, `--text-color`,
// `--rust-orange` and `--zed-blue-text`.
const BG: Rgb = [18, 19, 22];
const WHITE: Rgb = [236, 234, 223];
const RED: Rgb = [211, 69, 22];
const NAVY: Rgb = [72, 128, 170];
const METAL: Rgb = [176, 178, 190];
const ENGINE: Rgb = [128, 128, 142];
const GLASS: Rgb = [10, 10, 12];
// The Rafale's two-tone grey, with a darker radome.
const GREY_LIGHT: Rgb = [138, 146, 156];
const GREY_DARK: Rgb = [108, 116, 128];
const RADOME: Rgb = [84, 90, 100];
const TRAIL: Rgb = WHITE;
const MARKER: Rgb = [142, 197, 255];
// The afterburner runs from a white-hot core at the nozzles to orange, then to red at its tip.
const FLAME_CORE: Rgb = [255, 238, 190];
const FLAME: Rgb = [255, 150, 60];
/** Flame length as a fraction of the plane's apparent length, and its half width at the nozzles. */
const FLAME_LENGTH = 0.4;
const FLAME_WIDTH = 0.05;
/** How many times a second the flame flickers. */
const FLAME_FLICKER = 18;
const SHADOW: Rgb = [0, 0, 0];
const SHADOW_ALPHA = 0.5;
const ALPHA = 0.85;
/** How much a low plane fades, as the alpha it keeps at its lowest altitude. */
const ALTITUDE_FLOOR = 0.5;
/** How much paint colour a tile carries, from shadow to lit; the rest is page background. */
const TILE_SHADOW = 0.6;
const TILE_LIT = 0.95;
/** Glyph brightness relative to the tile under it. */
const INK = 0.42;

/** `noseEnd` is how far back the nose paint goes, as a fraction of length. */
type Paint = {
  body: Rgb;
  wing: Rgb;
  tail: Rgb;
  stripe: Rgb | null;
  nose: Rgb | null;
  noseEnd: number;
};

const PAINTS: Record<Livery, Paint> = {
  red: { body: WHITE, wing: METAL, tail: RED, stripe: RED, nose: null, noseEnd: 0.07 },
  navy: { body: WHITE, wing: METAL, tail: NAVY, stripe: NAVY, nose: RED, noseEnd: 0.07 },
  white: { body: WHITE, wing: METAL, tail: RED, stripe: null, nose: RED, noseEnd: 0.07 },
  grey: {
    body: GREY_LIGHT,
    wing: GREY_DARK,
    tail: GREY_DARK,
    stripe: null,
    nose: RADOME,
    noseEnd: 0.1
  }
};

// Dense glyphs etched into the hull, sparse where it catches the light.
const HULL_GLYPHS = '=+*#%@';
// The cell centre first, so a cell takes its part from the middle; then four sub-samples for coverage.
const SAMPLES = [0.5, 0.5, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75];
// Contrails only form high up.
const TRAIL_ALTITUDE = 0.72;

/** Planes higher up look a little larger, as they are closer to the viewer. */
const apparentLength = (p: Plane) => p.length * (0.8 + 0.3 * p.altitude);

/**
 * Draws the sky on a grid of cells: each cell under a plane is a tile washed in its paint colour,
 * with an ASCII glyph etched on top.
 */
export class PlaneRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cw = 8;
  private ch = 12;
  private cols = 0;
  private rows = 0;
  private styles = new Map<number, string>();
  private fontFamily = '"Supply Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  private trail = new Float32Array(0);
  private trailTmp = new Float32Array(0);
  /** Heading of the plane that last laid a contrail through each cell, so the glyph follows the trail. */
  private trailDx = new Float32Array(0);
  private trailDy = new Float32Array(0);
  private cellGlyph = new Uint16Array(0);
  private cellColor = new Uint32Array(0);
  private cellAlpha = new Float32Array(0);
  private cellTile = new Uint32Array(0);
  private cellTileAlpha = new Float32Array(0);
  /** Cells under a plane's shadow on the ground. */
  private cellShadow = new Uint8Array(0);

  // The plane being drawn: nose position, heading, and its apparent length.
  private noseX = 0;
  private noseY = 0;
  private fx = 1;
  private fy = 0;
  private invL = 1;
  private shape: PlaneShape = SHAPES.airliner;
  // Scratch outputs of probe(), to avoid allocating per sample.
  private hit: PlaneHit = { part: 0, across: 1, chord: 0, span: 0 };
  private hitS = 0;
  private hitSide = 1;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas unavailable');
    }
    this.ctx = ctx;
  }

  resize(width: number, height: number, dpr: number) {
    this.dpr = dpr;
    this.cw = clamp(Math.round(width / 125), 8, 12);
    this.ch = this.cw + 2;
    this.cols = Math.ceil(width / this.cw);
    this.rows = Math.ceil(height / this.ch);
    this.ctx.canvas.width = Math.round(width * dpr);
    this.ctx.canvas.height = Math.round(height * dpr);

    const n = this.cols * this.rows;
    this.trail = new Float32Array(n);
    this.trailTmp = new Float32Array(n);
    this.trailDx = new Float32Array(n);
    this.trailDy = new Float32Array(n);
    this.cellGlyph = new Uint16Array(n);
    this.cellColor = new Uint32Array(n);
    this.cellAlpha = new Float32Array(n);
    this.cellTile = new Uint32Array(n);
    this.cellTileAlpha = new Float32Array(n);
    this.cellShadow = new Uint8Array(n);
  }

  render(sky: Sky, dt: number) {
    const { ctx, dpr, cols } = this;
    if (cols === 0) {
      return;
    }

    this.cellGlyph.fill(0);
    this.cellTileAlpha.fill(0);
    this.cellShadow.fill(0);
    // Lower planes first, so the ones flying higher pass over them.
    for (const p of [...sky.planes].sort((a, b) => a.altitude - b.altitude)) {
      this.rasterizePlane(p);
    }
    this.depositTrails(sky);
    this.diffuse(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `600 ${Math.round(this.ch * 0.72)}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.drawShadows();
    this.drawTrails();
    this.drawWaypoints(sky);
    this.drawCells();
    this.drawAfterburners(sky);
    this.drawFlyovers(sky);
    ctx.globalAlpha = 1;
  }

  private style(rgb: number) {
    let s = this.styles.get(rgb);

    if (!s) {
      s = `rgb(${rgb >>> 16},${(rgb >>> 8) & 255},${rgb & 255})`;
      this.styles.set(rgb, s);
    }

    return s;
  }

  private glyphAt(i: number, glyph: string, rgb: Rgb, alpha: number) {
    const { ctx, cw, ch, cols } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.style(packRgb(rgb));
    ctx.fillText(glyph, (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
  }

  private cellIndex(x: number, y: number) {
    const c = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);

    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) {
      return -1;
    }

    return r * this.cols + c;
  }

  // ── planes ──────────────────────────────────────────────────────────

  /** Set up the body frame for one plane: it is rigid, so the nose and heading place every part. */
  private orient(p: Plane) {
    this.noseX = p.x;
    this.noseY = p.y;
    this.fx = Math.cos(p.heading);
    this.fy = Math.sin(p.heading);
    this.invL = 1 / apparentLength(p);
    this.shape = SHAPES[p.kind];
  }

  /** Classify a screen point against the oriented plane. */
  private probe(x: number, y: number) {
    const dx = x - this.noseX;
    const dy = y - this.noseY;
    const s = -(dx * this.fx + dy * this.fy) * this.invL;
    const lat = (dy * this.fx - dx * this.fy) * this.invL;
    this.hitS = s;
    this.hitSide = lat >= 0 ? 1 : -1;

    return this.shape.classify(s, Math.abs(lat), this.hit);
  }

  private rasterizePlane(p: Plane) {
    const { cw, ch, cols, rows, cellGlyph, cellColor, cellAlpha, cellTile, cellTileAlpha } = this;
    const L = apparentLength(p);
    this.orient(p);
    const { fx, fy } = this;

    const cx = this.noseX - fx * L * 0.5;
    const cy = this.noseY - fy * L * 0.5;
    const reach = L * 0.72;
    const c0 = Math.max(0, Math.floor((cx - reach) / cw));
    const c1 = Math.min(cols - 1, Math.floor((cx + reach) / cw));
    const r0 = Math.max(0, Math.floor((cy - reach) / ch));
    const r1 = Math.min(rows - 1, Math.floor((cy + reach) / ch));

    if (c0 > c1 || r0 > r1) {
      return;
    }

    // Higher up, a plane is brighter and its shadow falls farther away on the ground.
    const shadowDc = Math.round((L * 0.22 * p.altitude) / cw) + 1;
    const shadowDr = Math.round((L * 0.16 * p.altitude) / ch) + 1;
    const dim = ALPHA * (ALTITUDE_FLOOR + (1 - ALTITUDE_FLOOR) * p.altitude);
    const paint = PAINTS[p.livery];
    const hit = this.hit;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = c * cw;
        const y = r * ch;
        let hits = 0;
        let part = 0;
        let across = 1;
        let chord = 0;
        let span = 0;
        let s = 0;
        let side = 1;

        for (let q = 0; q < SAMPLES.length; q += 2) {
          if (!this.probe(x + SAMPLES[q] * cw, y + SAMPLES[q + 1] * ch)) {
            continue;
          }

          if (hits === 0) {
            ({ part, across, chord, span } = hit);
            s = this.hitS;
            side = this.hitSide;
          }

          hits++;
        }

        if (hits === 0) {
          continue;
        }

        const coverage = hits / 5;
        const solid = coverage >= 0.6;
        const i = r * cols + c;
        // Body-anchored key so each glyph rides along with the plane.
        const key =
          (hash3(Math.round(s * 80), Math.round(span * 12) * side, p.id) * 4294967295) >>> 0;
        // Which way this side of the plane faces, against light from the top-left of the screen.
        const facing = side * (0.8 * fy - 0.6 * fx);

        let glyph = ' ';
        let rgb: Rgb = METAL;
        let alpha = dim;
        let tile: Rgb;

        const tileAlpha = solid ? dim : dim * coverage * 0.55;

        if (part === PART_COCKPIT) {
          tile = mix(BG, GLASS, 0.85);

          if (solid) {
            glyph = '=';
          }
          rgb = mix(BG, WHITE, 0.85);
        } else if (part === PART_FIN) {
          tile = mix(BG, paint.tail, TILE_LIT);
          glyph = lineGlyph(fx, fy);
          rgb = shade(tile, INK + 0.25);
        } else if (part === PART_ENGINE) {
          tile = mix(BG, ENGINE, TILE_LIT);
          // The intake is a dark ring at the front of the nacelle.
          glyph = chord < 0.3 ? 'o' : '#';
          rgb = chord < 0.3 ? mix(BG, GLASS, 0.8) : shade(tile, INK);
        } else if (part === PART_WING || part === PART_STABILIZER) {
          const lum = clamp(0.62 - 0.3 * chord + 0.15 * facing, 0, 1);
          const base = part === PART_STABILIZER ? mix(paint.wing, paint.tail, 0.55) : paint.wing;

          tile = mix(BG, base, TILE_SHADOW + (TILE_LIT - TILE_SHADOW) * lum);
          rgb = shade(tile, INK);

          if (solid && (chord < 0.2 || chord > 0.85)) {
            // Leading and trailing edges are drawn as lines along the swept edge.
            const sweep = part === PART_WING ? this.shape.wingSweep : this.shape.stabilizerSweep;
            glyph = lineGlyph(-side * fy - sweep * fx, side * fx - sweep * fy);
          } else if (solid && key % 3 === 0) {
            glyph = '.';
            alpha *= 0.7;
          }
        } else {
          const lum = clamp(
            0.25 + 0.55 * Math.sqrt(1 - across * across) + 0.2 * facing * across,
            0,
            1
          );
          const colour =
            paint.nose && s < paint.noseEnd
              ? paint.nose
              : paint.stripe && across > 0.5 && across < 0.8 && s > 0.1 && s < 0.78
                ? paint.stripe
                : paint.body;
          tile = mix(BG, colour, TILE_SHADOW + (TILE_LIT - TILE_SHADOW) * lum);

          if (solid) {
            const jitter = (key >>> 4) % 2;
            glyph =
              HULL_GLYPHS[clamp(Math.round((1 - lum) * 4) + jitter, 0, HULL_GLYPHS.length - 1)];
            rgb = shade(tile, INK);
            // White paint is etched lightly so the livery carries the pattern.
            if (colour === WHITE) {
              alpha *= 0.6;
            }
          }
        }

        if (solid && part !== PART_ENGINE) {
          const sc = c + shadowDc;
          const sr = r + shadowDr;

          if (sc < cols && sr < rows) {
            this.cellShadow[sr * cols + sc] = 1;
          }
        }

        cellTile[i] = packRgb(tile);
        cellTileAlpha[i] = tileAlpha;
        cellGlyph[i] = glyph.charCodeAt(0);
        cellColor[i] = packRgb(rgb);
        cellAlpha[i] = alpha;
      }
    }
  }

  private drawCells() {
    const { ctx, cw, ch, cols, cellGlyph, cellColor, cellAlpha, cellTile, cellTileAlpha } = this;

    for (let i = 0; i < cellGlyph.length; i++) {
      const code = cellGlyph[i];

      if (!code) {
        continue;
      }

      const x = (i % cols) * cw;
      const y = ((i / cols) | 0) * ch;

      if (cellTileAlpha[i] > 0) {
        ctx.globalAlpha = cellTileAlpha[i];
        ctx.fillStyle = this.style(cellTile[i]);
        ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      }

      if (code === 32) {
        continue;
      }

      ctx.globalAlpha = cellAlpha[i];
      ctx.fillStyle = this.style(cellColor[i]);
      ctx.fillText(String.fromCharCode(code), x + cw / 2, y + ch / 2 + 1);
    }
  }

  /**
   * A flickering cone of flame behind each Rafale's nozzles: dense and white near the outlet,
   * thinning to orange and red sparks at the tip, with a brighter shock diamond along the way.
   */
  private drawAfterburners(sky: Sky) {
    const { cw, ch, cols, rows, cellGlyph } = this;
    const frame = Math.floor(sky.time * FLAME_FLICKER);

    for (const p of sky.planes) {
      if (p.kind !== 'rafale') {
        continue;
      }

      this.orient(p);
      const L = apparentLength(p);
      const { fx, fy, noseX, noseY } = this;
      // The length breathes from frame to frame, so the flame never sits still.
      const length = FLAME_LENGTH * (0.85 + 0.3 * hash3(p.id, frame, 7));
      const tailX = noseX - fx * L;
      const tailY = noseY - fy * L;
      const reach = length * L;
      const c0 = Math.max(0, Math.floor((tailX - reach) / cw) - 1);
      const c1 = Math.min(cols - 1, Math.floor((tailX + reach) / cw) + 1);
      const r0 = Math.max(0, Math.floor((tailY - reach) / ch) - 1);
      const r1 = Math.min(rows - 1, Math.floor((tailY + reach) / ch) + 1);

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * cols + c;

          if (cellGlyph[i]) {
            continue;
          }

          const dx = c * cw + cw / 2 - tailX;
          const dy = r * ch + ch / 2 - tailY;
          // `t` runs 0 at the nozzles to 1 at the tip of the flame.
          const t = -(dx * fx + dy * fy) / reach;
          const lat = Math.abs(dy * fx - dx * fy) / L;
          const half = FLAME_WIDTH * Math.pow(1 - t, 0.6);

          if (t < 0 || t > 1 || lat > half + 0.5 * (cw / L)) {
            continue;
          }

          const flicker = hash3(c, r, frame);

          // Past the core, cells drop out more and more, so the tip breaks up into sparks.
          if (t > 0.35 && flicker < (t - 0.35) * 1.2) {
            continue;
          }

          const diamond = Math.exp(-(((t - 0.3) / 0.08) ** 2));
          const heat = clamp(1 - t * 1.4 + 0.5 * diamond, 0, 1);
          const rgb =
            heat > 0.5 ? mix(FLAME, FLAME_CORE, (heat - 0.5) * 2) : mix(RED, FLAME, heat * 2);
          const glyph =
            heat > 0.75 ? '#' : heat > 0.45 ? '*' : heat > 0.2 ? '+' : flicker < 0.5 ? ',' : '.';

          this.glyphAt(i, glyph, rgb, ALPHA * (0.55 + 0.45 * heat) * (0.75 + 0.25 * flicker));
        }
      }
    }
  }

  // ── sky ─────────────────────────────────────────────────────────────

  /** High planes leave a contrail from each engine. */
  private depositTrails(sky: Sky) {
    const { trail, trailDx, trailDy } = this;
    for (const p of sky.planes) {
      const form = smoothstep(TRAIL_ALTITUDE, TRAIL_ALTITUDE + 0.15, p.altitude);

      if (form <= 0) {
        continue;
      }

      this.orient(p);
      const L = apparentLength(p);
      const back = this.shape.exhaustS * L;
      const out = this.shape.exhaustA * L;

      for (const side of [-1, 1]) {
        const x = this.noseX - this.fx * back - this.fy * out * side;
        const y = this.noseY - this.fy * back + this.fx * out * side;
        const i = this.cellIndex(x, y);

        if (i < 0) {
          continue;
        }

        trail[i] = Math.min(1.5, trail[i] + 0.09 * form);
        trailDx[i] = this.fx;
        trailDy[i] = this.fy;
      }
    }
  }

  /** A light blur and a slow decay, so contrails stay thin and linger before they fade. */
  private diffuse(dt: number) {
    const { cols, rows, trail, trailTmp: tmp } = this;
    const decay = Math.exp(-dt * 0.45);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const l = c > 0 ? trail[i - 1] : trail[i];
        const rt = c < cols - 1 ? trail[i + 1] : trail[i];
        const u = r > 0 ? trail[i - cols] : trail[i];
        const d = r < rows - 1 ? trail[i + cols] : trail[i];
        tmp[i] = (trail[i] * 6 + l + rt + u + d) * 0.1 * decay;
      }
    }

    this.trail = tmp;
    this.trailTmp = trail;
  }

  private drawShadows() {
    const { cellShadow, cellGlyph } = this;

    for (let i = 0; i < cellShadow.length; i++) {
      if (cellShadow[i] && !cellGlyph[i]) {
        this.glyphAt(i, ':', SHADOW, SHADOW_ALPHA);
      }
    }
  }

  private drawTrails() {
    const { trail, trailDx, trailDy, cellGlyph, cellShadow } = this;

    for (let i = 0; i < trail.length; i++) {
      const e = trail[i];

      if (e < 0.15 || cellGlyph[i] || cellShadow[i]) {
        continue;
      }

      const laid = trailDx[i] !== 0 || trailDy[i] !== 0;
      const glyph = e > 0.4 && laid ? lineGlyph(trailDx[i], trailDy[i]) : '.';

      this.glyphAt(i, glyph, TRAIL, Math.min(1, (e - 0.15) * 1.6) * 0.4);
    }
  }

  /**
   * Waypoints drop in (' then .), then mark the spot with a + that sends out a radar ping every
   * couple of seconds, and dim to . as they expire.
   */
  private drawWaypoints(sky: Sky) {
    const { cw, ch, cols, rows, cellGlyph } = this;

    for (const w of sky.waypoints) {
      const age = sky.time - w.born;

      if (!w.landed) {
        const fall = age / w.landAt;
        const i = this.cellIndex(w.x, w.y - (1 - fall) * ch * 1.5);

        if (i >= 0 && !cellGlyph[i]) {
          this.glyphAt(i, fall < 0.5 ? '`' : '.', MARKER, ALPHA * (0.5 + 0.4 * fall));
        }

        continue;
      }

      const expire = smoothstep(WAYPOINT_FADE, WAYPOINT_LIFE, age);
      const i = this.cellIndex(w.x, w.y);

      if (i >= 0 && !cellGlyph[i]) {
        this.glyphAt(i, expire > 0.55 ? '.' : '+', MARKER, ALPHA * (1 - 0.85 * expire));
      }

      const ping = ((age - w.landAt) % 2.2) / 2.2;
      const radius = ping * cw * 4;

      if (radius < cw) {
        continue;
      }

      const alpha = ALPHA * 0.45 * (1 - ping) * (1 - expire);
      const c0 = Math.max(0, Math.floor((w.x - radius - cw) / cw));
      const c1 = Math.min(cols - 1, Math.floor((w.x + radius + cw) / cw));
      const r0 = Math.max(0, Math.floor((w.y - radius - ch) / ch));
      const r1 = Math.min(rows - 1, Math.floor((w.y + radius + ch) / ch));

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const j = r * cols + c;
          const dx = c * cw + cw / 2 - w.x;
          const dy = r * ch + ch / 2 - w.y;

          if (cellGlyph[j] || Math.abs(Math.hypot(dx, dy) - radius) > cw * 0.6) {
            continue;
          }

          this.glyphAt(j, lineGlyph(-dy, dx), MARKER, alpha);
        }
      }
    }
  }

  /** A plane passing over a waypoint flashes * there, settling to + then a dot. */
  private drawFlyovers(sky: Sky) {
    for (const f of sky.flyovers) {
      const i = this.cellIndex(f.x, f.y);

      if (i < 0) {
        continue;
      }

      const t = (sky.time - f.born) / FLYOVER_LIFE;
      const glyph = t < 0.35 ? '*' : t < 0.7 ? '+' : '.';

      this.glyphAt(i, glyph, MARKER, Math.min(1, ALPHA * 1.6) * (1 - t * t));
    }
  }
}
