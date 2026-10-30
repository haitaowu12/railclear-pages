// Exact decimal-rational arithmetic for the conservative bound only.
// Inputs mean their canonical JSON decimal spelling, not an inferred precision.
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
export function ratio(n, d = 1n) {
  if (d === 0n) throw new Error("Zero rational denominator.");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function decimal(x) {
  if (typeof x === "number" && !Number.isFinite(x))
    throw new Error("Nonfinite decimal.");
  const m = String(x).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!m) throw new Error("Invalid decimal.");
  const digits = m[2] + (m[3] || ""),
    exponent = Number(m[4] || 0) - (m[3] || "").length;
  return ratio(
    BigInt((m[1] === "-" ? "-" : "") + digits) *
      (exponent > 0 ? 10n ** BigInt(exponent) : 1n),
    exponent < 0 ? 10n ** BigInt(-exponent) : 1n,
  );
}
export const add = (a, b) => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a) => ratio(-a.n, a.d);
export const sub = (a, b) => add(a, neg(b));
export const mul = (a, b) => ratio(a.n * b.n, a.d * b.d);
export const div = (a, b) => ratio(a.n * b.d, a.d * b.n);
export const cmp = (a, b) => {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
};
export const max = (...xs) => xs.reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
export const min = (...xs) => xs.reduce((a, b) => (cmp(a, b) <= 0 ? a : b));
export const square = (a) => mul(a, a);
export const exact = (a) => ({
  numerator: String(a.n),
  denominator: String(a.d),
});
const ceil = (a) => a.n / a.d + (a.n > 0n && a.n % a.d ? 1n : 0n);
export const ceilTo = (a, increment) =>
  mul(ratio(ceil(div(a, increment))), increment);
const bits = new DataView(new ArrayBuffer(8));
function next(x, direction) {
  if (x === 0) return direction * Number.MIN_VALUE;
  bits.setFloat64(0, x);
  let b = bits.getBigUint64(0);
  bits.setBigUint64(0, b + (x > 0 === direction > 0 ? 1n : -1n));
  return bits.getFloat64(0);
}
// Display/export numbers are outward decimal enclosures; exact fractions remain evidence.
export function outward(a, direction = 1) {
  // Micrometre precision for ordinary distances; retain significant digits for
  // small rates/allowances instead of turning a positive lower value into zero.
  const magnitudeDigits =
    (a.n < 0n ? -a.n : a.n).toString().length - a.d.toString().length;
  const places = Math.max(6, 16 - magnitudeDigits);
  const scale = ratio(10n ** BigInt(places));
  const ticks = direction > 0 ? ceil(mul(a, scale)) : -ceil(mul(neg(a), scale));
  // Decimal parsing avoids overflowing numerator/denominator Number conversion.
  let x = Number(`${ticks}e-${places}`);
  if (!Number.isFinite(x))
    throw new Error("Bound exceeds numeric presentation range.");
  while (cmp(decimal(x), a) * direction < 0) x = next(x, direction);
  return x === 0 ? 0 : x;
}
