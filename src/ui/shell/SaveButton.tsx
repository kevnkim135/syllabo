import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lesson, useLesson } from '../../core/lesson';
import { library, useLibrary } from '../../core/library';

/** Save the active lesson, and choose or create its folder. Once saved, changes save automatically. */
export function SaveButton() {
  const { id, savedAt, folderId } = useLesson();
  const { folders, error } = useLibrary();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const folder = folders.find((f) => f.id === folderId);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (savedAt === null) lesson.save(name);
    else lesson.moveToFolder(id, library.ensureFolder(name).id);
    setName('');
    setOpen(false);
  };

  return (
    <div className="save" ref={box}>
      <button
        className={savedAt === null ? 'primary save-main' : 'save-main saved'}
        onClick={() => (savedAt === null ? lesson.save() : setOpen((o) => !o))}
        title={savedAt === null ? 'Save this lesson to your library' : 'Saved: changes save automatically'}
      >
        {savedAt === null ? 'Save' : `Saved${folder ? ` · ${folder.name}` : ''}`}
      </button>
      <button className="save-more" onClick={() => setOpen((o) => !o)} aria-label="Choose a folder" aria-expanded={open}>
        ▾
      </button>
      {open && (
        <div className="save-menu card" role="menu">
          <p className="muted">{savedAt === null ? 'Save into' : 'Move to'}</p>
          <button role="menuitem" className={!folderId ? 'on' : ''} onClick={() => (savedAt === null ? lesson.save() : lesson.moveToFolder(id, null), setOpen(false))}>
            No folder
          </button>
          {folders.map((f) => (
            <button key={f.id} role="menuitem" className={f.id === folderId ? 'on' : ''} onClick={() => (savedAt === null ? lesson.save(f.name) : lesson.moveToFolder(id, f.id), setOpen(false))}>
              {f.name}
            </button>
          ))}
          <form onSubmit={create}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New folder…" aria-label="New folder name" />
          </form>
          {savedAt !== null && (
            <button className="danger" onClick={() => (lesson.unsave(id), setOpen(false))}>
              Remove from library
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
