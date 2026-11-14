import type { TopicNode } from '../../../shared/types';
import { useLesson } from '../../core/lesson';
import { NoteSheet } from './topics/NoteSheet';
import { ScopeHub } from './topics/ScopeHub';

/**
 * Broad subject with no focus yet: only the hub that asks what to explore.
 * A specific topic (typed at the start, or picked from the hub): only the note sheet.
 */
export function TopicsView({ topics }: { topics: TopicNode[] }) {
  const { focus, scope } = useLesson();
  if (focus) return <NoteSheet topics={topics} />;
  if (!scope) return <p className="muted pulse topics-wait">Sizing up the subject…</p>;
  return scope.scope === 'broad' ? <ScopeHub /> : <NoteSheet topics={topics} />;
}
