// Detailed, hand-built models for the most common biology and psychology topics, expressed as named parts so
// they render, highlight and explain themselves exactly like model-composed ones.
import type { AnatomyModel, AnatomyPart } from '../../../../shared/types';

type V = [number, number, number];
const P = (p: Omit<AnatomyPart, 'rotation'> & { rotation?: V }): AnatomyPart => p;

export const DEFAULT_INFO: Record<string, string> = {
  'Frontal lobe': 'Planning, decisions, personality and voluntary movement; home of working memory and self-control.',
  'Parietal lobe': 'Combines touch, temperature and body position, and keeps track of where things are in space.',
  'Temporal lobe': 'Hearing, language comprehension and forming new memories (with the hippocampus inside it).',
  'Occipital lobe': 'The visual cortex: turns signals from the eyes into shapes, colors and motion.',
  Cerebellum: 'Coordinates balance, posture and smooth, well-timed movement; also helps learn motor skills.',
  Brainstem: 'Controls automatic functions such as breathing, heart rate and sleep, and relays signals to the body.',
  'Cell body': 'The soma: contains the nucleus and adds up incoming signals to decide whether to fire.',
  Nucleus: 'Holds the DNA and controls which proteins the cell makes.',
  Dendrites: 'Branches that receive signals from other neurons.',
  Axon: 'Carries the electrical impulse (action potential) away from the cell body.',
  'Myelin sheath': 'Fatty insulation that makes impulses jump between gaps, speeding them up many times.',
  'Axon terminals': 'Release neurotransmitters into the synapse to signal the next cell.',
  'Cell membrane': 'A thin lipid layer that controls what enters and leaves the cell.',
  Nucleolus: 'Inside the nucleus: builds ribosomes.',
  Mitochondria: 'Release energy from glucose (cellular respiration) as ATP: the cell’s power plants.',
  'Endoplasmic reticulum': 'Folded membranes that make proteins (rough ER, with ribosomes) and lipids (smooth ER).',
  'Golgi apparatus': 'Packages and ships proteins to where they are needed.',
  Lysosomes: 'Break down waste and worn-out parts with digestive enzymes.',
  Ribosomes: 'Tiny machines that build proteins from the RNA code.',
  'Sugar-phosphate backbone': 'The two outer strands, running in opposite directions, that hold the bases in order.',
  Adenine: 'A base that always pairs with thymine (two hydrogen bonds).',
  Thymine: 'A base that always pairs with adenine.',
  Guanine: 'A base that always pairs with cytosine (three hydrogen bonds).',
  Cytosine: 'A base that always pairs with guanine.',
  'Left ventricle': 'The strongest chamber: pumps oxygen-rich blood out through the aorta to the whole body.',
  'Right ventricle': 'Pumps oxygen-poor blood to the lungs through the pulmonary artery.',
  'Left atrium': 'Receives oxygen-rich blood back from the lungs.',
  'Right atrium': 'Receives oxygen-poor blood back from the body through the venae cavae.',
  Aorta: 'The body’s largest artery: carries blood from the left ventricle to the body.',
  'Pulmonary artery': 'Carries oxygen-poor blood from the right ventricle to the lungs.',
  'Vena cava': 'The large veins returning oxygen-poor blood to the right atrium.',
};

function brain(): AnatomyPart[] {
  return [
    P({ name: 'Frontal lobe', shape: 'ellipsoid', surface: 'folded', position: [0, 0.35, 1.05], size: [2.6, 2.0, 2.0], color: '#e8768a' }),
    P({ name: 'Parietal lobe', shape: 'ellipsoid', surface: 'folded', position: [0, 0.75, -0.35], size: [2.5, 1.7, 1.9], color: '#f2b44f' }),
    P({ name: 'Occipital lobe', shape: 'ellipsoid', surface: 'folded', position: [0, 0.15, -1.45], size: [2.0, 1.6, 1.3], color: '#6fb3e0' }),
    P({ name: 'Temporal lobe', shape: 'ellipsoid', surface: 'folded', position: [1.05, -0.35, 0.2], size: [0.9, 1.1, 2.2], rotation: [0, 0, -12], color: '#8bcf7a' }),
    P({ name: 'Temporal lobe', shape: 'ellipsoid', surface: 'folded', position: [-1.05, -0.35, 0.2], size: [0.9, 1.1, 2.2], rotation: [0, 0, 12], color: '#8bcf7a' }),
    P({ name: 'Cerebellum', shape: 'ellipsoid', surface: 'bumpy', position: [0, -0.85, -1.35], size: [1.9, 0.9, 1.1], color: '#b48ad8' }),
    P({ name: 'Brainstem', shape: 'capsule', surface: 'smooth', position: [0, -1.45, -0.55], size: [0.5, 1.5, 0.5], rotation: [18, 0, 0], color: '#d9a07a' }),
  ];
}

function neuron(): AnatomyPart[] {
  const parts: AnatomyPart[] = [
    P({ name: 'Cell body', shape: 'blob', surface: 'translucent', position: [-2.6, 0, 0], size: [1.4, 1.3, 1.3], color: '#c98ad8' }),
    P({ name: 'Nucleus', shape: 'sphere', surface: 'glossy', position: [-2.6, 0, 0], size: [0.55, 0.55, 0.55], color: '#5b3a9e' }),
    P({ name: 'Axon', shape: 'tube', position: [0, 0, 0], size: [0.09, 0, 0], color: '#d9b0e8', path: [[-1.95, 0, 0], [-0.5, 0.15, 0], [1.2, -0.1, 0], [2.9, 0, 0], [3.5, 0.05, 0]] }),
  ];
  // dendrites: branching tubes from the cell body
  const branches: V[][] = [
    [[-3.1, 0.5, 0.2], [-3.7, 1.2, 0.4], [-4.0, 1.9, 0.1]],
    [[-3.1, 0.5, 0.2], [-3.9, 0.9, -0.3], [-4.5, 0.8, -0.8]],
    [[-3.2, -0.4, 0.3], [-3.9, -1.1, 0.6], [-4.3, -1.8, 0.4]],
    [[-3.2, -0.4, 0.3], [-4.0, -0.6, 1.0], [-4.6, -0.3, 1.5]],
    [[-2.5, 0.6, -0.4], [-2.6, 1.4, -1.0], [-2.9, 2.0, -1.4]],
    [[-2.4, -0.6, -0.4], [-2.2, -1.4, -0.9], [-2.4, -2.0, -1.5]],
  ];
  for (const b of branches) parts.push(P({ name: 'Dendrites', shape: 'tube', position: [0, 0, 0], size: [0.06, 0, 0], color: '#c98ad8', path: [[-2.6, 0, 0], ...b] }));
  // myelin sheath segments with gaps (nodes of Ranvier)
  for (let k = 0; k < 4; k++) {
    const x = -1.4 + k * 1.1;
    parts.push(P({ name: 'Myelin sheath', shape: 'capsule', surface: 'glossy', position: [x, 0.05 - 0.05 * Math.sin(k), 0], size: [0.32, 0.85, 0.32], rotation: [0, 0, 90], color: '#f4efe6' }));
  }
  for (const [y, z] of [[0.35, 0.2], [-0.3, 0.25], [0.1, -0.35], [0.45, -0.2]] as [number, number][]) {
    parts.push(P({ name: 'Axon terminals', shape: 'tube', position: [0, 0, 0], size: [0.045, 0, 0], color: '#d9b0e8', path: [[3.4, 0.05, 0], [3.8, y * 0.6, z * 0.6], [4.1, y, z]] }));
    parts.push(P({ name: 'Axon terminals', shape: 'sphere', surface: 'glossy', position: [4.15, y, z], size: [0.2, 0.2, 0.2], color: '#e8a0c0' }));
  }
  return parts;
}

function cell(): AnatomyPart[] {
  const parts: AnatomyPart[] = [
    P({ name: 'Cell membrane', shape: 'blob', surface: 'translucent', position: [0, 0, 0], size: [6.2, 4.6, 5.0], color: '#f2c6d8' }),
    P({ name: 'Nucleus', shape: 'sphere', surface: 'bumpy', position: [-0.4, 0.2, 0], size: [1.8, 1.8, 1.8], color: '#7b5bc9' }),
    P({ name: 'Nucleolus', shape: 'sphere', surface: 'glossy', position: [-0.15, 0.35, 0.75], size: [0.55, 0.55, 0.55], color: '#3e2a7a' }),
    P({ name: 'Golgi apparatus', shape: 'cylinder', surface: 'smooth', position: [1.7, 0.9, 0.2], size: [1.2, 0.08, 0.7], rotation: [0, 20, 10], color: '#f2b44f' }),
    P({ name: 'Golgi apparatus', shape: 'cylinder', surface: 'smooth', position: [1.75, 1.05, 0.2], size: [1.05, 0.08, 0.6], rotation: [0, 20, 10], color: '#f2b44f' }),
    P({ name: 'Golgi apparatus', shape: 'cylinder', surface: 'smooth', position: [1.8, 1.2, 0.2], size: [0.9, 0.08, 0.5], rotation: [0, 20, 10], color: '#f2b44f' }),
  ];
  const mito: [V, V][] = [[[1.6, -0.9, 0.8], [0, 30, 70]], [[-1.9, -1.0, 0.6], [20, 0, 40]], [[0.9, -1.2, -1.2], [60, 10, 0]], [[-1.6, 1.1, -1.0], [0, 50, 110]]];
  for (const [pos, rot] of mito) parts.push(P({ name: 'Mitochondria', shape: 'capsule', surface: 'folded', position: pos, size: [0.42, 1.0, 0.42], rotation: rot, color: '#e8794a' }));
  for (const [r, y, rx] of [[1.35, -0.1, 80], [1.6, 0.0, 95], [1.85, 0.1, 110]] as [number, number, number][]) {
    parts.push(P({ name: 'Endoplasmic reticulum', shape: 'torus', surface: 'folded', position: [-0.4, 0.2 + y, 0], size: [r * 2, r * 2, 0.16], rotation: [rx, 20, 0], color: '#5fb3a3' }));
  }
  for (const p of [[2.2, -0.2, -0.9], [-2.4, 0.2, 0.9], [0.4, 1.4, 1.1]] as V[]) parts.push(P({ name: 'Lysosomes', shape: 'sphere', surface: 'glossy', position: p, size: [0.42, 0.42, 0.42], color: '#4f8cff' }));
  for (let k = 0; k < 26; k++) {
    const a = k * 2.4;
    const r = 1.5 + (k % 5) * 0.25;
    parts.push(P({ name: 'Ribosomes', shape: 'sphere', position: [-0.4 + Math.cos(a) * r, 0.2 + Math.sin(k * 1.7) * 1.1, Math.sin(a) * r * 0.9], size: [0.1, 0.1, 0.1], color: '#2b2b55' }));
  }
  return parts;
}

function dna(): AnatomyPart[] {
  const parts: AnatomyPart[] = [];
  const turns = 2.2;
  const height = 7;
  const R = 1.1;
  const strand = (phase: number): V[] =>
    Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const a = t * turns * Math.PI * 2 + phase;
      return [Math.cos(a) * R, -height / 2 + t * height, Math.sin(a) * R];
    });
  parts.push(P({ name: 'Sugar-phosphate backbone', shape: 'tube', position: [0, 0, 0], size: [0.12, 0, 0], color: '#4f6fd9', path: strand(0) }));
  parts.push(P({ name: 'Sugar-phosphate backbone', shape: 'tube', position: [0, 0, 0], size: [0.12, 0, 0], color: '#d94f6f', path: strand(Math.PI) }));
  const PAIRS: [string, string, string, string][] = [['Adenine', '#e8794a', 'Thymine', '#f2c94f'], ['Guanine', '#5fb37a', 'Cytosine', '#4fb3d9']];
  const n = 20;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const a = t * turns * Math.PI * 2;
    const y = -height / 2 + t * height;
    const [n1, c1, n2, c2] = PAIRS[(i * 7) % 3 === 0 ? 1 : 0];
    const flip = i % 2 === 1;
    const half = (s: number): V => [Math.cos(a + (s ? Math.PI : 0)) * R * 0.5, y, Math.sin(a + (s ? Math.PI : 0)) * R * 0.5];
    const deg = (-a * 180) / Math.PI;
    parts.push(P({ name: flip ? n2 : n1, shape: 'cylinder', surface: 'glossy', position: half(0), size: [0.16, R, 0.16], rotation: [0, deg, 90], color: flip ? c2 : c1 }));
    parts.push(P({ name: flip ? n1 : n2, shape: 'cylinder', surface: 'glossy', position: half(1), size: [0.16, R, 0.16], rotation: [0, deg, 90], color: flip ? c1 : c2 }));
  }
  return parts;
}

function heart(): AnatomyPart[] {
  return [
    P({ name: 'Left ventricle', shape: 'ellipsoid', surface: 'bumpy', position: [0.55, -0.6, 0], size: [1.7, 2.6, 1.8], rotation: [0, 0, 18], color: '#b8323a' }),
    P({ name: 'Right ventricle', shape: 'ellipsoid', surface: 'bumpy', position: [-0.55, -0.45, 0.35], size: [1.6, 2.2, 1.5], rotation: [0, 0, -14], color: '#c8464e' }),
    P({ name: 'Left atrium', shape: 'ellipsoid', surface: 'bumpy', position: [0.75, 0.9, -0.35], size: [1.1, 0.95, 1.0], color: '#d0606a' }),
    P({ name: 'Right atrium', shape: 'ellipsoid', surface: 'bumpy', position: [-0.85, 0.85, 0.05], size: [1.15, 1.0, 1.05], color: '#a83a55' }),
    P({ name: 'Aorta', shape: 'tube', position: [0, 0, 0], size: [0.3, 0, 0], color: '#d9434b', path: [[0.2, 0.6, 0.1], [0.25, 1.9, 0.1], [-0.3, 2.5, -0.2], [-0.9, 2.2, -0.5], [-1.0, 1.2, -0.7], [-1.0, -0.5, -0.8]] }),
    P({ name: 'Pulmonary artery', shape: 'tube', position: [0, 0, 0], size: [0.24, 0, 0], color: '#4f6fd9', path: [[-0.3, 0.5, 0.5], [-0.1, 1.5, 0.6], [0.6, 1.9, 0.4], [1.5, 1.8, 0.2]] }),
    P({ name: 'Vena cava', shape: 'tube', position: [0, 0, 0], size: [0.26, 0, 0], color: '#3e55b8', path: [[-1.0, 2.6, 0.0], [-1.0, 1.6, 0.05], [-0.95, 0.9, 0.05]] }),
    P({ name: 'Vena cava', shape: 'tube', position: [0, 0, 0], size: [0.26, 0, 0], color: '#3e55b8', path: [[-0.95, 0.5, 0.05], [-1.0, -0.4, 0.0], [-1.05, -1.6, -0.1]] }),
  ];
}

export function builtinParts(model: AnatomyModel): AnatomyPart[] {
  switch (model) {
    case 'brain':
      return brain();
    case 'neuron':
      return neuron();
    case 'cell':
      return cell();
    case 'dna':
      return dna();
    case 'heart':
      return heart();
  }
}
