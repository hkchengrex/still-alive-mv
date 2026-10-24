import { hexToLinear } from './util';

// The whole video lives in a restrained palette (docs/DESIGN.md): blue-blacks, bone, a cold blue-grey, and
// one signal colour, the nixie tube's orange, owned by the world line and the meter. One rare accent
// (phosphor, the meter landing, ~2 s). Act II (β) adds crimson, blood red, owned by that act.
export const HEX = {
  ink: '#0B0C0E', // background black (blue-black)
  ink2: '#16181B', // raised black (panels, plastic)
  gunmetal: '#3A3F45', // hardware, dim lines, secondary text
  ash: '#8E9389', // mid grey
  bone: '#E9E5DA', // paper white, primary text
  cold: '#5F7887', // the cold blue-grey of Act II's grade
  lcd: '#A9B89A', // the flip phone's backlit LCD
  nixie: '#FF6A1F', // tube glow: the signal colour
  ember: '#FFB061', // hot cores (cathodes, the degauss flash)
  blood: '#A8320C', // deep shadow of nixie
  phosphor: '#8CFF7A', // only for the meter landing on 1.048596
  crimson: '#B0101C', // Act II (β): blood, owned by that act
  gore: '#4A050B', // the deep shadow of crimson (a pool of blood)
  // the fork's names kept as aliases so the inherited engine code keeps working
  graphite: '#3A3F45', // = gunmetal
  signal: '#FF6A1F', // = nixie
  acid: '#8CFF7A', // = phosphor
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
