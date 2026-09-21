/**
 * Builds the point cloud for the globe by rasterising simplified continent
 * outlines and sampling the result. Drawing the landmasses and reading back
 * pixels is far cheaper to ship than a GeoJSON file, and it keeps the whole
 * landing dependency-free.
 */

type Ring = [number, number][]; // [lon, lat] in degrees

const CONTINENTS: Ring[] = [
  // North America
  [
    [-168, 65], [-160, 70], [-140, 70], [-125, 70], [-110, 68], [-95, 70],
    [-85, 70], [-75, 68], [-60, 58], [-55, 50], [-65, 45], [-70, 42],
    [-75, 35], [-81, 25], [-90, 29], [-97, 26], [-105, 20], [-110, 23],
    [-115, 30], [-125, 40], [-130, 50], [-140, 58], [-150, 60], [-165, 55],
  ],
  // Central America
  [
    [-97, 16], [-90, 17], [-83, 10], [-78, 9], [-77, 7], [-85, 11], [-92, 14],
  ],
  // South America
  [
    [-80, 8], [-72, 11], [-62, 10], [-52, 5], [-45, -2], [-35, -6],
    [-38, -15], [-48, -25], [-58, -35], [-62, -42], [-68, -52], [-73, -52],
    [-71, -40], [-70, -25], [-75, -15], [-81, -5],
  ],
  // Europe
  [
    [-10, 36], [-9, 43], [-2, 48], [2, 51], [5, 53], [8, 55], [10, 58],
    [18, 60], [25, 60], [30, 60], [30, 50], [28, 45], [20, 42], [14, 41],
    [12, 38], [16, 38], [9, 44], [4, 43], [-2, 36],
  ],
  // Africa
  [
    [-17, 15], [-16, 22], [-10, 30], [0, 33], [10, 34], [20, 32], [32, 31],
    [35, 23], [38, 15], [43, 11], [51, 11], [48, 3], [41, -3], [40, -12],
    [35, -20], [32, -26], [28, -33], [20, -34], [15, -28], [12, -18],
    [9, -2], [5, 5], [-5, 5], [-13, 9],
  ],
  // Asia
  [
    [30, 60], [40, 68], [55, 70], [70, 72], [90, 75], [110, 75], [130, 72],
    [145, 70], [160, 68], [175, 66], [180, 62], [170, 60], [160, 58],
    [150, 50], [140, 45], [135, 35], [122, 31], [120, 22], [110, 20],
    [105, 10], [100, 5], [95, 15], [90, 22], [88, 20], [80, 10], [77, 8],
    [72, 20], [68, 24], [62, 25], [58, 22], [50, 28], [45, 38], [40, 38],
    [35, 36], [30, 45],
  ],
  // Australia
  [
    [113, -22], [115, -32], [118, -35], [129, -32], [138, -35], [145, -38],
    [150, -35], [153, -28], [146, -19], [142, -11], [132, -12], [126, -14],
    [122, -17],
  ],
  // Greenland
  [
    [-45, 60], [-30, 68], [-20, 75], [-30, 82], [-50, 80], [-58, 75], [-55, 66],
  ],
  // British Isles
  [[-8, 51], [-3, 58], [0, 53], [-5, 50]],
  // Japan
  [[130, 31], [136, 35], [141, 40], [145, 44], [140, 38], [134, 34]],
  // New Zealand
  [[166, -46], [174, -41], [178, -37], [172, -43]],
  // Madagascar
  [[43, -12], [50, -16], [47, -25], [44, -20]],
];

export interface WorldDot {
  lon: number;
  lat: number;
}

/**
 * Rasterises the continents to an offscreen canvas, then walks a lat/lon grid
 * and keeps the cells that landed on ink.
 */
export function sampleWorldDots(step = 2.2): WorldDot[] {
  const W = 720;
  const H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";

  for (const ring of CONTINENTS) {
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    // Stroking as well thickens thin peninsulas and island chains.
    ctx.stroke();
  }

  const data = ctx.getImageData(0, 0, W, H).data;
  const dots: WorldDot[] = [];

  for (let lat = -78; lat <= 82; lat += step) {
    // Keep the dot density even by thinning rows as they approach the poles.
    const circumference = Math.cos((lat * Math.PI) / 180);
    const lonStep = step / Math.max(0.18, circumference);
    for (let lon = -180; lon < 180; lon += lonStep) {
      const x = Math.floor(((lon + 180) / 360) * W);
      const y = Math.floor(((90 - lat) / 180) * H);
      const idx = (y * W + x) * 4;
      if (data[idx] > 120) dots.push({ lon, lat });
    }
  }

  return dots;
}

/** Converts geographic coordinates to a point on a sphere of given radius. */
export function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ] as [number, number, number];
}

/** Cities used as origin/destination for the animated trade arcs. */
export const MARKET_CITIES: { name: string; lat: number; lon: number }[] = [
  { name: "Caracas", lat: 10.5, lon: -66.9 },
  { name: "Bogotá", lat: 4.7, lon: -74.1 },
  { name: "Ciudad de México", lat: 19.4, lon: -99.1 },
  { name: "Lima", lat: -12.0, lon: -77.0 },
  { name: "Buenos Aires", lat: -34.6, lon: -58.4 },
  { name: "Madrid", lat: 40.4, lon: -3.7 },
  { name: "Miami", lat: 25.8, lon: -80.2 },
  { name: "Santiago", lat: -33.4, lon: -70.6 },
];
