import { esc } from "./exports.mjs";
export const PALETTE = [
  "#126b59",
  "#426ca9",
  "#aa6419",
  "#8c54a0",
  "#b53e50",
  "#247f91",
  "#627b2d",
  "#774c3b",
  "#5b6585",
  "#9b4775",
];
export const METRICS = {
  selectionBasisM: "Margin basis before section rounding · m",
  selectedMarginM: "Profile-rounded sample margin · m (diagnostic)",
  protectedM: "Protected first-arrest distance · m",
  distanceM: "Raw first-arrest travel · m",
};
export function lineStyle(i) {
  return `stroke="${PALETTE[i % PALETTE.length]}" stroke-dasharray="${["none", "7 3", "2 3"][Math.floor(i / PALETTE.length)] || "9 3 2 3"}"`;
}
const fmt = (x) => Number(x).toLocaleString("en", { maximumFractionDigits: 1 });
function labelText(s) {
  let units = 0,
    out = "";
  for (const c of String(s).replace(/\s+/g, " ")) {
    units += c.codePointAt(0) > 255 ? 2 : 1;
    if (units > 62) return out + "…";
    out += c;
  }
  return out;
}
const memberLegend = (result, m) => ({
  label:
    m.name +
    " · " +
    result.workspace.profiles.find((p) => p.id === m.profileId).name +
    (m.probe.status !== "computed" ? " [" + m.probe.status + "]" : ""),
});
const svgFrame = (title, body, identity, legend = []) => {
  const height = legend.length ? 360 + Math.ceil(legend.length / 2) * 28 : 330;
  const keys = legend
    .map((item, i) => {
      const x = 65 + (i % 2) * 415,
        y = 355 + Math.floor(i / 2) * 28,
        style = item.black ? 'stroke="#1a302a"' : lineStyle(i);
      return `<g><title>${esc(item.label)}</title><line x1="${x}" x2="${x + 20}" y1="${y - 4}" y2="${y - 4}" ${style} stroke-width="3"/><text x="${x + 27}" y="${y}" style="font-size:11px">${esc(labelText(item.label))}</text></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" role="img" aria-label="${esc(title)}" style="font:12px system-ui;fill:#566e5b"><metadata>${esc(JSON.stringify({ ...identity, legend: legend.map((x) => x.label) }))}</metadata><rect width="900" height="${height}" fill="white"/>${body}${keys}</svg>`;
};
function axes(maxX, maxY, xLabel, yLabel, minX = 0) {
  const x = (d) => 65 + ((d - minX) / (maxX - minX || 1)) * 805,
    y = (v) => 275 - (v / (maxY || 1)) * 240;
  const body =
    Array.from({ length: 5 }, (_, i) => {
      const value = (maxY * i) / 4;
      return `<line x1="65" x2="870" y1="${y(value)}" y2="${y(value)}" stroke="#e1e7e2"/><text x="55" y="${y(value) + 4}" text-anchor="end">${fmt(value)}</text>`;
    }).join("") +
    Array.from({ length: 6 }, (_, i) => {
      const value = minX + ((maxX - minX) * i) / 5;
      return `<text x="${x(value)}" y="298" text-anchor="middle">${fmt(value)}</text>`;
    }).join("") +
    `<text x="65" y="18">${esc(yLabel)}</text><text x="870" y="325" text-anchor="end">${esc(xLabel)}</text>`;
  return { x, y, body };
}
export function trajectoryOverlaySVG(result, group) {
  const frame = (title, body) =>
    svgFrame(
      title,
      body,
      {
        engine: result.engine,
        inputDigest: result.inputDigest,
        generatedAt: result.generatedAt,
        groupId: group.id,
        algorithm: group.algorithm??"rk4",
        probe: result.workspace.probe,
        quantity: "attained_speed_vs_nose_travel",
      },
      members.map((m) => memberLegend(result, m)),
    );
  const members = result.members.filter((m) =>
    group.alternativeIds.includes(m.id),
  );
  const valid = members.filter((m) => m.probe.points?.length);
  if (!valid.length)
    return frame(
      "No applicable common-entry trajectories",
      '<text x="65" y="145">No common-entry trajectory available. Inspect the failed and inapplicable entries.</text>',
    );
  const maxX = Math.max(...valid.map((m) => m.probe.distanceM)) * 1.05 || 1,
    maxY = Math.max(...valid.map((m) => m.probe.peakKph)) * 1.1 || 1,
    { x, y, body } = axes(
      maxX,
      maxY,
      "Nose travel from common failure entry · m",
      "Attained speed · km/h",
    );
  return frame(
    `Common-entry mixed-fleet trajectories at ${result.workspace.probe.startM} m / ${result.workspace.probe.speedKph} km/h; ${group.routeName}`,
    body +
      members
        .map((m, i) => {
          if (!m.probe.points) return "";
          const path = m.probe.points
            .map((p, k) => `${k ? "L" : "M"}${x(p.d)},${y(p.v)}`)
            .join(" ");
          return `<path d="${path}" fill="none" ${lineStyle(i)} stroke-width="2.5"/><circle cx="${x(m.probe.distanceM)}" cy="${y(0)}" r="4" fill="${PALETTE[i % PALETTE.length]}"/>`;
        })
        .join(""),
  );
}
export function envelopeSVG(result, group, metric = "selectionBasisM") {
  const frame = (title, body) =>
    svgFrame(
      title,
      body,
      {
        engine: result.engine,
        inputDigest: result.inputDigest,
        generatedAt: result.generatedAt,
        groupId: group.id,
        algorithm: group.algorithm??"rk4",
        quantity: metric,
      },
      [
        ...members.map((m) => memberLegend(result, m)),
        { label: "Fleet maximum at sampled entries", black: true },
      ],
    );
  const members = result.members.filter((m) =>
      group.alternativeIds.includes(m.id),
    ),
    starts = [...new Set(group.rows.map((r) => r.startM))].sort(
      (a, b) => a - b,
    ),
    memberKey = {
      selectionBasisM: "selectionBasisM",
      selectedMarginM: "selectedM",
      protectedM: "protectedM",
      distanceM: "distanceM",
    }[metric];
  const series = members.map((m, i) => ({
    i,
    values: starts.map((start) => {
      const rows = m.rows.filter((r) => r.startM === start);
      const valid = rows.filter((r) => Number.isFinite(r[memberKey]));
      return {
        start,
        value:
          rows.some((r) => r.status === "failed") || !valid.length
            ? null
            : Math.max(...valid.map((r) => r[memberKey])),
      };
    }),
  }));
  const envelope = starts.map((start) => {
    const rows = group.rows.filter((r) => r.startM === start),
      valid = rows.filter((r) => Number.isFinite(r[metric]));
    return {
      start,
      value:
        rows.some((r) => r.status === "incomplete") || !valid.length
          ? null
          : Math.max(...valid.map((r) => r[metric])),
    };
  });
  const maxY =
      Math.max(
        1,
        ...series.flatMap((s) => s.values.map((r) => r.value ?? 0)),
        ...envelope.map((r) => r.value ?? 0),
      ) * 1.1,
    { x, y, body } = axes(
      starts.at(-1) === starts[0] ? starts[0] + 1 : starts.at(-1),
      maxY,
      "Entry chainage · m",
      METRICS[metric],
      starts[0],
    );
  const path = (values) => {
    let pen = false,
      previous = null;
    const sections = result.workspace.allocations.filter(
      (s) =>
        s.enabled &&
        s.routeId === group.routeId &&
        s.direction === group.direction,
    );
    return values
      .map((r) => {
        if (r.value === null) {
          pen = false;
          return "";
        }
        const connected =
          previous !== null &&
          sections.some((s) => previous >= s.fromM && r.start <= s.toM);
        const part = `${pen && connected ? "L" : "M"}${x(r.start)},${y(r.value)}`;
        pen = true;
        previous = r.start;
        return part;
      })
      .join(" ");
  };
  return frame(
    "Sampled mixed-fleet " + METRICS[metric] + "; failed samples leave gaps",
    body +
      series
        .map(
          (s) =>
            `<path d="${path(s.values)}" fill="none" ${lineStyle(s.i)} stroke-width="1.7" opacity=".7"/>`,
        )
        .join("") +
      `<path d="${path(envelope)}" fill="none" stroke="#1a302a" stroke-width="3"/>` +
      envelope
        .filter((r) => r.value !== null)
        .map(
          (r) =>
            `<circle cx="${x(r.start)}" cy="${y(r.value)}" r="3" fill="#1a302a"/>`,
        )
        .join(""),
  );
}

export function compatibleRouteGroups(result, group) {
  return result.groups.filter(
    (g) =>
      g.datum === group.datum &&
      g.direction === group.direction &&
      g.method === group.method && (g.algorithm??"rk4") === (group.algorithm??"rk4"),
  );
}
export function routeVariantSVG(result, groups, metric = "selectionBasisM") {
  const frame = (title, body) =>
    svgFrame(
      title,
      body,
      {
        engine: result.engine,
        inputDigest: result.inputDigest,
        generatedAt: result.generatedAt,
        groups: groups.map((g) => g.id),
        quantity: metric,
      },
      groups.map((g) => ({ label: g.routeName })),
    );
  const series = groups.map((g) => ({
    group: g,
    values: [...new Set(g.rows.map((r) => r.startM))]
      .sort((a, b) => a - b)
      .map((start) => {
        const rows = g.rows.filter((r) => r.startM === start),
          valid = rows.filter((r) => Number.isFinite(r[metric]));
        return {
          start,
          value:
            rows.some((r) => r.status === "incomplete") || !valid.length
              ? null
              : Math.max(...valid.map((r) => r[metric])),
        };
      }),
  }));
  const all = series.flatMap((s) => s.values),
    lo = Math.min(...all.map((x) => x.start)),
    hi = Math.max(...all.map((x) => x.start)),
    maxY = Math.max(1, ...all.map((x) => x.value ?? 0)) * 1.1,
    { x, y, body } = axes(
      hi === lo ? lo + 1 : hi,
      maxY,
      "Entry chainage in shared declared datum · m",
      METRICS[metric],
      lo,
    );
  return frame(
    "Separate route-variant envelopes; no combined route allocation",
    body +
      series
        .map((s, i) => {
          const sections = result.workspace.allocations.filter(
            (a) =>
              a.enabled &&
              a.routeId === s.group.routeId &&
              a.direction === s.group.direction,
          );
          let previous = null;
          const path = s.values
            .map((p) => {
              if (p.value === null) {
                previous = null;
                return "";
              }
              const connected =
                previous !== null &&
                sections.some((a) => previous >= a.fromM && p.start <= a.toM);
              previous = p.start;
              return `${connected ? "L" : "M"}${x(p.start)},${y(p.value)}`;
            })
            .join(" ");
          return (
            `<path d="${path}" fill="none" ${lineStyle(i)} stroke-width="2.5"/>` +
            s.values
              .filter((p) => p.value !== null)
              .map(
                (p) =>
                  `<circle cx="${x(p.start)}" cy="${y(p.value)}" r="2.5" fill="${PALETTE[i % PALETTE.length]}"/>`,
              )
              .join("")
          );
        })
        .join(""),
  );
}
