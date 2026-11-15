import { plainMath } from '../math/MathText';
import { useState, type FormEvent } from 'react';
import { lesson, useWorkspace } from '../../core/lesson';
import { lessonTitle, useLibrary } from '../../core/library';
import { DeltaField } from './DeltaField';

const EXAMPLES = ['Organic chemistry', 'Multivariable calculus', 'Projectile motion', 'Chain rule'];

export function Home() {
  const { tabs } = useWorkspace();
  const { lessons } = useLibrary();
  const recent = lessons.filter((l) => !tabs.some((t) => t.id === l.id)).slice(0, 4);
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
        {(tabs.length > 0 || recent.length > 0) && (
          <div className="home-resume">
            {tabs.length > 0 && (
              <div>
                <h3>Open lessons</h3>
                <div className="chips">
                  {tabs.map((t) => (
                    <button key={t.id} type="button" className="chip resume" onClick={() => lesson.switchTo(t.id)}>
                      {plainMath(t.title)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recent.length > 0 && (
              <div>
                <h3>
                  Saved <button type="button" className="linklike" onClick={lesson.showLibrary}>see library</button>
                </h3>
                <div className="chips">
                  {recent.map((l) => (
                    <button key={l.id} type="button" className="chip resume" onClick={() => lesson.openSaved(l.id)}>
                      {lessonTitle(l)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
