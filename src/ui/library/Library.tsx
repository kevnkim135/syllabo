import { useState, type DragEvent, type FormEvent } from 'react';
import { lesson, useWorkspace } from '../../core/lesson';
import { library, lessonTitle, useLibrary, type SavedLesson } from '../../core/library';

type Filter = 'all' | 'unfiled' | string; // string = folder id

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/** Saved lessons and folders. Drag a lesson onto a folder to file it. */
export function Library() {
  const { folders, lessons, error } = useLibrary();
  const { tabs } = useWorkspace();
  const [filter, setFilter] = useState<Filter>('all');
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [over, setOver] = useState<Filter | null>(null);

  const shown = lessons.filter((l) => filter === 'all' || (filter === 'unfiled' ? !l.folderId : l.folderId === filter));
  const count = (f: Filter) => lessons.filter((l) => f === 'all' || (f === 'unfiled' ? !l.folderId : l.folderId === f)).length;
  const isOpen = (id: string) => tabs.some((t) => t.id === id);

  const addFolder = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setFilter(library.createFolder(newName).id);
    setNewName('');
  };
  const drop = (target: Filter) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/lesson');
    if (id && target !== 'all') lesson.moveToFolder(id, target === 'unfiled' ? null : target);
  };
  const dropZone = (target: Filter) => ({
    onDragOver: (e: DragEvent) => (target !== 'all' ? (e.preventDefault(), setOver(target)) : undefined),
    onDragLeave: () => setOver(null),
    onDrop: drop(target),
  });

  return (
    <div className="library">
      <aside className="lib-folders">
        <h3>Folders</h3>
        {(['all', 'unfiled'] as const).map((f) => (
          <button key={f} className={`lib-folder ${filter === f ? 'on' : ''} ${over === f ? 'over' : ''}`} onClick={() => setFilter(f)} {...dropZone(f)}>
            <span>{f === 'all' ? 'All lessons' : 'No folder'}</span>
            <span className="muted">{count(f)}</span>
          </button>
        ))}
        {folders.map((f) =>
          renaming === f.id ? (
            <form
              key={f.id}
              onSubmit={(e) => {
                e.preventDefault();
                library.renameFolder(f.id, (e.currentTarget.elements.namedItem('n') as HTMLInputElement).value);
                setRenaming(null);
              }}
            >
              <input name="n" defaultValue={f.name} autoFocus onBlur={() => setRenaming(null)} aria-label="Folder name" />
            </form>
          ) : (
            <div key={f.id} className={`lib-folder ${filter === f.id ? 'on' : ''} ${over === f.id ? 'over' : ''}`} {...dropZone(f.id)}>
              <button className="lib-folder-name" onClick={() => setFilter(f.id)} onDoubleClick={() => setRenaming(f.id)} title="Double-click to rename">
                <span>{f.name}</span>
                <span className="muted">{count(f.id)}</span>
              </button>
              <button className="lib-x" title="Delete folder (its lessons are kept)" aria-label={`Delete folder ${f.name}`} onClick={() => (library.deleteFolder(f.id), filter === f.id && setFilter('all'))}>
                ×
              </button>
            </div>
          ),
        )}
        <form onSubmit={addFolder} className="lib-new">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="+ New folder" aria-label="New folder name" />
        </form>
      </aside>

      <section className="lib-main">
        <header>
          <h2>{filter === 'all' ? 'All lessons' : filter === 'unfiled' ? 'No folder' : folders.find((f) => f.id === filter)?.name}</h2>
          <p className="muted">Saved lessons reopen exactly as you left them, with every model, note and solved problem.</p>
        </header>
        {error && <p className="error">{error}</p>}
        {!lessons.length && <p className="lib-empty muted">Nothing saved yet. Open a lesson and press Save, or say "save this lesson".</p>}
        <div className="lib-grid">
          {shown.map((l) => (
            <Card key={l.id} l={l} open={isOpen(l.id)} folders={folders} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ l, open, folders }: { l: SavedLesson; open: boolean; folders: { id: string; name: string }[] }) {
  return (
    <article className="lib-card card" draggable onDragStart={(e) => e.dataTransfer.setData('text/lesson', l.id)}>
      <button className="lib-card-open" onClick={() => lesson.openSaved(l.id)}>
        <strong>{lessonTitle(l)}</strong>
        <span className="muted">
          {l.level} · {l.models.length} model{l.models.length === 1 ? '' : 's'} · {ago(l.updatedAt)}
        </span>
        {open && <span className="lib-badge">open</span>}
      </button>
      <footer>
        <select value={l.folderId ?? ''} onChange={(e) => lesson.moveToFolder(l.id, e.target.value || null)} aria-label="Folder">
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button className="lib-x" onClick={() => lesson.unsave(l.id)} aria-label={`Delete ${lessonTitle(l)}`} title="Delete from library">
          ×
        </button>
      </footer>
    </article>
  );
}
