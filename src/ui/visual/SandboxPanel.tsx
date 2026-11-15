import { useState, type FormEvent } from 'react';
import { labFor, lesson, useLesson } from '../../core/lesson';
import { MathText } from '../math/MathText';

const CHEM = ['methane', 'oxygen', 'water', 'ethanol', 'sodium', 'chlorine', 'hydrogen', 'benzene'];
const PHYS = ['car', 'ball', 'crate', 'cart', 'sun', 'planet', 'proton', 'electron'];

/** Side panel for the sandbox: add things, see and pick what is in the space, react molecules, read the physics. */
export function SandboxPanel() {
  const state = useLesson();
  const { sandbox, subject, focus } = state;
  const lab = labFor(state); // physics, chemistry, or neither: only the tools that fit the subject are shown
  const plain = lab === 'none';
  const [name, setName] = useState('');
  const items = sandbox.items.filter((i) => !i.dying);
  const sel = sandbox.selected;
  const molecules = items.filter((i) => i.kind !== 'body');
  const bodies = items.filter((i) => i.kind === 'body');
  const chem = lab === 'chemistry';
  const topic = focus ?? subject ?? 'this lesson';
  const contact = (sandbox.contact ?? []).map((id) => items.find((i) => i.id === id)?.name).filter(Boolean);
  const picked = items.filter((i) => sel.includes(i.id) && i.kind === 'body');

  const add = (e: FormEvent) => {
    e.preventDefault();
    for (const n of name.split(/\s*(?:,|\band\b)\s*/).filter(Boolean)) lesson.sandboxAdd(n);
    setName('');
  };
  const react = (e: FormEvent) => {
    e.preventDefault();
    lesson.sandboxReact(sandbox.condition);
  };

  return (
    <aside className="card guide sandbox-panel">
      <h3>
        Sandbox <span className="sb-lab">{plain ? 'Arrange' : chem ? 'Chemistry lab' : 'Physics lab'}</span>
      </h3>
      <form className="ask sb-add" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={plain ? `Add anything from ${topic}…` : chem ? 'Add: methane, oxygen…' : 'Add: a car, a ball, a planet…'} aria-label="Add to the sandbox" />
        <button type="submit" className="primary go" aria-label="Add" disabled={!name.trim() || sandbox.busy === 'add'}>
          {sandbox.busy === 'add' ? <span className="spinner" /> : '+'}
        </button>
      </form>
      {!items.length && !plain && (
        <div className="chips sb-suggest">
          {(chem ? [...CHEM.slice(0, 6), ...PHYS.slice(0, 2)] : [...PHYS, ...CHEM.slice(0, 2)]).map((s) => (
            <button key={s} className="chip" onClick={() => lesson.sandboxAdd(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!plain && contact.length >= 2 && (
        <div className="sb-contact">
          <p>
            <strong>{contact.join(' + ')}</strong> are touching.
          </p>
          <button className="primary" onClick={() => lesson.sandboxReact(sandbox.condition)}>
            React them
          </button>
          <span className="muted">or tap one with a pinch</span>
        </div>
      )}

      {!!items.length && (
        <>
          <ul className="sb-items" aria-label="In the sandbox">
            {items.map((i) => (
              <li key={i.id} className={sel.includes(i.id) ? 'on' : ''}>
                <button className="sb-pick" onClick={(e) => lesson.sandboxSelect([i.id], e.shiftKey || e.metaKey ? 'toggle' : 'set')} title="Click to select, shift-click to add">
                  <span className={`sb-dot ${i.kind === 'body' ? 'body' : ''}`} /> {i.name}
                  {i.kind === 'body' && !plain && <span className="muted sb-mass">{fmtMass(i.body!.mass)}</span>}
                </button>
                <button className="sb-x" onClick={() => lesson.sandboxRemove([i.id])} aria-label={`Remove ${i.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>

          {!plain && !!molecules.length && (
            <form className="sb-react" onSubmit={react}>
              <input value={sandbox.condition} onChange={(e) => lesson.sandboxCondition(e.target.value)} placeholder="Condition: heat, a spark, catalyst…" aria-label="Reaction condition" />
              <button type="submit" className="primary" disabled={sandbox.busy === 'react'}>
                {sandbox.busy === 'react' ? 'Reacting…' : sel.length >= 2 ? `React the ${sel.length} selected` : 'React the molecules'}
              </button>
              <label className="sb-toggle">
                <input type="checkbox" checked={sandbox.autoReact} onChange={(e) => lesson.sandboxSetting('autoReact', e.target.checked)} /> Auto react when molecules touch
              </label>
            </form>
          )}

          {!plain && !!bodies.length && (
            <div className="sb-physics">
              <div className="sb-switches" role="group" aria-label="Physics">
                {(
                  [
                    ['gravity', 'Gravity'],
                    ['friction', 'Friction'],
                    ['air', 'Air resistance'],
                    ['elastic', 'Elastic collisions'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="sb-toggle">
                    <input type="checkbox" checked={sandbox[key]} onChange={(e) => lesson.sandboxSetting(key, e.target.checked)} /> {label}
                  </label>
                ))}
              </div>
              {picked.length > 0 && (
                <p className="muted">
                  Push it: say "push the {picked[0].name.toLowerCase()} right with 50 newtons", or drag and let go while moving to throw it.
                </p>
              )}
            </div>
          )}
          {sel.length > 0 && (
            <div className="sb-size" role="group" aria-label="Size of the selection">
              <span className="muted">Selected: {sel.length}</span>
              <button className="chip" onClick={() => lesson.sandboxScale(sel, 1 / 1.2)} aria-label="Smaller">
                −
              </button>
              <button className="chip" onClick={() => lesson.sandboxScale(sel, 1.2)} aria-label="Bigger">
                +
              </button>
              <button className="chip" onClick={() => lesson.sandboxSetRot(Object.fromEntries(sel.map((id) => [id, [0, 0, 0, 1] as [number, number, number, number]])))}>
                Reset turn
              </button>
            </div>
          )}
          <button className="sb-clear" onClick={lesson.sandboxClear}>
            Clear the sandbox
          </button>
        </>
      )}

      {sandbox.error && <p className="error">{sandbox.error}</p>}
      {!plain && sandbox.event && (
        <div className="sb-result yes">
          <MathText as="p" text={sandbox.event} />
        </div>
      )}
      {!plain && sandbox.reaction && (
        <div className={`sb-result ${sandbox.reaction.result.reacts ? 'yes' : 'no'}`}>
          <MathText as="p" className="sb-eq" text={sandbox.reaction.result.reacts ? sandbox.reaction.result.equation : 'No reaction'} />
          <p className="muted">
            {sandbox.reaction.reactants.join(' + ')}
            {sandbox.reaction.condition ? ` · ${sandbox.reaction.condition}` : ''}
          </p>
          <MathText as="p" text={sandbox.reaction.result.explanation} />
        </div>
      )}

      <h3>Try</h3>
      <ul className="muted sb-help">
        {plain ? (
          <li>Say "add …" with anything from {topic}, then place things side by side to compare them. Objects stay exactly where you put them: there is no gravity, motion or reactions in this sandbox.</li>
        ) : chem ? (
          <li>Say "add methane and two oxygens", then drag two molecules together, or say "react them with a spark".</li>
        ) : (
          <li>Say "add a car and a ball", "push the car right with 2000 newtons", "turn off friction", "make collisions elastic", or add a sun and a planet and push the planet sideways to make it orbit.</li>
        )}
        <li>Mouse: click to select, shift-click for several, drag to move{plain ? '' : '; let go while moving to throw'}.</li>
        <li>Hands: point at an object, then close your hand into a fist to select and carry it; open your hand to let go. Each hand can carry its own. Hold with a fist and circle with the other index finger to turn it. One open hand swiped left / right switches sandboxes; both hands open deselects everything.</li>
      </ul>
    </aside>
  );
}

const fmtMass = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t` : kg >= 1 ? `${+kg.toFixed(1)} kg` : `${Math.round(kg * 1000)} g`);
