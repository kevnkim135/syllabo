// Links the practice set back to the topic map. The API returns a flat list of problems written to
// "build on" the explored topics; a problem is attached to a topic when its text names that topic.
import type { Problem } from '../../../../shared/types';

export interface Numbered {
  p: Problem;
  n: number; // 1-based position in the full set
  builds: string[]; // every explored topic this problem names
}
export interface Branch {
  topic: string | null; // null = the rest of the set, not tied to one explored topic
  items: Numbered[];
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'what', 'how', 'its', 'their', 'are', 'not', 'when', 'why']);
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const stem = (w: string) => (w.length > 3 ? w.replace(/s$/, '') : w);

/** True when `text` names the topic: the whole phrase, or most of its distinctive words. */
export function namesTopic(text: string, topic: string, subject = ''): boolean {
  const hay = text.toLowerCase();
  const phrase = topic.trim().toLowerCase();
  if (!phrase) return false;
  if (hay.includes(phrase)) return true;
  const generic = new Set(words(subject).map(stem)); // the subject's own words appear everywhere
  const keys = [...new Set(words(phrase).filter((w) => w.length > 2 && !STOP.has(w)).map(stem))].filter((w) => !generic.has(w));
  if (!keys.length) return false;
  const seen = new Set(words(hay).map(stem));
  const hits = keys.filter((k) => seen.has(k)).length;
  return keys.length === 1 ? hits === 1 && keys[0].length >= 5 : hits >= 2 && hits / keys.length >= 0.66;
}

/** Group problems under the explored topic they name (newest topic first); the rest form one last branch. */
export function branchByExplored(problems: Problem[], explored: string[], subject = ''): Branch[] {
  const byTopic = new Map<string, Numbered[]>(explored.map((t) => [t, []]));
  const rest: Numbered[] = [];
  problems.forEach((p, i) => {
    const text = `${p.prompt}\n${p.why ?? ''}`;
    const builds = explored.filter((t) => namesTopic(text, t, subject));
    (builds.length ? byTopic.get(builds[0])! : rest).push({ p, n: i + 1, builds });
  });
  const branches: Branch[] = explored.map((topic) => ({ topic, items: byTopic.get(topic)! })).filter((b) => b.items.length);
  if (rest.length) branches.push({ topic: null, items: rest });
  return branches;
}
