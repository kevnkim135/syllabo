import { useState, type FormEvent } from 'react';
import { lesson, useLesson } from '../../core/lesson';
import { DeltaField } from './DeltaField';

export const LEVELS = ['middle school', 'high school', 'undergraduate', 'graduate'];
const EXAMPLES = ['Organic chemistry', 'Multivariable calculus', 'Projectile motion', 'Chain rule'];

export function Home() {
  const { level } = useLesson();
  const [subject, setSubject] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    lesson.start(subject);
  }

  return (
    <section className="home">
      <DeltaField />
      <div className="home-center">
        <h1 className="wordmark">
          Lesson<span>Lab</span>
        </h1>
        <form className="ask" onSubmit={submit}>
          <input autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you want to learn?" aria-label="Topic" />
          <select value={level} onChange={(e) => lesson.setLevel(e.target.value)} aria-label="Level">
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button type="submit" className="primary go" aria-label="Start lesson">
            ↑
          </button>
        </form>
        <div className="chips">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="chip" onClick={() => lesson.start(x)}>
              {x}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
