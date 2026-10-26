<script lang="ts">
  // Imports
  import { SkyEngine, type SkyStats } from '$lib/planes/engine';

  // Variables
  let { onStats, opacity = 1 }: { onStats?: (stats: SkyStats) => void; opacity?: number } =
    $props();

  let canvas: HTMLCanvasElement;

  $effect(() => {
    // Read through the prop at call time, so a new callback doesn't tear down the engine.
    const engine = new SkyEngine(canvas, (stats) => onStats?.(stats));
    return () => engine.destroy();
  });
</script>

<canvas bind:this={canvas} aria-hidden="true" style:opacity></canvas>

<style>
  /* Behind the page, over the body background, filling the viewport. */
  canvas {
    position: fixed;
    inset: 0;
    z-index: -1;

    width: 100%;
    height: 100%;

    pointer-events: none;

    transition: opacity 1s ease;
  }
</style>
