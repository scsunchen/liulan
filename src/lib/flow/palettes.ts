export type RGB = readonly [number, number, number];

export type Palette = {
  id: string;
  name: string;
  ground: RGB;
  stops: readonly RGB[];
  /** Additive strokes bloom; ink stays matte. */
  glow: boolean;
};

export const PALETTES: readonly Palette[] = [
  {
    id: "sumi",
    name: "素墨",
    ground: [12, 11, 10],
    stops: [
      [244, 239, 230],
      [214, 196, 168],
      [140, 122, 102],
      [232, 226, 214],
    ],
    glow: false,
  },
  {
    id: "tide",
    name: "夜潮",
    ground: [7, 10, 16],
    stops: [
      [168, 214, 206],
      [110, 186, 176],
      [58, 132, 148],
      [214, 206, 184],
    ],
    glow: true,
  },
  {
    id: "dawn",
    name: "曙光",
    ground: [16, 11, 12],
    stops: [
      [255, 236, 224],
      [242, 176, 150],
      [196, 92, 74],
      [244, 206, 170],
    ],
    glow: false,
  },
  {
    id: "frost",
    name: "霜白",
    ground: [8, 10, 14],
    stops: [
      [228, 236, 244],
      [176, 198, 218],
      [112, 140, 168],
      [236, 240, 244],
    ],
    glow: true,
  },
  {
    id: "ember",
    name: "赤焰",
    ground: [14, 9, 8],
    stops: [
      [255, 228, 206],
      [232, 122, 74],
      [164, 52, 40],
      [255, 196, 150],
    ],
    glow: false,
  },
  {
    id: "celadon",
    name: "青瓷",
    ground: [9, 12, 10],
    stops: [
      [236, 242, 232],
      [156, 186, 156],
      [70, 112, 90],
      [214, 196, 168],
    ],
    glow: false,
  },
];

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[1]!;
}

export function rgbCss(c: RGB, a = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function hex(c: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

export function lerpColor(stops: readonly RGB[], t: number): RGB {
  const n = stops.length - 1;
  const x = Math.min(1, Math.max(0, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
}
