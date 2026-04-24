const BRAND_SHORTCUTS: [RegExp, string][] = [
  [/Massimo Zero bezlepkov[áéý]\s*/i, "MZ "],
  [/Piaceri Mediterranei bezlepkov[áéý]\s*/i, "PM "],
  [/Massimo Zero\s*/i, "MZ "],
  [/Piaceri Mediterranei\s*/i, "PM "],
  [/Bauer bezlepkov[áéý]\s*/i, "Bauer "],
  [/Glutiniente bezlepkov[áéý]\s*/i, "Glutiniente "],
];

export function shortenProductName(name: string): string {
  for (const [pattern, replacement] of BRAND_SHORTCUTS) {
    if (pattern.test(name)) {
      return name.replace(pattern, replacement).trim();
    }
  }
  return name;
}
