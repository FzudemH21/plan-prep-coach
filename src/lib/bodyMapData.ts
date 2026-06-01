// ── Body map region definitions ───────────────────────────────────────────────
// Adapted from OSTRC body map (Clarsen et al.)

export interface BodyRegion {
  id: number;
  label: string;
}

export const BODY_REGIONS: BodyRegion[] = [
  { id: 1,  label: 'Head / Face' },
  { id: 2,  label: 'Neck' },
  { id: 3,  label: 'Shoulder' },
  { id: 4,  label: 'Upper Arm' },
  { id: 5,  label: 'Elbow' },
  { id: 6,  label: 'Forearm' },
  { id: 7,  label: 'Wrist' },
  { id: 8,  label: 'Hand / Fingers' },
  { id: 9,  label: 'Chest / Ribs' },
  { id: 10, label: 'Abdomen' },
  { id: 11, label: 'Thoracic Spine' },
  { id: 12, label: 'Lumbar Spine' },
  { id: 13, label: 'Pelvis / Buttock' },
  { id: 14, label: 'Hip / Groin' },
  { id: 15, label: 'Thigh' },
  { id: 16, label: 'Knee' },
  { id: 17, label: 'Lower Leg' },
  { id: 18, label: 'Ankle' },
  { id: 19, label: 'Foot / Toes' },
  { id: 20, label: 'Other' },
];

// ── Region key helpers ────────────────────────────────────────────────────────
// regionKey format: "${areaId}-L", "${areaId}-R", or "${areaId}" for midline

export function getRegionKey(areaId: number, side?: 'L' | 'R'): string {
  return side ? `${areaId}-${side}` : String(areaId);
}

export function getRegionKeyLabel(regionKey: string): string {
  const base = BODY_REGIONS.find((r) => r.id === regionKeyId(regionKey))?.label ?? 'Unknown';
  if (regionKey.endsWith('-L')) return `Left ${base}`;
  if (regionKey.endsWith('-R')) return `Right ${base}`;
  return base;
}

function regionKeyId(regionKey: string): number {
  return parseInt(regionKey.replace(/-[LR]$/, ''));
}

// ── NRS severity → color (Farrar et al. 2001 cut-offs) ───────────────────────

export function nrsSeverityColor(nrs: number): string {
  if (nrs === 0) return 'rgba(0,0,0,0)';
  if (nrs <= 3)  return 'rgba(234,179,8,0.55)';
  if (nrs <= 6)  return 'rgba(249,115,22,0.60)';
  return 'rgba(220,38,38,0.65)';
}

export function nrsSeverityStroke(nrs: number): string {
  if (nrs === 0) return 'rgba(0,0,0,0)';
  if (nrs <= 3)  return 'rgba(180,130,0,0.8)';
  if (nrs <= 6)  return 'rgba(200,80,0,0.8)';
  return 'rgba(170,0,0,0.9)';
}

export function nrsSeverityLabel(nrs: number): string {
  if (nrs === 0) return 'None';
  if (nrs <= 3)  return 'Mild';
  if (nrs <= 6)  return 'Moderate';
  return 'Severe';
}

// ── SVG region shape ──────────────────────────────────────────────────────────

export interface SvgRegion {
  uid: string;
  areaId: number;
  side?: 'L' | 'R'; // undefined = midline / bilateral
  x: number; y: number; w: number; h: number;
}

// Derived key for use as Map key
export function svgRegionKey(r: SvgRegion): string {
  return getRegionKey(r.areaId, r.side);
}

// ── Front view regions — viewBox 0 0 193 306 ─────────────────────────────────
// Sides assigned from the ATHLETE's perspective:
//   athlete's RIGHT = viewer's LEFT = lower x in this image
//   athlete's LEFT  = viewer's RIGHT = higher x in this image
// Front image width=193, anatomical midline ≈ x=96

export const FRONT_REGIONS: SvgRegion[] = [
  // Head / Neck — midline
  { uid:'f1',   areaId:1,  x:74,  y:5,   w:44, h:47 },
  { uid:'f2',   areaId:2,  x:75,  y:52,  w:42, h:7  },
  // Shoulder — paired (R = viewer's left / lower x)
  { uid:'f3a',  areaId:3,  side:'R', x:51,  y:60,  w:16, h:25 },
  { uid:'f3b',  areaId:3,  side:'L', x:124, y:60,  w:16, h:27 },
  { uid:'f3c',  areaId:3,  side:'L', x:99,  y:63,  w:23, h:6  },
  { uid:'f3d',  areaId:3,  side:'R', x:68,  y:60,  w:26, h:10 },
  // Upper arm
  { uid:'f4a',  areaId:4,  side:'R', x:49,  y:87,  w:13, h:28 },
  { uid:'f4b',  areaId:4,  side:'L', x:123, y:89,  w:21, h:23 },
  // Elbow
  { uid:'f5a',  areaId:5,  side:'R', x:41,  y:114, w:24, h:9  },
  { uid:'f5b',  areaId:5,  side:'L', x:123, y:115, w:31, h:6  },
  // Forearm
  { uid:'f6a',  areaId:6,  side:'R', x:30,  y:125, w:32, h:29 },
  { uid:'f6b',  areaId:6,  side:'L', x:126, y:124, w:32, h:30 },
  // Wrist
  { uid:'f7a',  areaId:7,  side:'R', x:29,  y:155, w:22, h:8  },
  { uid:'f7b',  areaId:7,  side:'L', x:140, y:155, w:23, h:4  },
  // Hand/fingers
  { uid:'f8a',  areaId:8,  side:'R', x:19,  y:163, w:28, h:32 },
  { uid:'f8b',  areaId:8,  side:'L', x:140, y:161, w:32, h:33 },
  // Chest/ribs — midline (spans across)
  { uid:'f9a',  areaId:9,  x:67,  y:71,  w:53, h:23 },
  { uid:'f9b',  areaId:9,  x:67,  y:95,  w:13, h:20 },
  { uid:'f9c',  areaId:9,  x:110, y:95,  w:12, h:20 },
  // Abdomen — midline
  { uid:'f10a', areaId:10, x:80,  y:96,  w:28, h:42 },
  { uid:'f10b', areaId:10, x:110, y:117, w:13, h:18 },
  { uid:'f10c', areaId:10, x:67,  y:117, w:12, h:20 },
  // Hip/groin — midline (spans both sides)
  { uid:'f14',  areaId:14, x:63,  y:139, w:63, h:26 },
  // Thigh
  { uid:'f15a', areaId:15, side:'R', x:61,  y:166, w:30, h:45 },
  { uid:'f15b', areaId:15, side:'L', x:96,  y:167, w:30, h:44 },
  // Knee
  { uid:'f16a', areaId:16, side:'R', x:66,  y:212, w:24, h:11 },
  { uid:'f16b', areaId:16, side:'L', x:97,  y:214, w:26, h:11 },
  // Lower leg
  { uid:'f17a', areaId:17, side:'R', x:64,  y:223, w:25, h:52 },
  { uid:'f17b', areaId:17, side:'L', x:96,  y:227, w:28, h:48 },
  // Ankle
  { uid:'f18a', areaId:18, side:'R', x:71,  y:277, w:19, h:8  },
  { uid:'f18b', areaId:18, side:'L', x:98,  y:276, w:21, h:8  },
  // Foot/toes
  { uid:'f19a', areaId:19, side:'R', x:59,  y:285, w:32, h:14 },
  { uid:'f19b', areaId:19, side:'L', x:97,  y:284, w:30, h:16 },
];

// ── Back view regions — viewBox 0 0 211 317 ──────────────────────────────────
// Same athlete perspective: R = lower x, L = higher x

export const BACK_REGIONS: SvgRegion[] = [
  // Head / Neck — midline
  { uid:'b1',   areaId:1,  x:86,  y:7,   w:35, h:24 },
  { uid:'b2a',  areaId:2,  x:91,  y:31,  w:26, h:13 },
  { uid:'b2b',  areaId:2,  x:78,  y:47,  w:16, h:7  },
  { uid:'b2c',  areaId:2,  x:112, y:47,  w:14, h:6  },
  // Shoulder
  { uid:'b3a',  areaId:3,  side:'R', x:59,  y:55,  w:29, h:22 },
  { uid:'b3b',  areaId:3,  side:'L', x:126, y:52,  w:25, h:28 },
  // Upper arm
  { uid:'b4a',  areaId:4,  side:'R', x:55,  y:80,  w:20, h:26 },
  { uid:'b4b',  areaId:4,  side:'L', x:134, y:82,  w:17, h:27 },
  // Elbow
  { uid:'b5a',  areaId:5,  side:'R', x:47,  y:106, w:28, h:12 },
  { uid:'b5b',  areaId:5,  side:'L', x:131, y:110, w:31, h:6  },
  // Forearm
  { uid:'b6a',  areaId:6,  side:'R', x:44,  y:121, w:27, h:27 },
  { uid:'b6b',  areaId:6,  side:'L', x:135, y:119, w:30, h:32 },
  // Wrist
  { uid:'b7a',  areaId:7,  side:'R', x:42,  y:150, w:18, h:6  },
  { uid:'b7b',  areaId:7,  side:'L', x:149, y:153, w:21, h:3  },
  // Hand/fingers
  { uid:'b8a',  areaId:8,  side:'R', x:32,  y:155, w:28, h:30 },
  { uid:'b8b',  areaId:8,  side:'L', x:146, y:159, w:30, h:28 },
  // Thoracic / Lumbar spine — midline
  { uid:'b11a', areaId:11, x:96,  y:47,  w:16, h:64 },
  { uid:'b11b', areaId:11, x:75,  y:79,  w:17, h:32 },
  { uid:'b11c', areaId:11, x:114, y:83,  w:15, h:29 },
  { uid:'b12a', areaId:12, x:95,  y:113, w:17, h:16 },
  { uid:'b12b', areaId:12, x:77,  y:113, w:15, h:10 },
  { uid:'b12c', areaId:12, x:112, y:115, w:17, h:8  },
  // Pelvis/buttock — midline
  { uid:'b13a', areaId:13, x:76,  y:126, w:56, h:9  },
  { uid:'b13b', areaId:13, x:72,  y:135, w:66, h:28 },
  // Thigh
  { uid:'b15a', areaId:15, side:'R', x:70,  y:165, w:32, h:37 },
  { uid:'b15b', areaId:15, side:'L', x:104, y:165, w:31, h:38 },
  // Knee
  { uid:'b16a', areaId:16, side:'R', x:77,  y:203, w:24, h:8  },
  { uid:'b16b', areaId:16, side:'L', x:107, y:206, w:25, h:6  },
  // Lower leg
  { uid:'b17a', areaId:17, side:'R', x:74,  y:212, w:27, h:50 },
  { uid:'b17b', areaId:17, side:'L', x:104, y:213, w:28, h:49 },
  // Ankle
  { uid:'b18a', areaId:18, side:'R', x:81,  y:263, w:17, h:9  },
  { uid:'b18b', areaId:18, side:'L', x:108, y:264, w:17, h:8  },
  // Foot/toes
  { uid:'b19a', areaId:19, side:'R', x:78,  y:275, w:23, h:33 },
  { uid:'b19b', areaId:19, side:'L', x:106, y:274, w:25, h:35 },
];
