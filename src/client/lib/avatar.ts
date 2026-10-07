// Darker ends keep white initials above 4.5:1 contrast.
const GRADIENTS = [
  ["#2f6feb", "#1e40af"],
  ["#6d4ae8", "#4325b8"],
  ["#0e7490", "#0b4f6c"],
  ["#0f8a6a", "#0b5e4b"],
  ["#c2410c", "#9a3412"],
  ["#be185d", "#9d174d"],
  ["#4f46e5", "#3730a3"],
] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function avatarGradient(seed: string): string {
  const [from, to] = GRADIENTS[hash(seed.toLowerCase()) % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
