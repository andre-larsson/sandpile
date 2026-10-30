import { Sandpile } from './sandpile.js'
import { Renderer } from './renderer.js'

export const SPEEDS = {
  slow: { label: 'Slow', rounds: 1, budget: 12, fast: false },
  medium: { label: 'Medium', rounds: 12, budget: 12, fast: false },
  fast: { label: 'Fast', rounds: Infinity, budget: 12, fast: false },
  instant: { label: 'Instant', rounds: Infinity, budget: 30, fast: true },
}

// Owns the simulation and renderer and advances them once per frame.
export class Controller {
  constructor(preset) {
    this.renderer = new Renderer()
    this.sim = new Sandpile(preset.size, preset.rule)
    this.applyPreset(preset)
  }

  applyPreset(preset) {
    const { sim } = this
    sim.setRule(preset.rule)
    if (sim.size !== preset.size) sim.resize(preset.size)
    sim.clear()
    const last = sim.size - 1
    if (preset.fill) {
      sim.fillWithRecipe()
    } else if (preset.full) {
      const height = sim.compiled.threshold - 1
      for (let r = 1; r < last; r++) {
        for (let c = 1; c < last; c++) sim.addGrains(r, c, height)
      }
    } else {
      for (const [fr, fc, grains] of preset.piles) {
        sim.addGrains(Math.round(fr * last), Math.round(fc * last), grains)
      }
    }
    this.speed = preset.speed ?? 'fast'
    this.rain = preset.rain ?? 0
    this.renderer.view = null
  }

  setRule(rule) {
    this.sim.setRule(rule)
    this.sim.replay()
  }

  setSize(size) {
    this.sim.resize(size)
    this.sim.replay()
    this.renderer.view = null
  }

  setSpeed(speed) {
    this.speed = speed
  }

  setRain(grains) {
    this.rain = grains
  }

  setPalette(name) {
    this.renderer.setPalette(name)
  }

  setZoomToSand(on) {
    this.renderer.setZoomToSand(on)
  }

  attach(canvas) {
    this.renderer.attach(canvas)
  }

  resize() {
    this.renderer.resize()
  }

  dropAt(px, py, grains) {
    const cell = this.renderer.cellAt(px, py)
    if (cell) this.sim.addGrains(cell.r, cell.c, grains)
  }

  dropCentre(grains) {
    const mid = (this.sim.size - 1) / 2
    this.sim.addGrains(mid, mid, grains)
  }

  clear() {
    this.sim.clear()
  }

  replay() {
    this.sim.replay()
  }

  frame() {
    const { sim } = this
    if (this.rain && sim.settled) sim.rain(this.rain)
    if (!sim.settled || sim.phase) {
      const { rounds, budget, fast } = SPEEDS[this.speed]
      sim.step(rounds, budget, fast)
    }
    this.renderer.draw(sim)
  }

  stats() {
    const { sim } = this
    let status = 'Settled'
    if (sim.phase === 1) status = 'Filling the box…'
    else if (!sim.settled) status = 'Toppling…'
    else if (this.rain) status = 'Raining'
    return { grains: sim.grainsOnBoard(), lost: sim.lost, topples: sim.topples, status }
  }
}
