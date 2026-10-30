import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Controller, SPEEDS } from './controller.js'
import { PALETTES } from './renderer.js'
import { PRESETS } from './presets.js'
import RuleEditor from './RuleEditor.jsx'

const SIZES = [129, 161, 257, 513, 1025]
const RAIN = [
  { grains: 0, label: 'Off' },
  { grains: 1, label: '1 grain' },
  { grains: 10, label: '10 grains' },
  { grains: 100, label: '100 grains' },
]
const STATS_INTERVAL = 150

const number = new Intl.NumberFormat('en-US')

function App() {
  const [controller] = useState(() => new Controller(PRESETS[0]))
  const canvasRef = useRef(null)
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [rule, setRule] = useState(PRESETS[0].rule)
  const [size, setSize] = useState(PRESETS[0].size)
  const [speed, setSpeed] = useState('fast')
  const [rain, setRain] = useState(0)
  const [palette, setPalette] = useState('dusk')
  const [zoomToSand, setZoomToSand] = useState(true)
  const [dropPower, setDropPower] = useState(12)
  const [stats, setStats] = useState(() => controller.stats())

  useEffect(() => {
    const canvas = canvasRef.current
    controller.attach(canvas)
    const observer = new ResizeObserver(() => controller.resize())
    observer.observe(canvas)
    let frame = 0
    let lastStats = 0
    const tick = (now) => {
      controller.frame()
      if (now - lastStats > STATS_INTERVAL) {
        lastStats = now
        setStats(controller.stats())
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [controller])

  const dropGrains = 2 ** dropPower

  function choosePreset(preset) {
    controller.applyPreset(preset)
    setPresetId(preset.id)
    setRule(preset.rule)
    setSize(preset.size)
    setSpeed(preset.speed ?? 'fast')
    setRain(preset.rain ?? 0)
  }

  function changeRule(next) {
    controller.setRule(next)
    setRule(next)
    setPresetId(null)
  }

  function changeSize(next) {
    controller.setSize(next)
    setSize(next)
  }

  function changeSpeed(next) {
    controller.setSpeed(next)
    setSpeed(next)
  }

  function changeRain(next) {
    controller.setRain(next)
    setRain(next)
  }

  function changePalette(next) {
    controller.setPalette(next)
    setPalette(next)
  }

  function changeZoom(next) {
    controller.setZoomToSand(next)
    setZoomToSand(next)
  }

  function handlePointerDown(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    controller.dropAt(event.clientX - rect.left, event.clientY - rect.top, dropGrains)
  }

  function saveImage() {
    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'sandpile.png'
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <main className="page">
      <header className="masthead">
        <a className="back-link" href="https://andre-larsson.github.io/">← All projects</a>
        <h1>Sandpile</h1>
        <p className="lede">
          Drop sand on a grid. A cell holding too many grains topples and passes them to its
          neighbours, which may topple in turn. Change the rules and watch new patterns form.
        </p>
      </header>

      <div className="layout">
        <section className="stage-panel" aria-label="Simulation">
          <div className="stage">
            <canvas
              ref={canvasRef}
              className="board"
              onPointerDown={handlePointerDown}
              aria-label="Sandpile. Click or tap to drop sand."
            />
          </div>

          <dl className="stats">
            <div>
              <dt>Status</dt>
              <dd>{stats.status}</dd>
            </div>
            <div>
              <dt>Grains on board</dt>
              <dd>{number.format(stats.grains)}</dd>
            </div>
            <div>
              <dt>Fell off the edge</dt>
              <dd>{number.format(stats.lost)}</dd>
            </div>
            <div>
              <dt>Topples</dt>
              <dd>{number.format(stats.topples)}</dd>
            </div>
          </dl>

          <div className="actions">
            <button type="button" className="primary" onClick={() => controller.dropCentre(dropGrains)}>
              Drop {number.format(dropGrains)} in the centre
            </button>
            <button type="button" onClick={() => controller.replay()}>
              Replay
            </button>
            <button type="button" onClick={() => controller.clear()}>
              Clear
            </button>
            <button type="button" onClick={saveImage}>
              Save image
            </button>
          </div>

          <label className="field">
            <span className="field-label">
              Grains per click: <strong>{number.format(dropGrains)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="20"
              value={dropPower}
              onChange={(e) => setDropPower(Number(e.target.value))}
            />
          </label>
        </section>

        <aside className="controls">
          <section className="panel">
            <h2>Presets</h2>
            <div className="presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset"
                  aria-pressed={preset.id === presetId}
                  onClick={() => choosePreset(preset)}
                >
                  <strong>{preset.name}</strong>
                  <span>{preset.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Rule</h2>
            <RuleEditor rule={rule} onChange={changeRule} />
          </section>

          <section className="panel">
            <h2>Display</h2>
            <div className="field-grid">
              <label className="field">
                <span className="field-label">Speed</span>
                <select value={speed} onChange={(e) => changeSpeed(e.target.value)}>
                  {Object.entries(SPEEDS).map(([id, { label }]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">World size</span>
                <select value={size} onChange={(e) => changeSize(Number(e.target.value))}>
                  {SIZES.map((s) => (
                    <option key={s} value={s}>{s} × {s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Rain when settled</span>
                <select value={rain} onChange={(e) => changeRain(Number(e.target.value))}>
                  {RAIN.map(({ grains, label }) => (
                    <option key={grains} value={grains}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Colours</span>
                <select value={palette} onChange={(e) => changePalette(e.target.value)}>
                  {Object.entries(PALETTES).map(([id, { label }]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={zoomToSand} onChange={(e) => changeZoom(e.target.checked)} />
              Zoom to the sand
            </label>
          </section>
        </aside>
      </div>

      <section className="panel notes">
        <h2>How it works</h2>
        <p>
          Every cell holds a number of grains, shown by its colour. A cell with too many grains
          topples: it hands grains to its neighbours, which may now have too many themselves.
          This repeats until every cell is below the limit. Highlighted cells are about to topple.
        </p>
        <p>
          The order in which cells topple never changes the final picture, which is why this is
          called the <em>abelian</em> sandpile. It is also why changing the rule can simply replay
          all of your drops at once and still give the same result as dropping them one by one.
        </p>
        <p>
          Grains that reach the edge of the world fall off. <em>Fill &amp; settle</em> fills a box
          with sand, lets it settle, subtracts the result from the full box and settles again. With
          the classic rule this gives the identity of the sandpile group: add it to a pile that
          keeps recurring, let it settle, and you get the same pile back.
        </p>
        <p>
          With <em>Avalanches</em>, single grains land on a box that is already full. Most cause
          tiny slides, a few set off huge ones, and the sizes follow a power law. Bak, Tang and
          Wiesenfeld introduced the model in 1987 to show this “self-organised criticality”.
        </p>
      </section>
    </main>
  )
}

export default App
