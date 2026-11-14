import { useEffect, useState } from 'react';
import type { TopicDetail } from '../../../../shared/types';
import { fetchExpand } from '../../../core/api';
import { useLesson } from '../../../core/lesson';

// Entries already fetched this session, so collapsing and reopening a bubble is instant.
const resolved = new Map<string, TopicDetail>();
const pending = new Map<string, Promise<TopicDetail>>();

interface DetailState {
  detail?: TopicDetail;
  error?: string;
}

/** The encyclopedia entry for one topic (POST /api/expand). Fetches only while `enabled`. */
export function useDetail(topic: string, path: string[], enabled: boolean) {
  const { subject, level } = useLesson();
  const key = [subject, level, ...path, topic].join('\u001f');
  const [state, setState] = useState<DetailState>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !subject) return;
    const hit = resolved.get(key);
    if (hit) return setState({ detail: hit });
    let live = true;
    setState({});
    let request = pending.get(key);
    if (!request) {
      request = fetchExpand({ subject, level, topic, path });
      pending.set(key, request);
      request
        .then((d) => resolved.set(key, d))
        .catch(() => undefined)
        .finally(() => pending.delete(key));
    }
    request.then(
      (detail) => live && setState({ detail }),
      (e: Error) => live && setState({ error: e.message }),
    );
    return () => {
      live = false;
    };
    // `path` is covered by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, attempt]);

  return { ...state, loading: enabled && !state.detail && !state.error, retry: () => setAttempt((n) => n + 1) };
}

// Which bubbles are open, kept across section switches (the view unmounts when the student leaves History).
const ui = new Map<string, unknown>();
let uiScope = '';

export function usePersistent<T>(scope: string, id: string, initial: T): [T, (next: T) => void] {
  if (scope !== uiScope) {
    ui.clear();
    uiScope = scope;
  }
  const [value, setValue] = useState<T>(() => (ui.has(id) ? (ui.get(id) as T) : initial));
  return [
    value,
    (next: T) => {
      if (scope === uiScope) ui.set(id, next);
      setValue(next);
    },
  ];
}
