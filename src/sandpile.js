// Sandpile simulation on a square or hexagonal grid.
//
// Heights live in a flat Int32Array. The outermost ring of cells is a sink:
// grains pushed there fall off the edge and are counted as lost.
//
// A cell holding at least `threshold` grains topples: it loses `spend` grains
// and each neighbour direction receives `weight` grains. Normally spend is the
// sum of the weights. When the threshold is higher, the "keep" rule leaves the
// remainder in the cell and the "vanish" rule makes spend equal the threshold.
// When the threshold is lower, toppling can leave a cell negative (owing
// sand); that matches the usual rule on a floor pre-filled with
// `sum - threshold` grains per cell.
//
// Only the bounding box of cells that toppled last time (plus a one-cell
// margin) is scanned, since nothing outside it can have become unstable.

export const SQUARE_DIRS = {
  NW: [-1, -1], N: [-1, 0], NE: [-1, 1],
  W: [0, -1], E: [0, 1],
  SW: [1, -1], S: [1, 0], SE: [1, 1],
}

// Odd-r offset layout: odd rows sit half a cell to the right.
export const HEX_DIRS = {
  NW: { even: [-1, -1], odd: [-1, 0] },
  NE: { even: [-1, 0], odd: [-1, 1] },
  W: { even: [0, -1], odd: [0, -1] },
  E: { even: [0, 1], odd: [0, 1] },
  SW: { even: [1, -1], odd: [1, 0] },
  SE: { even: [1, 0], odd: [1, 1] },
}

export function weightSum(rule) {
  const dirs = rule.grid === 'hex' ? HEX_DIRS : SQUARE_DIRS
  return Object.keys(dirs).reduce((sum, d) => sum + (rule.weights[d] || 0), 0)
}

function compileRule(rule, width) {
  const even = []
  const odd = []
  const dirs = rule.grid === 'hex' ? HEX_DIRS : SQUARE_DIRS
  for (const [name, dir] of Object.entries(dirs)) {
    const w = rule.weights[name] || 0
    if (!w) continue
    const [er, ec] = rule.grid === 'hex' ? dir.even : dir
    const [or, oc] = rule.grid === 'hex' ? dir.odd : dir
    even.push([er * width + ec, w])
    odd.push([or * width + oc, w])
  }
  const sum = even.reduce((s, [, w]) => s + w, 0)
  return {
    offEven: Int32Array.from(even, ([o]) => o),
    wEven: Int32Array.from(even, ([, w]) => w),
    offOdd: Int32Array.from(odd, ([o]) => o),
    wOdd: Int32Array.from(odd, ([, w]) => w),
    threshold: rule.threshold,
    spend: rule.extra === 'vanish' && rule.threshold > sum ? rule.threshold : sum,
  }
}

const EMPTY = { r0: 1, r1: 0, c0: 1, c1: 0 }

export class Sandpile {
  constructor(size, rule) {
    this.rule = rule
    this.scenario = 'drops'
    this.version = 0
    this.changes = 0
    this.allocate(size)
    this.compiled = compileRule(rule, size)
    this.resetState()
  }

  allocate(size) {
    this.size = size
    this.h = new Int32Array(size * size)
    this.k = new Int32Array(size * size)
    this.drops = new Int32Array(size * size)
    this.dropBox = { ...EMPTY }
  }

  resetState() {
    this.h.fill(0)
    this.k.fill(0)
    this.active = { ...EMPTY }
    this.sand = { ...EMPTY }
    this.phase = 0
    this.lost = 0
    this.topples = 0
    this.flip = 0
    this.version++
    this.changes++
  }

  setRule(rule) {
    this.rule = rule
    this.compiled = compileRule(rule, this.size)
  }

  // Changes the world size, keeping recorded drops centred.
  resize(size) {
    const oldSize = this.size
    const oldDrops = this.drops
    const oldBox = this.dropBox
    this.allocate(size)
    this.compiled = compileRule(this.rule, size)
    const shift = Math.round((size - oldSize) / 2)
    for (let r = oldBox.r0; r <= oldBox.r1; r++) {
      for (let c = oldBox.c0; c <= oldBox.c1; c++) {
        const n = oldDrops[r * oldSize + c]
        if (n) this.record(r + shift, c + shift, n)
      }
    }
  }

  clear() {
    this.scenario = 'drops'
    this.drops.fill(0)
    this.dropBox = { ...EMPTY }
    this.resetState()
  }

  // Starts over from the recorded drops (or the fill recipe) under the
  // current rule. Toppling order never changes the settled result, so adding
  // every drop at once gives the same picture as adding them one by one.
  replay() {
    this.resetState()
    if (this.scenario === 'fill') {
      this.startFill()
      return
    }
    const { r0, r1, c0, c1 } = this.dropBox
    const { size, h, drops } = this
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) h[r * size + c] = drops[r * size + c]
    }
    this.grow(this.active, this.dropBox)
    this.grow(this.sand, this.dropBox)
  }

  // Fill-and-settle recipe: fill every cell with twice the largest stable
  // height, settle, subtract the result from the fill, and settle again.
  // With the classic rule this produces the identity of the sandpile group.
  fillWithRecipe() {
    this.clear()
    this.scenario = 'fill'
    this.startFill()
  }

  startFill() {
    const { size, h } = this
    const full = 2 * (this.compiled.threshold - 1)
    for (let r = 1; r < size - 1; r++) h.fill(full, r * size + 1, r * size + size - 1)
    this.phase = 1
    this.changes++
    const inner = { r0: 1, r1: size - 2, c0: 1, c1: size - 2 }
    this.grow(this.active, inner)
    this.grow(this.sand, inner)
  }

  finishFillPhase() {
    const { size, h, drops } = this
    const full = 2 * (this.compiled.threshold - 1)
    for (let r = 1; r < size - 1; r++) {
      for (let c = 1; c < size - 1; c++) {
        const i = r * size + c
        h[i] = full - h[i] + drops[i]
      }
    }
    this.phase = 2
    this.changes++
    this.grow(this.active, { r0: 1, r1: size - 2, c0: 1, c1: size - 2 })
  }

  record(r, c, n) {
    if (r < 1 || c < 1 || r > this.size - 2 || c > this.size - 2) return false
    this.drops[r * this.size + c] += n
    this.grow(this.dropBox, { r0: r, r1: r, c0: c, c1: c })
    return true
  }

  addGrains(r, c, n) {
    if (!this.record(r, c, n)) return
    // During the first fill phase the drops are folded in when it finishes.
    if (this.phase === 1) return
    this.h[r * this.size + c] += n
    this.changes++
    const cell = { r0: r, r1: r, c0: c, c1: c }
    this.grow(this.active, cell)
    this.grow(this.sand, cell)
  }

  rain(count) {
    const span = this.size - 2
    for (let n = 0; n < count; n++) {
      this.addGrains(1 + Math.floor(Math.random() * span), 1 + Math.floor(Math.random() * span), 1)
    }
  }

  grow(box, add) {
    if (add.r0 > add.r1) return
    if (box.r0 > box.r1) {
      Object.assign(box, add)
      return
    }
    box.r0 = Math.min(box.r0, add.r0)
    box.r1 = Math.max(box.r1, add.r1)
    box.c0 = Math.min(box.c0, add.c0)
    box.c1 = Math.max(box.c1, add.c1)
  }

  get settled() {
    return this.active.r0 > this.active.r1 && this.phase !== 1
  }

  // Runs toppling rounds until the pile settles, `maxRounds` is reached, or
  // `budgetMs` runs out. `fast` uses in-place sweeps, which settle sooner but
  // don't look like the synchronous automaton while running.
  step(maxRounds, budgetMs, fast) {
    const start = performance.now()
    for (let n = 0; n < maxRounds; n++) {
      const toppled = fast ? this.sweep() : this.round()
      if (!toppled) {
        if (this.phase !== 1) {
          this.phase = 0
          return
        }
        this.finishFillPhase()
      }
      if (performance.now() - start > budgetMs) return
    }
  }

  // One synchronous round: every unstable cell topples at the same time.
  round() {
    const { size, h, k } = this
    const { threshold, spend, offEven, wEven, offOdd, wOdd } = this.compiled
    const { r0, r1, c0, c1 } = this.active
    if (r0 > r1) return 0
    let tr0 = size, tr1 = -1, tc0 = size, tc1 = -1
    let topples = 0
    for (let r = r0; r <= r1; r++) {
      const row = r * size
      for (let c = c0; c <= c1; c++) {
        const v = h[row + c]
        if (v >= threshold) {
          const n = ((v - threshold) / spend | 0) + 1
          k[row + c] = n
          topples += n
          if (r < tr0) tr0 = r
          if (r > tr1) tr1 = r
          if (c < tc0) tc0 = c
          if (c > tc1) tc1 = c
        }
      }
    }
    if (!topples) {
      this.active = { ...EMPTY }
      return 0
    }
    for (let r = tr0; r <= tr1; r++) {
      const row = r * size
      const offs = r & 1 ? offOdd : offEven
      const ws = r & 1 ? wOdd : wEven
      for (let c = tc0; c <= tc1; c++) {
        const i = row + c
        const n = k[i]
        if (!n) continue
        k[i] = 0
        h[i] -= n * spend
        for (let j = 0; j < offs.length; j++) h[i + offs[j]] += ws[j] * n
      }
    }
    this.afterTopple(topples, tr0, tr1, tc0, tc1)
    return topples
  }

  // One in-place sweep, alternating direction so grains travel both ways.
  sweep() {
    const { size, h } = this
    const { threshold, spend, offEven, wEven, offOdd, wOdd } = this.compiled
    const { r0, r1, c0, c1 } = this.active
    if (r0 > r1) return 0
    this.flip ^= 1
    const step = this.flip ? 1 : -1
    const rs = this.flip ? r0 : r1
    const cs = this.flip ? c0 : c1
    const rows = r1 - r0 + 1
    const cols = c1 - c0 + 1
    let tr0 = size, tr1 = -1, tc0 = size, tc1 = -1
    let topples = 0
    for (let y = 0, r = rs; y < rows; y++, r += step) {
      const row = r * size
      const offs = r & 1 ? offOdd : offEven
      const ws = r & 1 ? wOdd : wEven
      for (let x = 0, c = cs; x < cols; x++, c += step) {
        const i = row + c
        const v = h[i]
        if (v < threshold) continue
        const n = ((v - threshold) / spend | 0) + 1
        h[i] = v - n * spend
        for (let j = 0; j < offs.length; j++) h[i + offs[j]] += ws[j] * n
        topples += n
        if (r < tr0) tr0 = r
        if (r > tr1) tr1 = r
        if (c < tc0) tc0 = c
        if (c > tc1) tc1 = c
      }
    }
    if (!topples) {
      this.active = { ...EMPTY }
      return 0
    }
    this.afterTopple(topples, tr0, tr1, tc0, tc1)
    return topples
  }

  afterTopple(topples, tr0, tr1, tc0, tc1) {
    const { size } = this
    this.topples += topples
    this.changes++
    this.active = {
      r0: Math.max(1, tr0 - 1),
      r1: Math.min(size - 2, tr1 + 1),
      c0: Math.max(1, tc0 - 1),
      c1: Math.min(size - 2, tc1 + 1),
    }
    this.grow(this.sand, {
      r0: Math.max(0, tr0 - 1),
      r1: Math.min(size - 1, tr1 + 1),
      c0: Math.max(0, tc0 - 1),
      c1: Math.min(size - 1, tc1 + 1),
    })
    if (tr0 <= 1 || tc0 <= 1 || tr1 >= size - 2 || tc1 >= size - 2) this.drainEdges()
  }

  drainEdges() {
    const { size, h } = this
    let lost = 0
    const last = (size - 1) * size
    for (let c = 0; c < size; c++) {
      lost += h[c] + h[last + c]
      h[c] = 0
      h[last + c] = 0
    }
    for (let r = 1; r < size - 1; r++) {
      const a = r * size
      const b = a + size - 1
      lost += h[a] + h[b]
      h[a] = 0
      h[b] = 0
    }
    if (this.phase !== 1) this.lost += lost
  }

  grainsOnBoard() {
    const { size, h } = this
    const { r0, r1, c0, c1 } = this.sand
    let total = 0
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) total += h[r * size + c]
    }
    return total
  }
}
