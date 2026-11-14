/** Split a worked solution into steps so it can be revealed one at a time. */
const MARKER = /^\s*(?:step\s*)?\d+\s*[.):]\s+/i;

export function splitSteps(solution: string): string[] {
  const lines = solution.replace(/\r/g, '').split('\n');
  if (lines.some((l) => MARKER.test(l))) {
    const steps: string[] = [];
    for (const line of lines) {
      if (MARKER.test(line)) steps.push(line.replace(MARKER, '').trim());
      else if (!line.trim()) continue;
      else if (steps.length) steps[steps.length - 1] += `\n${line.trim()}`;
      else steps.push(line.trim()); // text before the first numbered step
    }
    return steps.filter(Boolean);
  }
  // No numbering: fall back to paragraphs.
  const paragraphs = solution.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs : [solution.trim()];
}
