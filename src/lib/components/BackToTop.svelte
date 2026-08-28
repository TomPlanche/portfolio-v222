<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** Radius of the ring, in SVG user units. Drives the whole button's size. */
    radius?: number;
    /** Thickness of the rail and of the indicator drawn over it. */
    stroke?: number;
    /** Progress below which the button stays hidden and unreachable. */
    threshold?: number;
    /** How fast the ring follows the scroll, in milliseconds. */
    duration?: number;
    /** How long the button takes to fade in and out, in milliseconds. */
    fade?: number;
    /** How far the button slides up as it appears. Any CSS length. */
    lift?: string;
    /** Accessible name of the button. */
    label?: string;
    /** Extra classes, for positioning it from the outside. */
    class?: string;
    /**
     * Replaces the default arrow. Rendered inside the `<svg>`, so it must be
     * SVG content, and it receives the viewBox size in user units.
     */
    icon?: Snippet<[number]>;
  };

  let {
    radius = 15,
    stroke = 2,
    threshold = 0.05,
    duration = 80,
    fade = 200,
    lift = '0.375rem',
    label = 'Back to top',
    class: className = '',
    icon
  }: Props = $props();

  let progress = $state(0);

  // Everything below is derived from the two size props: nothing about the
  // geometry is written down twice.
  const size = $derived((radius + stroke) * 2);
  const centre = $derived(size / 2);
  const circumference = $derived(2 * Math.PI * radius);
  // A full offset draws nothing, a zero offset draws the whole circle.
  const dashoffset = $derived(circumference * (1 - progress));
  const visible = $derived(progress >= threshold);

  // Arrow half-width and half-height, so the glyph scales with the ring.
  const armX = $derived(radius * 0.32);
  const armY = $derived(radius * 0.4);
  const arrow = $derived(
    `M${centre} ${centre + armY} L${centre} ${centre - armY}` +
      ` M${centre - armX} ${centre - armY + armX}` +
      ` L${centre} ${centre - armY}` +
      ` L${centre + armX} ${centre - armY + armX}`
  );

  $effect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;

      // A page shorter than the viewport cannot be scrolled: report no
      // progress rather than dividing by zero and drawing a full ring.
      progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    };

    // `scroll` fires far more often than the display refreshes, so the guard on
    // the frame id keeps this to at most one measurement per frame.
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  });

  const toTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  };
</script>

<button
  aria-hidden={visible ? undefined : 'true'}
  aria-label={label}
  class="btt {className}"
  class:btt--visible={visible}
  onclick={toTop}
  style:--btt-fade="{fade}ms"
  style:--btt-lift={lift}
  style:--btt-duration="{duration}ms"
  tabindex={visible ? undefined : -1}
  type="button"
>
  <svg
    aria-hidden="true"
    height={size}
    style:height="{size}px"
    style:width="{size}px"
    viewBox="0 0 {size} {size}"
    width={size}
  >
    <!-- Rotated a quarter turn so the indicator starts at midnight. -->
    <g transform="rotate(-90 {centre} {centre})">
      <circle
        class="btt__rail"
        cx={centre}
        cy={centre}
        fill="none"
        r={radius}
        stroke-width={stroke}
      />
      <circle
        class="btt__indicator"
        cx={centre}
        cy={centre}
        fill="none"
        r={radius}
        stroke-dasharray={circumference}
        stroke-dashoffset={dashoffset}
        stroke-linecap="round"
        stroke-width={stroke}
      />
    </g>

    <!-- Outside the rotated group, or the arrow would lie on its side. -->
    {#if icon}
      {@render icon(size)}
    {:else}
      <path class="btt__arrow" d={arrow} fill="none" stroke-width={stroke} />
    {/if}
  </svg>
</button>

<style lang="scss">
  .btt {
    // Read, never set, so any ancestor can define one of these and win by
    // inheritance without having to out-specify this rule.
    //
    // The defaults hang off `currentColor`, which is the surrounding font
    // colour: the ring picks up the site's blue on its own, and still reads
    // correctly anywhere else the component is dropped, light or dark.
    --_ring: var(--btt-ring, currentColor);
    --_rail: var(--btt-rail, color-mix(in oklab, currentColor 22%, transparent));
    --_icon: var(--btt-icon, var(--_ring));
    --_focus: var(--btt-focus, var(--_ring));

    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--_icon);
    cursor: pointer;

    // Hidden state: invisible, unclickable, and out of the tab order.
    opacity: 0;
    pointer-events: none;
    transform: translateY(var(--btt-lift));
    transition:
      opacity var(--btt-fade) ease,
      transform var(--btt-fade) ease;
  }

  .btt--visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  // The project reset declares `svg { width: 100%; height: 100% }`, and a CSS
  // declaration beats the element's own width/height attributes, so the size
  // is set inline from the geometry above.
  .btt svg {
    display: block;
    overflow: visible;
  }

  .btt__rail {
    stroke: var(--_rail);
  }

  .btt__indicator {
    stroke: var(--_ring);
    // Short and linear: any longer and the ring visibly lags a fast scroll,
    // which reads as a bug rather than as easing.
    transition: stroke-dashoffset var(--btt-duration) linear;
  }

  .btt__arrow {
    stroke: var(--_icon);
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .btt:focus-visible {
    outline: 2px solid var(--_focus);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .btt,
    .btt__indicator {
      transition: none;
    }
  }
</style>
