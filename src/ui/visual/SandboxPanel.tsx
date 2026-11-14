import { useState, type FormEvent } from 'react';
import { lesson, useLesson } from '../../core/lesson';

const SUGGEST = ['methane', 'oxygen', 'water', 'ethanol', 'sodium', 'chlorine', 'benzene', 'hydrogen'];

/** Side panel for the chemistry sandbox: add molecules, see and pick what is in the space, run a reaction. */
export function SandboxPanel() {
  const { sandbox } = useLesson();
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const items = sandbox.items.filter((i) => !i.dying);
  const sel = sandbox.selected;
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add molecules: methane, oxygen…" aria-label="Add a molecule" />
        <button type="submit" className="primary go" aria-label="Add" disabled={!name.trim() || sandbox.busy === 'add'}>
          {sandbox.busy === 'add' ? <span className="spinner" /> : '+'}
        </button>
      </form>
      {!items.length && (
        <div className="chips sb-suggest">
          {SUGGEST.map((s) => (
            <button key={s} className="chip" onClick={() => lesson.sandboxAdd(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!!items.length && (
        <>
          <ul className="sb-items" aria-label="In the sandbox">
            {items.map((i) => (
              <li key={i.id} className={sel.includes(i.id) ? 'on' : ''}>
                <button className="sb-pick" onClick={(e) => lesson.sandboxSelect([i.id], e.shiftKey || e.metaKey ? 'toggle' : 'set')} title="Click to select, shift-click to add">
                  <span className="sb-dot" /> {i.name}
                </button>
                <button className="sb-x" onClick={() => lesson.sandboxRemove([i.id])} aria-label={`Remove ${i.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form className="sb-react" onSubmit={react}>
            <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Condition: heat, a spark, catalyst…" aria-label="Reaction condition" />
            <button type="submit" className="primary" disabled={sandbox.busy === 'react'}>
              {sandbox.busy === 'react' ? 'Reacting…' : sel.length >= 2 ? `React the ${sel.length} selected` : 'React all'}
            </button>
          </form>
          <button className="sb-clear" onClick={lesson.sandboxClear}>
            Clear the sandbox
          </button>
        </>
      )}

      {sandbox.error && <p className="error">{sandbox.error}</p>}
      {sandbox.reaction && (
        <div className={`sb-result ${sandbox.reaction.result.reacts ? 'yes' : 'no'}`}>
          <p className="sb-eq">{sandbox.reaction.result.reacts ? sandbox.reaction.result.equation : 'No reaction'}</p>
          <p className="muted">
            {sandbox.reaction.reactants.join(' + ')}
            {sandbox.reaction.condition ? ` · ${sandbox.reaction.condition}` : ''}
          </p>
          <p>{sandbox.reaction.result.explanation}</p>
        </div>
      )}

      <h3>Try</h3>
      <ul className="muted sb-help">
        <li>Say "add methane and two oxygens", "push them together", "react them with a spark".</li>
        <li>Mouse: click to select, shift-click for several, drag to move.</li>
        <li>Hands: point at a molecule and pinch quickly to select; pinch and hold to drag (toward and away from you too); pinch with both hands and spread to resize.</li>
      </ul>
    </aside>
  );
}
