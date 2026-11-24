const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) (out += s), (n -= v);
  return out;
}

/** Oznaczenie słupa w konwencji eksploatacyjnej: "84/I/8/2/1". */
export function poleLabel(cabinetNumber: string, circuitNumber: number, number: string | null): string {
  return [cabinetNumber, toRoman(circuitNumber), number].filter(Boolean).join('/');
}
