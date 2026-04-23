import { ProfilePoint } from './elevation-service';

const WIDTH = 400;
const HEIGHT = 70;
const PADDING_TOP = 6;
const PADDING_BOTTOM = 4;

export interface ElevationMetrics {
  gainMeters: number;
  lossMeters: number;
  minElevationMeters: number;
  maxElevationMeters: number;
}

export function renderElevationChart(
  profile: ProfilePoint[],
  areaPath: SVGPathElement,
  linePath: SVGPathElement
): ElevationMetrics {
  const empty: ElevationMetrics = {
    gainMeters: 0, lossMeters: 0, minElevationMeters: 0, maxElevationMeters: 0
  };
  if (profile.length < 2) {
    areaPath.setAttribute('d', '');
    linePath.setAttribute('d', '');
    return empty;
  }
  const totalDist = profile[profile.length - 1].distance || 1;
  let minEl = Infinity, maxEl = -Infinity;
  for (const p of profile) {
    if (p.elevation < minEl) minEl = p.elevation;
    if (p.elevation > maxEl) maxEl = p.elevation;
  }
  const range = Math.max(maxEl - minEl, 1);
  const usable = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const parts: string[] = [];
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    const x = (p.distance / totalDist) * WIDTH;
    const y = PADDING_TOP + (1 - (p.elevation - minEl) / range) * usable;
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const lineD = parts.join(' ');
  const areaD = `${lineD} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;

  linePath.setAttribute('d', lineD);
  areaPath.setAttribute('d', areaD);

  let gain = 0, loss = 0;
  for (let i = 1; i < profile.length; i++) {
    const delta = profile[i].elevation - profile[i - 1].elevation;
    if (delta > 0) gain += delta;
    else loss -= delta;
  }
  return { gainMeters: gain, lossMeters: loss, minElevationMeters: minEl, maxElevationMeters: maxEl };
}

export function formatElevation(meters: number, useMetric: boolean): string {
  if (useMetric) return `${Math.round(meters)} m`;
  return `${Math.round(meters * 3.28084)} ft`;
}
