import { parseCSVRows, chainage, InputError } from "./engine.mjs";
import { validateWorkspace } from "./workspace.mjs";
export const SECTION_HEADERS = [
  "id",
  "name",
  "route_id",
  "direction",
  "from_m",
  "to_m",
  "reference_kind",
  "reference_id",
  "protected_point_m",
  "quantity",
  "round_m",
  "enabled",
];
const ENCODING = "railclear-apostrophe-v1";
const textColumns = new Set([
  "id",
  "name",
  "route_id",
  "reference_kind",
  "reference_id",
  "quantity",
]);
const formulaLike = (s) => /^(\s*[=+@-]|[\t\r\n])/u.test(s);
const encode = (s) => (s.startsWith("'") || formulaLike(s) ? "'" + s : s);
const decode = (s) =>
  s.startsWith("''") || (s.startsWith("'") && formulaLike(s.slice(1)))
    ? s.slice(1)
    : s;
// The version column distinguishes encoded output from user-authored plain CSV.
// Leading apostrophes and formula-like text round trip without guessing intent.
const cell = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
const number = (s, label) => {
  const text = s.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text))
    throw Error(
      label + " must be a numeric value, without km+metres notation.",
    );
  return Number(text);
};
export function sectionsCSV(w) {
  const headers = [...SECTION_HEADERS, "text_encoding"];
  return [
    headers.join(","),
    ...w.allocations.map((a) => {
      const values = [
        a.id,
        a.name,
        a.routeId,
        a.direction,
        a.fromM,
        a.toM,
        a.referenceKind,
        a.referenceId,
        a.protectedPointM,
        a.metric,
        a.roundM,
        a.enabled,
        ENCODING,
      ];
      return values
        .map((x, i) =>
          cell(textColumns.has(headers[i]) ? encode(String(x ?? "")) : x),
        )
        .join(",");
    }),
  ].join("\n");
}
export function parseSectionsCSV(text, w) {
  const rows = parseCSVRows(text, { preserveQuotedWhitespace: true });
  if (rows.length < 2)
    throw new InputError("Section CSV needs headers and at least one section.");
  const headers = rows.shift().map((x) => x.trim().toLowerCase()),
    allowed = [...SECTION_HEADERS, "text_encoding"];
  if (
    new Set(headers).size !== headers.length ||
    !SECTION_HEADERS.every((x) => headers.includes(x)) ||
    headers.some((x) => !allowed.includes(x))
  )
    throw new InputError(
      "Expected section headers: " +
        SECTION_HEADERS.join(", ") +
        ". Optional: text_encoding.",
    );
  const result = rows.map((row, i) => {
    try {
      if (row.length !== headers.length) throw Error("Incorrect column count.");
      const raw = (k) => row[headers.indexOf(k)] ?? "",
        encoding = raw("text_encoding");
      if (encoding !== "" && encoding !== ENCODING)
        throw Error("Unsupported section text encoding.");
      const get = (k) =>
        encoding === ENCODING && textColumns.has(k) ? decode(raw(k)) : raw(k);
      const enabled = get("enabled").trim().toLowerCase();
      if (!["true", "false"].includes(enabled))
        throw Error("enabled must be true or false.");
      return {
        id: get("id"),
        name: get("name"),
        routeId: get("route_id"),
        direction: number(get("direction"), "direction"),
        fromM: chainage(get("from_m")),
        toM: chainage(get("to_m")),
        referenceKind: get("reference_kind"),
        referenceId: get("reference_id"),
        protectedPointM:
          get("protected_point_m").trim() === ""
            ? null
            : chainage(get("protected_point_m")),
        metric: get("quantity"),
        roundM: number(get("round_m"), "round_m"),
        enabled: enabled === "true",
      };
    } catch (ex) {
      throw new InputError(`Section CSV row ${i + 2}: ${ex.message}`);
    }
  });
  validateWorkspace({ ...w, allocations: result });
  return result;
}
