import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import { formatNumber } from '../../../lib/format';

export interface ChartSeries {
  label: string;
  /** CSS color — use Primer tokens, e.g. `var(--bgColor-accent-emphasis)`. */
  color: string;
  values: number[];
}

/** Round up to 1/2/5 × 10^n so gridlines land on friendly numbers. */
function niceStep(max: number, ticks: number) {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const shortNumber = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(n);
};

const defaultDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Small hand-rolled SVG time-series chart (area / line / bar) with a
 * recessive grid, y-axis on the right like github.com's insights, and a
 * crosshair + tooltip on hover. Values may be negative (code frequency).
 */
export default function TimeChart(props: {
  dates: number[];
  series: ChartSeries[];
  kind?: 'area' | 'line' | 'bar';
  height?: number;
  /** Fewer ticks / labels for small multiples. */
  compact?: boolean;
  /** Fixed y maximum (shared scale across small multiples). */
  yMax?: number;
  formatDate?: (ms: number) => string;
  /** Accessible summary of what the chart shows. */
  label: string;
}) {
  let el!: HTMLDivElement;
  const [width, setWidth] = createSignal(600);
  const [hover, setHover] = createSignal<number | null>(null);
  onSettled(() => {
    setWidth(el.clientWidth || 600);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 600));
    ro.observe(el);
    return () => ro.disconnect();
  });

  const height = () => props.height ?? 200;
  const m = () => ({ top: 8, right: props.compact ? 28 : 40, bottom: 22, left: 4 });
  const plotW = () => Math.max(10, width() - m().left - m().right);
  const plotH = () => Math.max(10, height() - m().top - m().bottom);
  const n = () => props.dates.length;

  const scale = createMemo(() => {
    const all = props.series.flatMap((s) => s.values);
    const maxV = props.yMax ?? Math.max(0, ...all);
    const minV = Math.min(0, ...all);
    const ticks = props.compact ? 2 : 4;
    const integers = all.every((v) => Number.isInteger(v));
    const step = Math.max(integers ? 1 : 0, niceStep(Math.max(maxV, -minV, 1), ticks));
    const top = Math.max(step, Math.ceil(maxV / step) * step);
    const bottom = minV < 0 ? Math.floor(minV / step) * step : 0;
    const grid: number[] = [];
    for (let v = bottom; v <= top + step / 2; v += step) grid.push(v);
    return { top, bottom, grid };
  });

  const y = (v: number) => m().top + ((scale().top - v) / (scale().top - scale().bottom || 1)) * plotH();
  const band = () => plotW() / Math.max(1, n());
  const x = (i: number) =>
    props.kind === 'bar' ? m().left + band() * (i + 0.5) : m().left + (n() <= 1 ? plotW() / 2 : (i / (n() - 1)) * plotW());

  const linePath = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const areaPath = (values: number[]) =>
    values.length ? `${linePath(values)}L${x(values.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '';

  const xTicks = createMemo(() => {
    const count = props.compact ? 3 : Math.max(2, Math.min(8, Math.floor(plotW() / 110)));
    if (n() < 2) return n() ? [0] : [];
    const out: number[] = [];
    for (let k = 0; k < count; k++) out.push(Math.round((k / (count - 1)) * (n() - 1)));
    return [...new Set(out)];
  });
  const fmt = (ms: number) => (props.formatDate ?? defaultDate)(ms);
  const tickLabel = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', n() > 60 ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' });

  const i = () => hover() ?? 0;
  const onMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left - m().left;
    const i = props.kind === 'bar' ? Math.floor(px / band()) : Math.round((px / plotW()) * (n() - 1));
    setHover(i >= 0 && i < n() ? i : null);
  };

  return (
    <div ref={el} class="relative w-full select-none">
      <svg width={width()} height={height()} role="img" aria-label={props.label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <For each={scale().grid}>
          {(v) => (
            <>
              <line
                x1={m().left}
                x2={m().left + plotW()}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? 'var(--borderColor-default)' : 'var(--borderColor-muted)'}
                stroke-dasharray={v === 0 ? undefined : '3 3'}
              />
              <text x={m().left + plotW() + 6} y={y(v) + 4} font-size="11" fill="var(--fgColor-muted)">
                {shortNumber(v)}
              </text>
            </>
          )}
        </For>
        <For each={xTicks()}>
          {(i) => (
            <text
              x={x(i)}
              y={height() - 6}
              font-size="11"
              fill="var(--fgColor-muted)"
              text-anchor={i === 0 ? 'start' : i === n() - 1 ? 'end' : 'middle'}
            >
              {tickLabel(props.dates[i]!)}
            </text>
          )}
        </For>
        <For each={props.series}>
          {(s, si) => (
            <Show
              when={props.kind === 'bar'}
              fallback={
                <>
                  <Show when={props.kind !== 'line'}>
                    <path d={areaPath(s.values)} fill={s.color} fill-opacity="0.25" />
                  </Show>
                  <path d={linePath(s.values)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" />
                </>
              }
            >
              <For each={s.values}>
                {(v, i) => {
                  const w = () => Math.max(1, band() / props.series.length - 2);
                  return (
                    <rect
                      x={m().left + band() * i() + 1 + w() * si() + si() * 1}
                      y={Math.min(y(v), y(0))}
                      width={w()}
                      height={Math.abs(y(0) - y(v))}
                      rx={Math.min(2, w() / 2)}
                      fill={s.color}
                      fill-opacity={hover() == null || hover() === i() ? 1 : 0.6}
                    />
                  );
                }}
              </For>
            </Show>
          )}
        </For>
        <Show when={hover() != null && props.kind !== 'bar'}>
          <line x1={x(hover()!)} x2={x(hover()!)} y1={m().top} y2={m().top + plotH()} stroke="var(--borderColor-emphasis)" />
          <For each={props.series}>
            {(s) => (
              <circle
                cx={x(hover()!)}
                cy={y(s.values[hover()!] ?? 0)}
                r="4"
                fill={s.color}
                stroke="var(--bgColor-default)"
                stroke-width="2"
              />
            )}
          </For>
        </Show>
        {/* Hit area over the whole plot. */}
        <rect x={m().left} y={m().top} width={plotW()} height={plotH()} fill="transparent" />
      </svg>
      <Show when={hover() != null}>
          <div
            class="absolute z-10 pointer-events-none rounded-md border border-line bg-canvas shadow-md px-2 py-1 text-xs whitespace-nowrap"
            style={{
              left: `${Math.min(Math.max(0, x(i()) - 60), width() - 150)}px`,
              top: '0px',
            }}
          >
            <div class="font-semibold mb-0.5">{fmt(props.dates[i()]!)}</div>
            <For each={props.series}>
              {(s) => (
                <div class="flex items-center gap-1.5">
                  <span class="inline-block w-2 h-2 rounded-sm" style={{ 'background-color': s.color }} />
                  <span class="text-fg-muted">{s.label}</span>
                  <span class="ml-auto pl-2 font-semibold">{formatNumber(Math.abs(s.values[i()] ?? 0))}</span>
                </div>
              )}
            </For>
          </div>
      </Show>
    </div>
  );
}
