// Google Encoded Polyline Algorithm Format, precision 5 (~1m).
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm

const PRECISION = 5;
const FACTOR = Math.pow(10, PRECISION);

export function encode(points: Array<[number, number]>): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lng, lat] of points) {
    const lat5 = Math.round(lat * FACTOR);
    const lng5 = Math.round(lng * FACTOR);
    out += encodeSignedNumber(lat5 - prevLat);
    out += encodeSignedNumber(lng5 - prevLng);
    prevLat = lat5;
    prevLng = lng5;
  }
  return out;
}

export function decode(str: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    const [dLat, afterLat] = decodeSignedNumber(str, index);
    lat += dLat;
    const [dLng, afterLng] = decodeSignedNumber(str, afterLat);
    lng += dLng;
    index = afterLng;
    points.push([lng / FACTOR, lat / FACTOR]);
  }
  return points;
}

function encodeSignedNumber(num: number): string {
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  let out = '';
  while (sgn >= 0x20) {
    out += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>>= 5;
  }
  out += String.fromCharCode(sgn + 63);
  return out;
}

function decodeSignedNumber(str: string, index: number): [number, number] {
  let result = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = str.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  const delta = (result & 1) ? ~(result >> 1) : (result >> 1);
  return [delta, index];
}
