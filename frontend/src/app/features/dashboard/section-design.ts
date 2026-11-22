// Warm palette that sits well next to the maroon sidebar. All dark enough for white text.
const PALETTE: [string, string][] = [
  ['#800000', '#5c0000'], // maroon
  ['#a4161a', '#7a0f12'], // brick
  ['#b5651d', '#8a4a12'], // bronze
  ['#a67c00', '#7a5a00'], // gold
  ['#5d4037', '#3e2723'], // brown
  ['#2e5e4e', '#1d3f34'], // pine
  ['#3d4a7a', '#2a3560'], // navy
  ['#455a64', '#263238'], // slate
];

/** Stable "random" banner look: the same section always gets the same one. */
export function sectionDesign(id: string): { c1: string; c2: string; pattern: number } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [c1, c2] = PALETTE[h % PALETTE.length];
  return { c1, c2, pattern: h % 5 };
}
