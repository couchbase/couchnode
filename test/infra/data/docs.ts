// The 3x3 grid the views, analytics and query suites assert against: nine
// documents, each with an `x` and a `y` in 0..2 and a `name` naming both.
// Fixed data, so row counts compared against `gridDocCount()` keep their
// meaning. Returned frozen by a function, so a loader cannot stamp a per-run
// field onto shared objects.

export interface GridDoc {
  readonly x: number
  readonly y: number
  readonly name: string
}

const GRID: readonly GridDoc[] = Object.freeze([
  Object.freeze({ x: 0, y: 0, name: 'x0,y0' }),
  Object.freeze({ x: 1, y: 0, name: 'x1,y0' }),
  Object.freeze({ x: 2, y: 0, name: 'x2,y0' }),
  Object.freeze({ x: 0, y: 1, name: 'x0,y1' }),
  Object.freeze({ x: 1, y: 1, name: 'x1,y1' }),
  Object.freeze({ x: 2, y: 1, name: 'x2,y1' }),
  Object.freeze({ x: 0, y: 2, name: 'x0,y2' }),
  Object.freeze({ x: 1, y: 2, name: 'x1,y2' }),
  Object.freeze({ x: 2, y: 2, name: 'x2,y2' }),
])

export function gridDocs(): readonly GridDoc[] {
  return GRID
}

export function gridDocCount(): number {
  return GRID.length
}
