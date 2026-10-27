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

<div class="sky" aria-hidden="true" style:opacity>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  /*
   * Behind the page, over the body background. `lvh` is the tallest the viewport gets, so on
   * mobile Safari the sky does not resize as the toolbar shows or hides.
   */
  .sky {
    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;

    width: 100%;
    height: 100%;
    height: 100lvh;

    pointer-events: none;

    transition: opacity 1s ease;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
