<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    addDays,
    buildCells,
    type Calendar,
    type DayCell,
    formatLongDate,
    formatShortDate,
    monthLabels,
    plural,
    sourceColor,
    statsOf,
    summarizeSources
  } from '$lib/activityCalendar';

  type Props = {
    calendar: Calendar;
    /** Today in the time zone of the export. Later days render as empty. */
    today: string;
  };

  let { calendar, today }: Props = $props();

  /** Chips shown before the "+N more" one. */
  const CHIP_LIMIT = 6;

  /** Labels on every other row, as GitHub does: all 7 would crowd the column. */
  const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  /** Arrow keys move one day up or down, one week left or right. */
  const KEY_STEPS: Record<string, number> = {
    ArrowUp: -1,
    ArrowDown: 1,
    ArrowLeft: -7,
    ArrowRight: 7
  };

  let filter = $state<string | null>(null);
  /** Sources hidden with a right click. Replaced on each change, so the derived values rerun. */
  let excluded = $state<ReadonlySet<string>>(new Set());
  let showAllSources = $state(false);
  let picked = $state<string | null>(null);
  let hovered = $state<{ cell: DayCell; x: number; y: number } | null>(null);

  let wrapper = $state<HTMLDivElement>();
  let scroller = $state<HTMLDivElement>();
  let grid = $state<HTMLDivElement>();

  const sources = $derived(summarizeSources(calendar));
  const visibleSources = $derived(
    showAllSources
      ? sources
      : sources.filter(
          (source, index) => index < CHIP_LIMIT || source.key === filter || excluded.has(source.key)
        )
  );
  const hiddenCount = $derived(sources.length - visibleSources.length);

  const cells = $derived(buildCells(calendar, today, filter, excluded));
  const weeks = $derived((cells.at(-1)?.week ?? 0) + 1);
  const months = $derived(monthLabels(cells));
  const stats = $derived(statsOf(cells));

  const lastDate = $derived(today < calendar.to ? today : calendar.to);
  const byDate = $derived(new Map(calendar.days.map((day) => [day.date, day])));

  /** The day shown under the grid: the one picked, or else the last day with activity. */
  const selected = $derived(
    picked ?? calendar.days.findLast((day) => day.date <= lastDate)?.date ?? lastDate
  );

  /** Every source of the selected day, the busiest first. */
  const selectedEntries = $derived(
    Object.entries(byDate.get(selected)?.by_source ?? {})
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({
        key,
        count,
        label: calendar.sources[key]?.label ?? key,
        color: sourceColor(key)
      }))
  );

  const year = $derived(calendar.from.slice(0, 4));
  const filterLabel = $derived(filter ? (calendar.sources[filter]?.label ?? filter) : null);

  /** A click shows one source alone. On a hidden source, it also brings the source back. */
  const toggleFilter = (key: string): void => {
    if (excluded.has(key)) {
      excluded = new Set([...excluded].filter((entry) => entry !== key));
    }

    filter = filter === key ? null : key;
  };

  /** A right click (a two-finger click on a trackpad) hides a source, or brings it back. */
  const toggleExcluded = (event: MouseEvent, key: string): void => {
    event.preventDefault();

    excluded = excluded.has(key)
      ? new Set([...excluded].filter((entry) => entry !== key))
      : new Set([...excluded, key]);

    if (filter === key) {
      filter = null;
    }
  };

  const describe = (cell: DayCell): string =>
    `${formatLongDate(cell.date)}: ${cell.count === 0 ? 'no activity' : plural(cell.count, 'event')}`;

  const select = async (date: string, focus: boolean): Promise<void> => {
    picked = date;

    if (focus) {
      await tick();
      grid?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
    }
  };

  const onKeydown = (event: KeyboardEvent): void => {
    let target: string | null = null;

    if (event.key in KEY_STEPS) {
      target = addDays(selected, KEY_STEPS[event.key]);
    } else if (event.key === 'Home') {
      target = calendar.from;
    } else if (event.key === 'End') {
      target = lastDate;
    }

    if (target === null) {
      return;
    }

    event.preventDefault();

    // The grid has no square before `from`, and no square to visit after today.
    if (target >= calendar.from && target <= lastDate) {
      void select(target, true);
    }
  };

  const showTooltip = (event: PointerEvent, cell: DayCell): void => {
    if (!wrapper || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    const box = event.currentTarget.getBoundingClientRect();
    const frame = wrapper.getBoundingClientRect();
    // Kept clear of the edges, so a tooltip over the first or last week stays in the pane.
    const margin = Math.min(90, frame.width / 2);

    hovered = {
      cell,
      x: Math.min(Math.max(box.left - frame.left + box.width / 2, margin), frame.width - margin),
      y: box.top - frame.top
    };
  };

  // A phone sees the last weeks first: the scroll starts at the right end.
  onMount(() => {
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth;
    }
  });
</script>

<div class="calendar">
  <dl class="stats">
    <div>
      <dt>events in {year}</dt>
      <dd>{stats.events.toLocaleString('en-GB')}</dd>
    </div>
    <div>
      <dt>active days</dt>
      <dd>{stats.activeDays}</dd>
    </div>
    <div>
      <dt>longest streak</dt>
      <dd>{plural(stats.longestStreak, 'day')}</dd>
    </div>
    <div>
      <dt>current streak</dt>
      <dd>{plural(stats.currentStreak, 'day')}</dd>
    </div>
  </dl>

  <div
    class="sources"
    role="group"
    aria-label="Click a source to show it alone, right click it to hide it"
  >
    <span class="sources__label">active on:</span>

    {#each visibleSources as source (source.key)}
      <button
        type="button"
        class="chip"
        class:chip--excluded={excluded.has(source.key)}
        style:--color={source.color}
        aria-pressed={filter === source.key}
        aria-label={excluded.has(source.key) ? `${source.label} (hidden)` : undefined}
        title="{plural(source.activeDays, 'day')}, {plural(
          source.events,
          'event'
        )}. Right click to {excluded.has(source.key) ? 'show' : 'hide'} it."
        onclick={() => toggleFilter(source.key)}
        oncontextmenu={(event) => toggleExcluded(event, source.key)}
      >
        {source.label}
      </button>
    {/each}

    {#if excluded.size > 0}
      <button type="button" class="chip chip--more" onclick={() => (excluded = new Set())}>
        show {excluded.size} hidden
      </button>
    {/if}

    {#if hiddenCount > 0 || showAllSources}
      <button
        type="button"
        class="chip chip--more"
        aria-expanded={showAllSources}
        onclick={() => (showAllSources = !showAllSources)}
      >
        {showAllSources ? 'less' : `+${hiddenCount} more`}
      </button>
    {/if}
  </div>

  <div class="heatmap" bind:this={wrapper}>
    <div class="heatmap__scroll" bind:this={scroller} onscroll={() => (hovered = null)}>
      <div
        class="heatmap__grid"
        style:--weeks={weeks}
        role="group"
        aria-label="Activity in {year}{filterLabel
          ? ` on ${filterLabel}`
          : ''}, one square per day. Use the arrow keys to move between days."
        bind:this={grid}
      >
        {#each months as month (month.week)}
          <span class="month" style:grid-column={month.week + 2} aria-hidden="true">
            {month.label}
          </span>
        {/each}

        {#each WEEKDAYS as label, index (index)}
          {#if label}
            <span class="weekday" style:grid-row={index + 2} aria-hidden="true">{label}</span>
          {/if}
        {/each}

        {#each cells as cell (cell.date)}
          <button
            type="button"
            class="cell level-{cell.level}"
            class:cell--future={cell.future}
            class:cell--today={cell.date === today}
            style:grid-column={cell.week + 2}
            style:grid-row={cell.weekday + 2}
            style:--color={cell.lead ? sourceColor(cell.lead) : undefined}
            data-date={cell.date}
            tabindex={cell.date === selected ? 0 : -1}
            disabled={cell.future}
            aria-label={describe(cell)}
            aria-pressed={cell.date === selected}
            onclick={() => select(cell.date, false)}
            onkeydown={onKeydown}
            onpointerenter={(event) => showTooltip(event, cell)}
            onpointerleave={() => (hovered = null)}
          ></button>
        {/each}
      </div>
    </div>

    {#if hovered}
      <div class="tooltip" style:left="{hovered.x}px" style:top="{hovered.y}px" aria-hidden="true">
        <strong
          >{hovered.cell.count === 0 ? 'No activity' : plural(hovered.cell.count, 'event')}</strong
        >
        on {formatShortDate(hovered.cell.date)}
        {#if hovered.cell.lead && filter === null}
          <span class="tooltip__lead" style:--color={sourceColor(hovered.cell.lead)}>
            mostly {calendar.sources[hovered.cell.lead]?.label ?? hovered.cell.lead}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <div
    class="legend"
    aria-hidden="true"
    style:--color={filter ? sourceColor(filter) : 'currentColor'}
  >
    <span>less</span>
    {#each [0, 1, 2, 3, 4] as level (level)}
      <span class="cell level-{level}"></span>
    {/each}
    <span>more</span>
  </div>

  <section class="day" aria-live="polite">
    <h3>{formatLongDate(selected)}</h3>

    {#if selectedEntries.length === 0}
      <p class="day__empty">Nothing that day.</p>
    {:else}
      <ul>
        {#each selectedEntries as entry (entry.key)}
          <li
            style:--color={entry.color}
            class:day__entry--dimmed={(filter !== null && filter !== entry.key) ||
              excluded.has(entry.key)}
          >
            <span class="day__source">{entry.label}</span>
            <span class="day__count">{plural(entry.count, 'event')}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style lang="scss">
  .calendar {
    width: 100%;
    padding: 3rem 2rem 0;

    display: flex;
    flex-direction: column;
    gap: 2rem;

    font-family: 'Supply Mono', monospace;
    text-align: left;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin: 0;

    div {
      padding: 1rem 1.25rem;
      border: 1px dotted currentColor;
    }

    dt {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.7;
      text-align: left;
    }

    dd {
      margin: 0.5rem 0 0;
      font-family: 'FK Raster Grotesk Compact Blended', monospace;
      font-size: 2rem;
      letter-spacing: 0.05em;
      text-align: left;
    }
  }

  .sources {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;

    &__label {
      font-size: 0.85rem;
      opacity: 0.7;
      margin-right: 0.25rem;
    }
  }

  .chip {
    font: inherit;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px dotted var(--color);
    color: var(--color);
    background: color-mix(in srgb, var(--color) 10%, transparent);
    cursor: pointer;
    transition:
      opacity 0.15s ease,
      background 0.15s ease;

    &:hover,
    &:focus-visible {
      border-style: solid;
    }

    &[aria-pressed='true'] {
      border-style: solid;
      background: color-mix(in srgb, var(--color) 30%, transparent);
    }

    &--more {
      --color: currentColor;
      opacity: 0.7;
    }

    // Hidden with a right click: struck out, and out of the colours of the grid.
    &--excluded {
      border-style: dashed;
      background: transparent;
      text-decoration: line-through;
      opacity: 0.4;

      &:hover,
      &:focus-visible {
        opacity: 0.7;
      }
    }
  }

  // With a filter on, the other chips step back.
  .sources:has([aria-pressed='true']) .chip:not([aria-pressed='true'], .chip--more) {
    opacity: 0.45;
  }

  .heatmap {
    position: relative;

    &__scroll {
      overflow-x: auto;
      // Room for the focus ring of the edge squares.
      padding: 4px;
      scrollbar-width: thin;
    }

    &__grid {
      --gap: 3px;
      --label: 2.25rem;

      display: grid;
      grid-template-columns: var(--label) repeat(var(--weeks), minmax(0.6rem, 1fr));
      gap: var(--gap);
      min-width: calc(var(--label) + var(--weeks) * (0.6rem + var(--gap)));
    }
  }

  .month,
  .weekday {
    font-size: 0.7rem;
    opacity: 0.7;
    white-space: nowrap;
    text-align: left;
  }

  .month {
    grid-row: 1;
    padding-bottom: 0.25rem;
  }

  .weekday {
    grid-column: 1;
    align-self: center;
  }

  .cell {
    display: block;
    aspect-ratio: 1;
    padding: 0;
    border: none;
    border-radius: 2px;
    background: color-mix(in srgb, currentColor 8%, transparent);
    cursor: pointer;

    &.level-1 {
      background: color-mix(in srgb, var(--color) 30%, transparent);
    }

    &.level-2 {
      background: color-mix(in srgb, var(--color) 50%, transparent);
    }

    &.level-3 {
      background: color-mix(in srgb, var(--color) 75%, transparent);
    }

    &.level-4 {
      background: var(--color);
    }
  }

  button.cell {
    &:hover,
    &:focus-visible {
      outline: 1px solid currentColor;
      outline-offset: 1px;
    }

    &[aria-pressed='true'] {
      outline: 2px solid currentColor;
      outline-offset: 1px;
    }

    &.cell--today {
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 60%, transparent);
    }

    &.cell--future {
      background: color-mix(in srgb, currentColor 3%, transparent);
      cursor: default;
    }
  }

  .tooltip {
    position: absolute;
    z-index: 1;
    transform: translate(-50%, calc(-100% - 0.5rem));
    pointer-events: none;

    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.5rem 0.75rem;

    font-size: 0.75rem;
    white-space: nowrap;
    text-align: left;

    background: var(--zed-dark);
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 0.4rem;

    &__lead {
      color: var(--color);
    }
  }

  .legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    font-size: 0.7rem;
    opacity: 0.8;

    .cell {
      width: 0.75rem;
    }

    span:first-child {
      margin-right: 0.4rem;
    }

    span:last-child {
      margin-left: 0.4rem;
    }
  }

  .day {
    border-top: 1px dotted currentColor;
    padding-top: 1.5rem;
    // A global rule sizes every `section` for the page headings.
    font-size: 1rem;

    h3 {
      font-size: 1.1rem;
      font-weight: normal;
      letter-spacing: 0.04em;
      margin: 0 0 1rem;
      text-align: left;
    }

    &__empty {
      opacity: 0.7;
      text-align: left;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0.5rem 2rem;
    }

    li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.35rem 0;
      border-bottom: 1px dotted color-mix(in srgb, currentColor 40%, transparent);
      transition: opacity 0.15s ease;
    }

    &__source {
      color: var(--color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__count {
      font-size: 0.85rem;
      opacity: 0.8;
      flex-shrink: 0;
    }

    &__entry--dimmed {
      opacity: 0.4;
    }
  }

  @media (max-width: 767px) {
    .calendar {
      padding: 2rem 0 0;
    }

    .stats {
      grid-template-columns: repeat(2, 1fr);

      dd {
        font-size: 1.5rem;
      }
    }
  }
</style>
