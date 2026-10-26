import { PlaneRenderer } from './renderer';
import { Sky } from './sky';

export type SkyStats = { planes: number; waypoints: number };

const STEP = 1 / 60;
const MAX_STEPS = 4;
const INTERACTIVE = 'a, button, input, textarea, select, label, [role=button]';

/** Runs the sky on a canvas: a fixed-step simulation, a render per frame, and clicks to drop waypoints. */
export class SkyEngine {
  private sky = new Sky();
  private renderer: PlaneRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private reported: SkyStats = { planes: -1, waypoints: -1 };
  private visible = true;
  private disposed = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private resizeObserver = new ResizeObserver(() => this.resize());
  private intersectionObserver = new IntersectionObserver(([entry]) => {
    this.visible = entry.isIntersecting;
    this.schedule();
  });

  constructor(
    private canvas: HTMLCanvasElement,
    private onStats: (stats: SkyStats) => void
  ) {
    this.renderer = new PlaneRenderer(canvas);
    this.resizeObserver.observe(canvas);
    this.intersectionObserver.observe(canvas);
    this.reducedMotion.addEventListener('change', this.schedule);
    window.addEventListener('click', this.onClick);
    this.resize();
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedMotion.removeEventListener('change', this.schedule);
    window.removeEventListener('click', this.onClick);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    this.renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    this.sky.resize(rect.width, rect.height);
    this.report();
    if (this.reducedMotion.matches) {
      this.drawStill();
    }
  }

  // Only call back when a count changes, so the page doesn't re-render every frame.
  private report() {
    const planes = this.sky.planes.length;
    const waypoints = this.sky.waypoints.length;
    if (planes === this.reported.planes && waypoints === this.reported.waypoints) {
      return;
    }
    this.reported = { planes, waypoints };
    this.onStats(this.reported);
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible) {
      return;
    }
    if (this.reducedMotion.matches) {
      this.drawStill();
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.sky.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) {
      this.acc = 0;
    }
    this.renderer.render(this.sky, dt);
    this.report();
    this.raf = requestAnimationFrame(this.frame);
  };

  // Reduced motion: hold a single frame.
  private drawStill() {
    this.renderer.render(this.sky, STEP);
    this.report();
  }

  // Clicks on empty space drop waypoints; links, buttons, and text selection are left alone.
  private onClick = (e: MouseEvent) => {
    if (this.reducedMotion.matches) {
      return;
    }
    if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE))) {
      return;
    }
    if (window.getSelection()?.toString()) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return;
    }
    this.sky.drop(x, y);
    this.report();
  };
}
