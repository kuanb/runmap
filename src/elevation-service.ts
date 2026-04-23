import { Map as MapboxMap, LngLat } from 'mapbox-gl';
import { RunSegment } from './current-run';

const SAMPLES_PER_SEGMENT = 20;

interface CachedPoint {
  coord: [number, number];
  distance: number;
  elevation: number | null;
}

export interface ProfilePoint {
  distance: number;
  elevation: number;
}

export class ElevationService {
  private map: MapboxMap;
  private cache = new Map<string, CachedPoint[]>();
  private listeners: Array<() => void> = [];
  private retryScheduled = false;

  constructor(map: MapboxMap) {
    this.map = map;
  }

  public onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  public addSegment(segment: RunSegment): void {
    const coords = (segment.geometry as any).coordinates as number[][];
    if (!coords || coords.length === 0) return;
    const sampled = subsample(coords, SAMPLES_PER_SEGMENT);
    const points: CachedPoint[] = [];
    let cumulative = 0;
    let prev: number[] | null = null;
    for (const c of sampled) {
      if (prev) cumulative += haversineMeters(prev, c);
      points.push({
        coord: [c[0], c[1]],
        distance: cumulative,
        elevation: this.queryElevation(c)
      });
      prev = c;
    }
    this.cache.set(segment.id, points);
    this.scheduleRetryIfNeeded();
    this.notify();
  }

  public removeSegment(segmentId: string): void {
    if (this.cache.delete(segmentId)) this.notify();
  }

  public clear(): void {
    if (this.cache.size === 0) return;
    this.cache.clear();
    this.notify();
  }

  public getProfile(segments: RunSegment[]): ProfilePoint[] {
    const profile: ProfilePoint[] = [];
    let offset = 0;
    for (const seg of segments) {
      const cached = this.cache.get(seg.id);
      if (cached) {
        for (const p of cached) {
          if (p.elevation !== null) {
            profile.push({ distance: offset + p.distance, elevation: p.elevation });
          }
        }
      }
      offset += seg.distance;
    }
    return profile;
  }

  private queryElevation(coord: number[]): number | null {
    const m = this.map as any;
    if (typeof m.queryTerrainElevation !== 'function') return null;
    try {
      const el = m.queryTerrainElevation(new LngLat(coord[0], coord[1]));
      return typeof el === 'number' && isFinite(el) ? el : null;
    } catch {
      return null;
    }
  }

  private scheduleRetryIfNeeded(): void {
    if (this.retryScheduled) return;
    let hasMissing = false;
    for (const points of this.cache.values()) {
      if (points.some(p => p.elevation === null)) { hasMissing = true; break; }
    }
    if (!hasMissing) return;
    this.retryScheduled = true;
    this.map.once('idle', () => {
      this.retryScheduled = false;
      this.retryMissing();
    });
  }

  private retryMissing(): void {
    let updated = false;
    for (const points of this.cache.values()) {
      for (const p of points) {
        if (p.elevation === null) {
          const el = this.queryElevation(p.coord);
          if (el !== null) { p.elevation = el; updated = true; }
        }
      }
    }
    if (updated) this.notify();
    this.scheduleRetryIfNeeded();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

function subsample(coords: number[][], n: number): number[][] {
  if (coords.length <= n) return coords;
  const out: number[][] = [];
  const step = (coords.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(coords[Math.round(i * step)]);
  return out;
}

function haversineMeters(a: number[], b: number[]): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
