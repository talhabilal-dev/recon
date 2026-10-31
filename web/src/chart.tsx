import { useState } from "react"

type Table = { columns: string[]; rows: string[][] }

const MAX_BARS = 14

type Series = {
  labelHeader: string
  valueHeader: string
  points: { label: string; value: number }[]
}

function toNumber(value: string | undefined): number | null {
  const cleaned = (value ?? "").replace(/[,\s€$£%]/g, "")
  if (cleaned === "") return null

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/*
 * The model returns data, never a chart. This decides whether that data can be
 * drawn: a label column plus a column that is numeric in every row, with at
 * least two rows to compare.
 */
export function deriveSeries(table: Table): Series | null {
  if (table.columns.length < 2 || table.rows.length < 2) return null

  const valueIndex = table.columns.findIndex(
    (_, index) => index > 0 && table.rows.every((row) => toNumber(row[index]) !== null),
  )

  if (valueIndex === -1) return null

  const points = table.rows.slice(0, MAX_BARS).map((row) => ({
    label: row[0] ?? "",
    value: toNumber(row[valueIndex]) ?? 0,
  }))

  return {
    labelHeader: table.columns[0] ?? "",
    valueHeader: table.columns[valueIndex] ?? "",
    points,
  }
}

export function Chart({ table }: { table: Table }) {
  const [active, setActive] = useState<number | null>(null)
  const series = deriveSeries(table)

  if (series === null) return null

  const { points, labelHeader, valueHeader } = series
  const max = Math.max(...points.map((point) => point.value), 0)
  const floor = Math.min(...points.map((point) => point.value), 0)
  const span = max - floor || 1
  const current = active === null ? null : points[active]

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-3 font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
        <span>{valueHeader}</span>
        <span>{labelHeader}</span>
      </figcaption>

      <p
        aria-live="polite"
        className="min-h-4 font-mono text-[0.65rem] text-muted-foreground"
      >
        {current === null
          ? "Hover or focus a bar for its value"
          : `${current.label} · ${current.value.toLocaleString()} ${valueHeader}`}
      </p>

      <ul className="flex h-56 items-end gap-1.5" onMouseLeave={() => setActive(null)}>
        {points.map((point, index) => {
          const height = Math.max(((point.value - floor) / span) * 100, 1)

          return (
            <li
              key={`${point.label}-${index}`}
              tabIndex={0}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="sr-only">
                {point.label}: {point.value.toLocaleString()} {valueHeader}
              </span>
              <div className="flex min-h-0 flex-1 items-end">
                <div
                  aria-hidden="true"
                  className={`w-full rounded-t-[3px] bg-primary transition-opacity ${
                    active === index ? "opacity-100" : "opacity-85"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span
                aria-hidden="true"
                className="truncate text-center text-[0.6rem] text-muted-foreground"
              >
                {point.label}
              </span>
            </li>
          )
        })}
      </ul>

      {table.rows.length > MAX_BARS && (
        <p className="text-[0.65rem] text-muted-foreground">
          Charting the first {MAX_BARS} of {table.rows.length} rows.
        </p>
      )}
    </figure>
  )
}
