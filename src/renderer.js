// Draws a Sandpile onto a canvas.
//
// Cells are painted into an offscreen buffer at one pixel per square cell, or
// two pixels per hexagonal cell (odd rows shifted by one pixel). The visible
// canvas then shows a square window of that buffer, scaled with
// nearest-neighbour sampling. Hex rows are drawn √3 times as tall as a buffer
// pixel is wide, which makes the hexagonal grid come out evenly spaced.

export const PALETTES = {
  dusk: { label: 'Dusk', stops: ['#0c0e28', '#285aa0', '#3cbec8', '#f5c850', '#faf5e6'], hot: '#ff4d8d' },
  ember: { label: 'Ember', stops: ['#0b0507', '#5a1020', '#c8401c', '#f5a524', '#fff3c4'], hot: '#5ad1ff' },
  ice: { label: 'Ice', stops: ['#06101c', '#123c6e', '#2f8fd8', '#8fe3ff', '#ffffff'], hot: '#ff7a3d' },
  candy: { label: 'Candy', stops: ['#160b26', '#7b2d8e', '#e2508f', '#ffb36b', '#fff7d6'], hot: '#46f0c8' },
  mono: { label: 'Mono', stops: ['#000000', '#ffffff'], hot: '#ff3b3b' },
}

const HEX_ROW = Math.sqrt(3)
const MIN_VIEW = 24

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function packRgb([r, g, b]) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

// Colours for heights 0 … levels-1, plus one for cells about to topple.
export function paletteColors(name, levels) {
  const { stops, hot } = PALETTES[name]
  const rgb = stops.map(hexToRgb)
  const colors = []
  for (let i = 0; i < levels; i++) {
    const t = (i / Math.max(levels - 1, 1)) * (rgb.length - 1)
    const j = Math.min(Math.floor(t), rgb.length - 2)
    const f = t - j
    colors.push(rgb[j].map((v, ch) => Math.round(v * (1 - f) + rgb[j + 1][ch] * f)))
  }
  colors.push(hexToRgb(hot))
  return colors
}

export class Renderer {
  constructor() {
    this.buffer = document.createElement('canvas')
    this.bufferCtx = this.buffer.getContext('2d')
    this.palette = 'dusk'
    this.zoomToSand = true
    this.view = null
    this.key = ''
  }

  attach(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.resize()
  }

  resize() {
    if (!this.canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  setPalette(name) {
    this.palette = name
    this.key = ''
  }

  setZoomToSand(on) {
    this.zoomToSand = on
  }

  // Rebuilds the buffer and colour table when the grid, size, palette or
  // threshold changes, and repaints everything after a reset.
  prepare(sim) {
    const hex = sim.rule.grid === 'hex'
    const levels = sim.compiled.threshold
    const key = `${sim.size}:${hex}:${this.palette}:${levels}:${sim.version}`
    if (key === this.key) return
    const width = hex ? sim.size * 2 + 1 : sim.size
    if (this.buffer.width !== width || this.buffer.height !== sim.size || !this.image) {
      this.buffer.width = width
      this.buffer.height = sim.size
      this.image = this.bufferCtx.createImageData(width, sim.size)
      this.pixels = new Uint32Array(this.image.data.buffer)
    }
    const colors = paletteColors(this.palette, levels)
    this.lut = Uint32Array.from(colors, packRgb)
    this.backgroundCss = `rgb(${colors[0].join(', ')})`
    this.pixels.fill(this.lut[0])
    this.hex = hex
    this.key = key
    this.painted = -1
    this.fullRepaint = true
  }

  paint(sim) {
    if (this.painted === sim.changes && !this.fullRepaint) return
    const { size, h } = sim
    const { r0, r1, c0, c1 } = sim.sand
    const { pixels, lut, hex } = this
    const top = lut.length - 1
    const width = this.buffer.width
    if (r0 <= r1) {
      for (let r = r0; r <= r1; r++) {
        const row = r * size
        const out = r * width
        const shift = r & 1
        for (let c = c0; c <= c1; c++) {
          const v = h[row + c]
          const color = lut[v < top ? v : top]
          if (hex) {
            const x = out + c * 2 + shift
            pixels[x] = color
            pixels[x + 1] = color
          } else {
            pixels[out + c] = color
          }
        }
      }
    }
    if (this.fullRepaint || r0 > r1) {
      this.bufferCtx.putImageData(this.image, 0, 0)
    } else {
      const x0 = hex ? c0 * 2 : c0
      const x1 = hex ? c1 * 2 + 2 : c1
      this.bufferCtx.putImageData(this.image, 0, 0, x0, r0, x1 - x0 + 1, r1 - r0 + 1)
    }
    this.painted = sim.changes
    this.fullRepaint = false
  }

  rowScale() {
    return this.hex ? HEX_ROW : 1
  }

  // Square window (in display units) that the canvas should show.
  targetView(sim) {
    const ay = this.rowScale()
    const worldW = this.buffer.width
    const worldH = sim.size * ay
    let x0 = 0, x1 = worldW, y0 = 0, y1 = worldH
    const { r0, r1, c0, c1 } = sim.sand
    if (this.zoomToSand && r0 <= r1) {
      x0 = this.hex ? c0 * 2 : c0
      x1 = this.hex ? c1 * 2 + 3 : c1 + 1
      y0 = r0 * ay
      y1 = (r1 + 1) * ay
    }
    const side = Math.max(MIN_VIEW, (x1 - x0) * 1.08 + 2, (y1 - y0) * 1.08 + 2)
    return { x: (x0 + x1) / 2 - side / 2, y: (y0 + y1) / 2 - side / 2, side }
  }

  draw(sim) {
    if (!this.canvas) return
    this.prepare(sim)
    this.paint(sim)
    const target = this.targetView(sim)
    if (!this.view) this.view = target
    const ease = 0.2
    this.view = {
      x: this.view.x + (target.x - this.view.x) * ease,
      y: this.view.y + (target.y - this.view.y) * ease,
      side: this.view.side + (target.side - this.view.side) * ease,
    }
    const { ctx, canvas } = this
    const { x, y, side } = this.view
    const ay = this.rowScale()
    ctx.fillStyle = this.backgroundCss
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.buffer, x, y / ay, side, side / ay, 0, 0, canvas.width, canvas.height)
  }

  // Grid cell under a point given in CSS pixels relative to the canvas.
  cellAt(px, py) {
    if (!this.canvas || !this.view) return null
    const { x, y, side } = this.view
    const ux = x + (px / this.canvas.clientWidth) * side
    const uy = y + (py / this.canvas.clientHeight) * side
    const r = Math.floor(uy / this.rowScale())
    const c = this.hex ? Math.floor((ux - (r & 1)) / 2) : Math.floor(ux)
    return { r, c }
  }
}
