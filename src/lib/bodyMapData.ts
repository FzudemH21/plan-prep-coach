// ── Body map region definitions ───────────────────────────────────────────────
// Adapted from OSTRC body map (Clarsen et al.)
// Region IDs match the original OSTRC numbering.

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

export function getRegionLabel(id: number): string {
  return BODY_REGIONS.find((r) => r.id === id)?.label ?? 'Unknown';
}

// ── NRS severity → color ──────────────────────────────────────────────────────
// Cut-offs from Farrar et al. (2001) — standard in pain research

export function nrsSeverityColor(nrs: number): string {
  if (nrs === 0) return 'transparent';
  if (nrs <= 3)  return 'rgba(234,179,8,0.55)';   // yellow
  if (nrs <= 6)  return 'rgba(249,115,22,0.60)';  // amber/orange
  return 'rgba(220,38,38,0.65)';                   // red
}

export function nrsSeverityColorHex(nrs: number): string {
  if (nrs === 0) return 'transparent';
  if (nrs <= 3)  return '#eab308';
  if (nrs <= 6)  return '#f97316';
  return '#dc2626';
}

export function nrsSeverityLabel(nrs: number): string {
  if (nrs === 0) return 'None';
  if (nrs <= 3)  return 'Mild';
  if (nrs <= 6)  return 'Moderate';
  return 'Severe';
}

// ── SVG region rectangles ─────────────────────────────────────────────────────

export interface SvgRegion {
  uid: string;
  areaId: number;
  x: number; y: number; w: number; h: number;
}

/** Front view — viewBox 0 0 193 306 */
export const FRONT_REGIONS: SvgRegion[] = [
  { uid:'f1',  areaId:1,  x:74,  y:5,   w:44, h:47 },
  { uid:'f2',  areaId:2,  x:75,  y:52,  w:42, h:7  },
  { uid:'f3a', areaId:3,  x:51,  y:60,  w:16, h:25 },
  { uid:'f3b', areaId:3,  x:124, y:60,  w:16, h:27 },
  { uid:'f3c', areaId:3,  x:99,  y:63,  w:23, h:6  },
  { uid:'f3d', areaId:3,  x:68,  y:60,  w:26, h:10 },
  { uid:'f4a', areaId:4,  x:49,  y:87,  w:13, h:28 },
  { uid:'f4b', areaId:4,  x:123, y:89,  w:21, h:23 },
  { uid:'f5a', areaId:5,  x:41,  y:114, w:24, h:9  },
  { uid:'f5b', areaId:5,  x:123, y:115, w:31, h:6  },
  { uid:'f6a', areaId:6,  x:30,  y:125, w:32, h:29 },
  { uid:'f6b', areaId:6,  x:126, y:124, w:32, h:30 },
  { uid:'f7a', areaId:7,  x:29,  y:155, w:22, h:8  },
  { uid:'f7b', areaId:7,  x:140, y:155, w:23, h:4  },
  { uid:'f8a', areaId:8,  x:19,  y:163, w:28, h:32 },
  { uid:'f8b', areaId:8,  x:140, y:161, w:32, h:33 },
  { uid:'f9a', areaId:9,  x:67,  y:71,  w:53, h:23 },
  { uid:'f9b', areaId:9,  x:67,  y:95,  w:13, h:20 },
  { uid:'f9c', areaId:9,  x:110, y:95,  w:12, h:20 },
  { uid:'f10a',areaId:10, x:80,  y:96,  w:28, h:42 },
  { uid:'f10b',areaId:10, x:110, y:117, w:13, h:18 },
  { uid:'f10c',areaId:10, x:67,  y:117, w:12, h:20 },
  { uid:'f14', areaId:14, x:63,  y:139, w:63, h:26 },
  { uid:'f15a',areaId:15, x:61,  y:166, w:30, h:45 },
  { uid:'f15b',areaId:15, x:96,  y:167, w:30, h:44 },
  { uid:'f16a',areaId:16, x:66,  y:212, w:24, h:11 },
  { uid:'f16b',areaId:16, x:97,  y:214, w:26, h:11 },
  { uid:'f17a',areaId:17, x:64,  y:223, w:25, h:52 },
  { uid:'f17b',areaId:17, x:96,  y:227, w:28, h:48 },
  { uid:'f18a',areaId:18, x:71,  y:277, w:19, h:8  },
  { uid:'f18b',areaId:18, x:98,  y:276, w:21, h:8  },
  { uid:'f19a',areaId:19, x:59,  y:285, w:32, h:14 },
  { uid:'f19b',areaId:19, x:97,  y:284, w:30, h:16 },
];

/** Back view — viewBox 0 0 211 317 */
export const BACK_REGIONS: SvgRegion[] = [
  { uid:'b1',  areaId:1,  x:86,  y:7,   w:35, h:24 },
  { uid:'b2a', areaId:2,  x:91,  y:31,  w:26, h:13 },
  { uid:'b2b', areaId:2,  x:78,  y:47,  w:16, h:7  },
  { uid:'b2c', areaId:2,  x:112, y:47,  w:14, h:6  },
  { uid:'b3a', areaId:3,  x:59,  y:55,  w:29, h:22 },
  { uid:'b3b', areaId:3,  x:126, y:52,  w:25, h:28 },
  { uid:'b4a', areaId:4,  x:55,  y:80,  w:20, h:26 },
  { uid:'b4b', areaId:4,  x:134, y:82,  w:17, h:27 },
  { uid:'b5a', areaId:5,  x:47,  y:106, w:28, h:12 },
  { uid:'b5b', areaId:5,  x:131, y:110, w:31, h:6  },
  { uid:'b6a', areaId:6,  x:44,  y:121, w:27, h:27 },
  { uid:'b6b', areaId:6,  x:135, y:119, w:30, h:32 },
  { uid:'b7a', areaId:7,  x:42,  y:150, w:18, h:6  },
  { uid:'b7b', areaId:7,  x:149, y:153, w:21, h:3  },
  { uid:'b8a', areaId:8,  x:32,  y:155, w:28, h:30 },
  { uid:'b8b', areaId:8,  x:146, y:159, w:30, h:28 },
  { uid:'b11a',areaId:11, x:96,  y:47,  w:16, h:64 },
  { uid:'b11b',areaId:11, x:75,  y:79,  w:17, h:32 },
  { uid:'b11c',areaId:11, x:114, y:83,  w:15, h:29 },
  { uid:'b12a',areaId:12, x:95,  y:113, w:17, h:16 },
  { uid:'b12b',areaId:12, x:77,  y:113, w:15, h:10 },
  { uid:'b12c',areaId:12, x:112, y:115, w:17, h:8  },
  { uid:'b13a',areaId:13, x:76,  y:126, w:56, h:9  },
  { uid:'b13b',areaId:13, x:72,  y:135, w:66, h:28 },
  { uid:'b15a',areaId:15, x:70,  y:165, w:32, h:37 },
  { uid:'b15b',areaId:15, x:104, y:165, w:31, h:38 },
  { uid:'b16a',areaId:16, x:77,  y:203, w:24, h:8  },
  { uid:'b16b',areaId:16, x:107, y:206, w:25, h:6  },
  { uid:'b17a',areaId:17, x:74,  y:212, w:27, h:50 },
  { uid:'b17b',areaId:17, x:104, y:213, w:28, h:49 },
  { uid:'b18a',areaId:18, x:81,  y:263, w:17, h:9  },
  { uid:'b18b',areaId:18, x:108, y:264, w:17, h:8  },
  { uid:'b19a',areaId:19, x:78,  y:275, w:23, h:33 },
  { uid:'b19b',areaId:19, x:106, y:274, w:25, h:35 },
];
