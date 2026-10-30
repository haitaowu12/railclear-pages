const n = (v, d = 1) =>
    v === null || v === undefined
      ? "—"
      : Number.isFinite(v)
        ? v.toLocaleString("en", {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
          })
        : "Invalid",
  ch = (x) => {
    const a = Math.round(Math.abs(x) * 10) / 10;
    return `${x < 0 ? "-" : ""}${Math.floor(a / 1000)}+${(a % 1000).toFixed(1).padStart(5, "0")}`;
  };
export function trajectorySVG(g, p) {
  if (!g)
    return '<div class="empty-chart"><div>Speed × distance</div><p>Your computed trajectory will appear here.</p><span>Vehicle + alignment + failure timeline → traceable result</span></div>';
  const W = 900,
    H = 300,
    L = 55,
    R = 25,
    T = 22,
    B = 46,
    maxD = Math.max(g.protectedM, g.serviceM) * 1.08 || 1,
    maxV = Math.max(g.peakKph, g.speedKph) * 1.12 || 1,
    x = (d) => L + (d / maxD) * (W - L - R),
    y = (v) => H - B - (v / maxV) * (H - T - B);
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = (maxV * i) / 4;
    return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3eae6"/><text x="${L - 9}" y="${y(v) + 4}" text-anchor="end">${n(v, 0)}</text>`;
  }).join("");
  const path = g.points
    .map((v, i) => `${i ? "L" : "M"}${x(v.d).toFixed(2)},${y(v.v).toFixed(2)}`)
    .join(" ");
  const service = Array.from({ length: 61 }, (_, i) => {
    const d = (g.serviceM * i) / 60,
      v =
        Math.sqrt(
          Math.max(0, (g.speedKph / 3.6) ** 2 - 2 * p.vehicle.serviceA * d),
        ) * 3.6;
    return `${i ? "L" : "M"}${x(d)},${y(v)}`;
  }).join(" ");
  return `<svg id="trajectory-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Governing failure trajectory: speed versus distance; raw first arrest ${n(g.distanceM)} metres, service reference ${n(g.serviceM)} metres." style="font:11px system-ui;fill:#66766d"><rect width="900" height="300" fill="white"/>${grid}<rect x="${x(g.distanceM)}" y="${T}" width="${Math.max(0, x(g.protectedM) - x(g.distanceM))}" height="${H - B - T}" fill="#f5cf88" opacity=".4"/><path d="${path} L${x(g.distanceM)},${y(0)} L${x(0)},${y(0)}Z" fill="#c8e5dd" opacity=".45"/><path d="${service}" fill="none" stroke="#648cc2" stroke-width="2" stroke-dasharray="5 5"/><path d="${path}" fill="none" stroke="#147565" stroke-width="3"/><circle cx="${x(g.distanceM)}" cy="${y(0)}" r="4" fill="#147565"/>${Array.from(
    { length: 6 },
    (_, i) => {
      const d = (maxD * i) / 5;
      return `<text x="${x(d)}" y="${H - B + 22}" text-anchor="middle">${n(d, 0)}</text>`;
    },
  ).join(
    "",
  )}<text x="${L}" y="12">km/h</text><text x="${W - R}" y="${H - 3}" text-anchor="end">Distance from failure start · m</text><text x="${Math.min(W - 180, x(g.distanceM) + 10)}" y="${T + 18}" fill="#147565">First arrest ${n(g.distanceM)} m</text></svg>`;
}
export function alignmentSVG(p) {
  const W = 900,
    H = 145,
    L = 55,
    R = 25,
    T = 12,
    B = 30,
    a = p.alignment,
    lo = a[0].fromM,
    hi = a.at(-1).toM,
    max = Math.max(10, ...a.map((x) => Math.abs(x.gradientPermille))),
    x = (c) => L + ((c - lo) / (hi - lo)) * (W - L - R),
    y = (g) => T + ((max - g) / (2 * max)) * (H - T - B);
  const path = a
    .map(
      (r, i) =>
        `${i ? "L" : "M"}${x(r.fromM)},${y(r.gradientPermille)} L${x(r.toM)},${y(r.gradientPermille)}`,
    )
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Alignment gradient profile. Exact segment values are in Alignment data." style="font:11px system-ui;fill:#65736c"><rect x="${x(p.study.fromM)}" y="${T}" width="${Math.max(0, x(p.study.toM) - x(p.study.fromM))}" height="${H - T - B}" fill="#eef3f0"/><line x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}" stroke="#b8c7bf"/><path d="${path}" fill="none" stroke="#c18a37" stroke-width="2"/>${[-max, 0, max].map((g) => `<text x="${L - 8}" y="${y(g) + 3}" text-anchor="end">${n(g, 0)}</text>`).join("")}${Array.from(
    { length: 6 },
    (_, i) => {
      const c = lo + ((hi - lo) * i) / 5;
      return `<text x="${x(c)}" y="${H - 7}" text-anchor="middle">${ch(c)}</text>`;
    },
  ).join("")}</svg>`;
}
