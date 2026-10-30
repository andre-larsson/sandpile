import { HEX_DIRS, SQUARE_DIRS, weightSum } from './sandpile.js'
import { CLASSIC_RULE, HEX_RULE } from './presets.js'

const ARROWS = { NW: '↖', N: '↑', NE: '↗', W: '←', E: '→', SW: '↙', S: '↓', SE: '↘' }
const NAMES = {
  NW: 'up-left', N: 'up', NE: 'up-right', W: 'left', E: 'right', SW: 'down-left', S: 'down', SE: 'down-right',
}
const MAX_WEIGHT = 4
const MAX_EXTRA = 8

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function describeRule(rule) {
  const dirs = Object.keys(rule.grid === 'hex' ? HEX_DIRS : SQUARE_DIRS)
  const byWeight = new Map()
  for (const d of dirs) {
    const w = rule.weights[d] || 0
    if (w) byWeight.set(w, [...(byWeight.get(w) || []), d])
  }
  const groups = [...byWeight.entries()].sort((a, b) => b[0] - a[0])
  const gifts = groups
    .map(([w, ds]) => `${plural(w, 'grain')} to ${ds.length > 1 ? 'each of ' : ''}${ds.map((d) => ARROWS[d]).join(' ')}`)
    .join(', ')
  const sum = weightSum(rule)
  const extra = rule.threshold - sum
  let rest = ''
  if (extra > 0) {
    rest = rule.extra === 'vanish'
      ? ` The other ${plural(extra, 'grain')} ${extra === 1 ? 'vanishes' : 'vanish'}.`
      : ` The other ${plural(extra, 'grain')} ${extra === 1 ? 'stays' : 'stay'} put.`
  } else if (extra < 0) {
    rest = ` Toppling takes ${plural(sum, 'grain')}, so a cell can drop to −${-extra} and owe sand.`
      + ` This is the usual rule on a floor already covered with ${plural(-extra, 'grain')} per cell.`
  }
  return `A cell with ${rule.threshold} or more grains topples: ${gifts}.${rest}`
}

function WeightStepper({ dir, value, canDecrease, onChange }) {
  return (
    <div className={`dir dir-${dir.toLowerCase()}`}>
      <span className="dir-arrow" aria-hidden="true">{ARROWS[dir]}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`One fewer grain ${NAMES[dir]}`}
          disabled={!canDecrease}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-label={`Grains ${NAMES[dir]}`}>{value}</output>
        <button
          type="button"
          aria-label={`One more grain ${NAMES[dir]}`}
          disabled={value >= MAX_WEIGHT}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function RuleEditor({ rule, onChange }) {
  const dirs = Object.keys(rule.grid === 'hex' ? HEX_DIRS : SQUARE_DIRS)
  const sum = weightSum(rule)
  const extra = rule.threshold - sum

  function setWeight(dir, value) {
    const weights = { ...rule.weights, [dir]: value }
    const nextSum = weightSum({ ...rule, weights })
    // A threshold that matched the old total follows the new one.
    const threshold = rule.threshold === sum ? nextSum : rule.threshold
    onChange({ ...rule, weights, threshold })
  }

  return (
    <div className="rule-editor">
      <div className="segmented" role="group" aria-label="Grid">
        <button
          type="button"
          aria-pressed={rule.grid === 'square'}
          onClick={() => rule.grid !== 'square' && onChange(CLASSIC_RULE)}
        >
          Square grid
        </button>
        <button
          type="button"
          aria-pressed={rule.grid === 'hex'}
          onClick={() => rule.grid !== 'hex' && onChange(HEX_RULE)}
        >
          Hexagonal grid
        </button>
      </div>

      <p className="field-label">Grains given to each neighbour</p>
      <div className={`compass compass-${rule.grid}`}>
        {dirs.map((dir) => {
          const value = rule.weights[dir] || 0
          return (
            <WeightStepper
              key={dir}
              dir={dir}
              value={value}
              canDecrease={value > 0 && sum - 1 > 0}
              onChange={(v) => setWeight(dir, v)}
            />
          )
        })}
        <div className="compass-centre" aria-hidden="true">
          <span>gives</span>
          <strong>{sum}</strong>
        </div>
      </div>

      <label className="field">
        <span className="field-label">
          Topple at <strong>{rule.threshold}</strong> {rule.threshold === 1 ? 'grain' : 'grains'}
        </span>
        <input
          type="range"
          min="1"
          max={sum + MAX_EXTRA}
          value={rule.threshold}
          onChange={(e) => onChange({ ...rule, threshold: Number(e.target.value) })}
        />
      </label>

      {extra > 0 && (
        <div className="field">
          <span className="field-label">The extra {plural(extra, 'grain')}</span>
          <div className="segmented" role="group" aria-label="What happens to the extra grains">
            <button
              type="button"
              aria-pressed={rule.extra !== 'vanish'}
              onClick={() => onChange({ ...rule, extra: 'keep' })}
            >
              Stay in the cell
            </button>
            <button
              type="button"
              aria-pressed={rule.extra === 'vanish'}
              onClick={() => onChange({ ...rule, extra: 'vanish' })}
            >
              Vanish
            </button>
          </div>
        </div>
      )}

      <p className="rule-summary">{describeRule(rule)}</p>
      {rule.threshold === 1 && sum > 1 && (
        <p className="rule-note">
          At 1 the floor is already full, so any sand sets off an avalanche that only stops at the
          edge of the world. On a large world this can take a while.
        </p>
      )}
    </div>
  )
}
