// In-flight solves. Kept outside the component because the problems section unmounts when the student
// switches section: a solve started here still finishes, lands in `solved` in the lesson store, and its
// pending card is still there when they come back.
import { useSyncExternalStore } from 'react';
import { IMAGE_TYPES, type Problem, type SolveRequest } from '../../../../shared/types';
import { fetchSolve } from '../../../core/api';
import { getLesson, lesson } from '../../../core/lesson';

export type Source = 'typed' | 'spoken' | 'screenshot';
export type Shot = NonNullable<SolveRequest['image']> & { url: string; name: string; size: number };
export interface Job {
  id: number;
  subject: string;
  level: string;
  focus: string | null;
  question: string;
  shot: Shot | null;
  source: Source;
  error?: string; // set when the solve failed; the card offers a retry
}
export interface Origin {
  source: Source;
  shot: Shot | null;
}

export const MAX_IMAGE_BYTES = 5_000_000;
export const formatSize = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/** Read an image file as base64 for POST /api/solve. Rejects with a message fit to show the student. */
export function readShot(file: File): Promise<Shot> {
  return new Promise((resolve, reject) => {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return reject(new Error(`${file.name || 'That file'} is not a supported image. Use a PNG, JPEG, WebP or GIF screenshot.`));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return reject(new Error(`${file.name || 'That image'} is ${formatSize(file.size)}. Screenshots must be under 5 MB; try cropping to just the problem.`));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file. Try attaching it again.'));
    reader.onload = () => {
      const url = String(reader.result);
      resolve({ mediaType: file.type as Shot['mediaType'], data: url.slice(url.indexOf(',') + 1), url, name: file.name || 'Pasted screenshot', size: file.size });
    };
    reader.readAsDataURL(file);
  });
}

let jobs: Job[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const origins = new WeakMap<Problem, Origin>(); // how each solved problem was asked (this session only)

function setJobs(next: Job[]) {
  jobs = next;
  listeners.forEach((l) => l());
}

function run(job: Job) {
  fetchSolve({
    subject: job.subject,
    level: job.level,
    focus: job.focus ?? undefined,
    question: job.question || undefined,
    image: job.shot ? { mediaType: job.shot.mediaType, data: job.shot.data } : undefined,
  }).then(
    (p) => {
      if (!jobs.some((j) => j.id === job.id)) return; // dismissed while solving
      setJobs(jobs.filter((j) => j.id !== job.id));
      if (getLesson().subject !== job.subject) return; // the student started a different lesson
      origins.set(p, { source: job.source, shot: job.shot });
      lesson.addSolved(p);
    },
    (e: Error) => setJobs(jobs.map((j) => (j.id === job.id ? { ...j, error: e.message || 'Could not solve that problem.' } : j))),
  );
}

export function startSolve(question: string, shot: Shot | null, source: Source) {
  const { subject, level, focus } = getLesson();
  const q = question.trim();
  if (!subject || (!q && !shot)) return;
  const job: Job = { id: ++nextId, subject, level, focus, question: q, shot, source };
  setJobs([job, ...jobs]);
  run(job);
}

export function retryJob(id: number) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  const fresh = { ...job, error: undefined };
  setJobs(jobs.map((j) => (j.id === id ? fresh : j)));
  run(fresh);
}

export const dismissJob = (id: number) => setJobs(jobs.filter((j) => j.id !== id));
export const originOf = (p: Problem) => origins.get(p);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useJobs = () => useSyncExternalStore(subscribe, () => jobs);
