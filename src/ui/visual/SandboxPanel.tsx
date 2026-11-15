import { useState, type FormEvent } from 'react';
import { lesson, useLesson } from '../../core/lesson';
import { MathText } from '../math/MathText';

const CHEM = ['methane', 'oxygen', 'water', 'ethanol', 'sodium', 'chlorine', 'hydrogen', 'benzene'];
const PHYS = ['car', 'ball', 'crate', 'cart', 'sun', 'planet', 'proton', 'electron'];

/** Side panel for the sandbox: add things, see and pick what is in the space, react molecules, read the physics. */
export function SandboxPanel() {
  const { sandbox, subject, focus } = useLesson();
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const items = sandbox.items.filter((i) => !i.dying);
  const sel = sandbox.selected;
  const molecules = items.filter((i) => i.kind !== 'body');
  const bodies = items.filter((i) => i.kind === 'body');
  const chem = /chem|molec|reaction|bond|acid|organic|atom/i.test(`${subject} ${focus ?? ''}`);
  const contact = (sandbox.contact ?? []).map((id) => items.find((i) => i.id === id)?.name).filter(Boolean);
  const picked = items.filter((i) => sel.includes(i.id) && i.kind === 'body');

  const add = (e: FormEvent) => {
    e.preventDefault();
    for (const n of name.split(/\s*(?:,|\band\b)\s*/).filter(Boolean)) lesson.sandboxAdd(n);
    setName('');
  };
  const react = (e: FormEvent) => {
    e.preventDefault();
    lesson.sandboxReact(condition);
  };

  return (
    <aside className="card guide sandbox-panel">
      <h3>Sandbox</h3>
      <form className="ask sb-add" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={chem ? 'Add: methane, oxygen…' : 'Add: a car, a ball, a planet…'} aria-label="Add to the sandbox" />
        <button type="submit" className="primary go" aria-label="Add" disabled={!name.trim() || sandbox.busy === 'add'}>
          {sandbox.busy === 'add' ? <span className="spinner" /> : '+'}
        </button>
      </form>
      {!items.length && (
        <div className="chips sb-suggest">
          {(chem ? [...CHEM.slice(0, 6), ...PHYS.slice(0, 2)] : [...PHYS, ...CHEM.slice(0, 2)]).map((s) => (
            <button key={s} className="chip" onClick={() => lesson.sandboxAdd(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {contact.length >= 2 && (
        <div className="sb-contact">
          <p>
            <strong>{contact.join(' + ')}</strong> are touching.
          </p>
          <button className="primary" onClick={() => lesson.sandboxReact(condition)}>
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
                  {i.kind === 'body' && <span className="muted sb-mass">{fmtMass(i.body!.mass)}</span>}
                </button>
                <button className="sb-x" onClick={() => lesson.sandboxRemove([i.id])} aria-label={`Remove ${i.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>

          {!!molecules.length && (
            <form className="sb-react" onSubmit={react}>
              <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Condition: heat, a spark, catalyst…" aria-label="Reaction condition" />
              <button type="submit" className="primary" disabled={sandbox.busy === 'react'}>
                {sandbox.busy === 'react' ? 'Reacting…' : sel.length >= 2 ? `React the ${sel.length} selected` : 'React the molecules'}
              </button>
            </form>
          )}

          {!!bodies.length && (
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
          <button className="sb-clear" onClick={lesson.sandboxClear}>
            Clear the sandbox
          </button>
        </>
      )}

      {sandbox.error && <p className="error">{sandbox.error}</p>}
      {sandbox.event && (
        <div className="sb-result yes">
          <MathText as="p" text={sandbox.event} />
        </div>
      )}
      {sandbox.reaction && (
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
        {chem ? (
          <li>Say "add methane and two oxygens", then drag two molecules together, or say "react them with a spark".</li>
        ) : (
          <li>Say "add a car and a ball", "push the car right with 2000 newtons", "turn off friction", "make collisions elastic", or add a sun and a planet and push the planet sideways to make it orbit.</li>
        )}
        <li>Mouse: click to select, shift-click for several, drag to move; let go while moving to throw.</li>
        <li>Hands: point and pinch quickly to add an object to your group; pinch and hold to carry it. Each hand can carry its own object, so you can bring two together.</li>
      </ul>
    </aside>
  );
}

const fmtMass = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t` : kg >= 1 ? `${+kg.toFixed(1)} kg` : `${Math.round(kg * 1000)} g`);
