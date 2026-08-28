/**
 * Geometry of the rail drawn beside the list, in pixels.
 *
 * Kept here because the same numbers drive both the SVG path built below and
 * the text indentation applied in CSS; the component hands them to the
 * stylesheet as custom properties so the two can never drift apart.
 */
export const RAIL = {
  /** Horizontal position of the rail for a top-level heading. */
  x: 8.5,
  /** How far the rail, and the text with it, shifts for each level down. */
  step: 8,
  /** Distance from the rail to the start of the text. */
  textGap: 11.5,
  /** How far the straight run beside an item stops short of its edges. */
  inset: 6,
  /** Reach of the bezier control points that join two runs. */
  curve: 8
} as const;

/** A heading picked up from the article, ready to be linked to. */
export type TocHeading = {
  id: string;
  text: string;
  /** 2 for `<h2>`, 3 for `<h3>`, and so on. */
  level: number;
  /** Level relative to the shallowest heading of the article, starting at 0. */
  depth: number;
  element: HTMLElement;
};

/** The straight run of rail drawn beside one item. */
export type RailSegment = {
  top: number;
  bottom: number;
  x: number;
};

export type TableOfContentsOptions = {
  /** The element whose headings make up the table. Read reactively. */
  container: () => HTMLElement | null | undefined;
  /** Which headings to pick up. Read reactively. */
  selector?: () => string;
  /**
   * Distance from the top of the viewport at which a heading counts as
   * reached. Read reactively.
   */
  offset?: () => number;
};

/** `"The IDs that glue everything together"` -> `"the-ids-that-glue-everything-together"`. */
const slugify = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

/** Keep appending a counter until the slug is free. */
const uniqueId = (base: string, taken: Set<string>): string => {
  let id = base;
  let suffix = 2;

  while (taken.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  taken.add(id);
  return id;
};

/**
 * List the headings of `container`, giving an `id` to the ones that lack one so
 * they can be linked to. Posts are hand-written Svelte components, so most
 * headings arrive without an anchor.
 *
 * Depth is measured against the shallowest heading found rather than against
 * `<h1>`, so an article built entirely out of `<h3>` is not indented as a whole.
 */
const collectHeadings = (container: HTMLElement, selector: string): TocHeading[] => {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
  const taken = new Set(elements.map((element) => element.id).filter(Boolean));

  const found = elements.map((element) => {
    const text = element.textContent?.trim() ?? '';

    if (!element.id) {
      element.id = uniqueId(slugify(text), taken);
    }

    return {
      id: element.id,
      text,
      level: Number(element.tagName.slice(1)),
      depth: 0,
      element
    };
  });

  const shallowest = Math.min(...found.map((heading) => heading.level));

  return found.map((heading) => ({ ...heading, depth: heading.level - shallowest }));
};

/**
 * Draw the rail: a straight run beside every item, joined by beziers that swing
 * the line sideways wherever the depth changes.
 */
export const buildRailPath = (segments: RailSegment[]): string => {
  if (segments.length === 0) {
    return '';
  }

  const parts = [`M${segments[0].x} ${segments[0].top}`];

  segments.forEach((segment, index) => {
    if (index > 0) {
      const previous = segments[index - 1];

      parts.push(
        `C ${previous.x} ${previous.bottom + RAIL.curve}` +
          ` ${segment.x} ${segment.top - RAIL.curve}` +
          ` ${segment.x} ${segment.top}`
      );
    }

    parts.push(`L${segment.x} ${segment.bottom}`);
  });

  return parts.join(' ');
};

/** The band of rail to reveal for the active item, as a `clip-path` value. */
export const clipFor = (segment: RailSegment | null): string =>
  segment
    ? `polygon(0 ${segment.top}px, 100% ${segment.top}px, 100% ${segment.bottom}px, 0 ${segment.bottom}px)`
    : 'polygon(0 0, 0 0, 0 0, 0 0)';

/**
 * Slack, in pixels, around the offset line. Scrolling to a heading lands it on
 * the line give or take a fraction of a pixel; without this the heading you
 * just jumped to would read as not yet reached.
 */
const REACHED_SLACK = 2;

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scan a container for headings and track which one the reader is on.
 *
 * Must be called while a component is initialising: it sets up effects that
 * are torn down with that component.
 */
export const createTableOfContents = (options: TableOfContentsOptions) => {
  const selectorOf = options.selector ?? (() => 'h2, h3');
  const offsetOf = options.offset ?? (() => 0);

  let headings = $state<TocHeading[]>([]);
  let activeId = $state<string | null>(null);
  let hashHandled = false;

  // Set when a link is clicked, cleared as soon as the reader scrolls on their
  // own. The last headings of an article sit closer to the bottom of the page
  // than the offset line, so the page runs out of scroll before they reach it;
  // without this the item you just clicked would never be the one lit up.
  let pinnedId: string | null = null;

  const activeIndex = $derived(headings.findIndex((heading) => heading.id === activeId));

  const scrollToHeading = (heading: TocHeading, behavior: ScrollBehavior) => {
    window.scrollTo({
      top: heading.element.getBoundingClientRect().top + window.scrollY - offsetOf(),
      behavior
    });
  };

  // Re-scan whenever the container changes and whenever its content does: the
  // same `.prose` element is reused when navigating from one post to another.
  $effect(() => {
    const container = options.container();
    const selector = selectorOf();

    if (!container) {
      headings = [];
      return;
    }

    // Returns the list rather than reading `headings` back: reading the state
    // this effect writes would make the effect re-trigger itself.
    const scan = (): TocHeading[] => {
      const list = collectHeadings(container, selector);
      headings = list;
      return list;
    };

    const found = scan();

    // The headings only get their ids just above, so the browser had nothing to
    // jump to when the page loaded with a fragment. Honour it now, once.
    const jumpToHash = () => {
      const wanted = decodeURIComponent(window.location.hash.slice(1));
      const target = found.find((heading) => heading.id === wanted);

      if (target) {
        scrollToHeading(target, 'auto');
      }
    };

    let cancelJump = () => {};

    if (!hashHandled && window.location.hash) {
      hashHandled = true;
      jumpToHash();

      // Web fonts and images reflow the article well after the first paint, so
      // the jump above lands short. Aim again once the layout has settled, on
      // the next frame so the browser's own jump to the fragment goes first.
      const jumpNextFrame = () => requestAnimationFrame(jumpToHash);

      document.fonts.ready.then(jumpNextFrame);

      if (document.readyState !== 'complete') {
        window.addEventListener('load', jumpNextFrame, { once: true });
        cancelJump = () => window.removeEventListener('load', jumpNextFrame);
      }
    }

    // `childList` only, so the ids written by `scan` cannot feed back into it.
    const observer = new MutationObserver(scan);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelJump();
    };
  });

  // The active heading is the last one whose top edge has crossed the offset line.
  $effect(() => {
    const list = headings;

    if (list.length === 0) {
      activeId = null;
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;

      if (pinnedId !== null) {
        activeId = pinnedId;
        return;
      }

      const scrolled = window.scrollY + window.innerHeight;
      const atBottom = scrolled >= document.documentElement.scrollHeight - 2;

      if (atBottom) {
        activeId = list[list.length - 1].id;
        return;
      }

      const line = offsetOf();
      let current = list[0];

      for (const heading of list) {
        if (heading.element.getBoundingClientRect().top > line + REACHED_SLACK) {
          break;
        }

        current = heading;
      }

      activeId = current.id;
    };

    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };

    // Scrolling by hand hands control back to the offset line.
    const unpin = () => {
      if (pinnedId !== null) {
        pinnedId = null;
        schedule();
      }
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('wheel', unpin, { passive: true });
    window.addEventListener('touchmove', unpin, { passive: true });
    window.addEventListener('keydown', unpin);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('wheel', unpin);
      window.removeEventListener('touchmove', unpin);
      window.removeEventListener('keydown', unpin);
    };
  });

  /** Scroll a heading under the offset line and put its id in the URL. */
  const goTo = (id: string) => {
    const heading = headings.find((entry) => entry.id === id);

    if (!heading) {
      return;
    }

    scrollToHeading(heading, prefersReducedMotion() ? 'auto' : 'smooth');

    // `replaceState` so the back button still leaves the article.
    history.replaceState(history.state, '', `#${id}`);
    pinnedId = id;
    activeId = id;
  };

  return {
    get headings() {
      return headings;
    },
    get activeId() {
      return activeId;
    },
    get activeIndex() {
      return activeIndex;
    },
    goTo
  };
};
