interface Point { x: number, y: number }

interface Geometry {
  lightTop: Point
  lightBottom: Point
  subjectRadius: number
  shadowWallX: number
  umbraTopPoint: Point
  penumbraBottomPoint: Point
  penumbraTopPoint: Point
  umbraBottomPoint: Point
  penumbraTopY: number
  penumbraBottomY: number
  umbraTopY: number
  umbraBottomY: number
  cross: Point | null
  beamLimitY: number
  topRayActive: boolean
  bottomRayActive: boolean
  umbraTopRayActive: boolean
  umbraBottomRayActive: boolean
}

export interface Ring {
  ringSize: number
  fovRatio: number
  angleDegrees: number
  geometry: Geometry
  isAntumbra: boolean
  perceptualWeight: number
  ringIndex: number
}

export function getTangents(lx: number, ly: number, cx: number, cy: number, r: number) {
  const dx = cx - lx;
  const dy = cy - ly;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= r)
    return null;

  const a = Math.asin(r / d);
  const t = Math.atan2(dy, dx);
  const t1 = t - a;
  const t2 = t + a;
  const distT = Math.sqrt(d * d - r * r);
  const p1 = { x: lx + distT * Math.cos(t1), y: ly + distT * Math.sin(t1) };
  const p2 = { x: lx + distT * Math.cos(t2), y: ly + distT * Math.sin(t2) };
  return p1.y < p2.y ? { upper: p1, lower: p2 } : { upper: p2, lower: p1 };
}

export function getIntersection(p1: Point, p2: Point, p3: Point, p4: Point) {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 0.001)
    return null;
  const intersectX = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) - (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denom;
  const intersectY = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denom;
  return { x: intersectX, y: intersectY };
}

export function getWallY(p1: Point, p2: Point, wallX: number) {
  const slope = (p2.y - p1.y) / (p2.x - p1.x);
  return p1.y + slope * (wallX - p1.x);
}
