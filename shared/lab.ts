import type { LabKind } from './types';

const CHEMISTRY = /chem|molecul|reaction|stoichiometr|\bacids?\b|\bbases?\b|\bbond(?:s|ing)?\b|organic|polymer|periodic table|titration|redox|\bmoles?\b|electrolysis|combustion|catalys|isomer|alkane|alkene|solution chemistry/;
const PHYSICS = /physic|mechanic|kinematic|dynamics|\bmotion\b|\bforces?\b|newton|gravit|momentum|collision|projectile|\borbit|astronom|astrophys|planet|solar system|electrostat|electric (?:field|charge|force)|coulomb|friction|inclined plane|pendulum|\benergy\b|\bwork and\b|torque|rotation(?:al)?|fluid|buoyan|rocket|aerodynamic|relativity|free fall|circular motion|engineering statics|statics/;

/** The lab a piece of text clearly belongs to, or undefined when it does not say. */
export function labHint(text: string): LabKind | undefined {
  const t = text.toLowerCase();
  if (CHEMISTRY.test(t)) return 'chemistry';
  if (PHYSICS.test(t)) return 'physics';
  return undefined;
}

/**
 * Which sandbox a lesson gets. The focused topic decides when it is clearly physics or chemistry; otherwise
 * the model's own classification of the subject; otherwise keywords in the subject. Everything else
 * (history, biology, computer science, pure math...) is "none": objects are only placed and arranged.
 */
export function labOf(subject: string, focus?: string | null, scopeLab?: LabKind): LabKind {
  return (focus ? labHint(focus) : undefined) ?? scopeLab ?? labHint(subject) ?? 'none';
}
