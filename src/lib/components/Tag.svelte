<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** Text and border colour. Left out, the tag inherits the card's colour. */
    color?: string;
    /** Faded a touch, for the secondary tag of a pair. */
    muted?: boolean;
    children: Snippet;
  };

  let { color, muted = false, children }: Props = $props();
</script>

<span class="tag" class:tag--muted={muted} style:color style:border-color={color}>
  {@render children()}
</span>

<style lang="scss">
  .tag {
    font-family: 'Supply Mono', monospace;
    font-size: 0.7rem;
    padding: 0.27rem 0.4rem 0.13rem;
    border: 1px dotted currentColor;
    background: color-mix(in srgb, currentColor 20%, transparent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    flex-shrink: 0;

    // Supply Mono leaves 0.21em of descender under the baseline but only
    // 0.01em between the caps and the ascender, so uppercase text rides
    // 0.2em high in its line box whatever the line-height. The padding above
    // cancels that; where `text-box` is supported the box is trimmed to the
    // cap and baseline edges instead, so even padding centres on its own.
    @supports (text-box: trim-both cap alphabetic) {
      text-box: trim-both cap alphabetic;
      padding: 0.375rem 0.4rem;
    }
  }

  .tag--muted {
    opacity: 0.8;
  }
</style>
