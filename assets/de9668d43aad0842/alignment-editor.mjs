import { parseCSVRows } from "./engine.mjs";
export const ALIGNMENT_COLUMNS = [
  "from_m",
  "to_m",
  "gradient_permille",
  "speed_kph",
];
export function alignmentDraftRows(text) {
  const rows = parseCSVRows(text),
    header = rows.shift()?.map((x) => x.toLowerCase());
  if (
    header?.length !== 4 ||
    new Set(header).size !== 4 ||
    !ALIGNMENT_COLUMNS.every((x) => header.includes(x)) ||
    rows.some((x) => x.length !== 4)
  )
    throw Error(
      "Use the CSV editor to correct the header or row structure before editing cells.",
    );
  return rows.map((row) =>
    ALIGNMENT_COLUMNS.map((name) => row[header.indexOf(name)]),
  );
}
export function alignmentRowsCSV(rows) {
  return [ALIGNMENT_COLUMNS, ...rows]
    .map((row) =>
      row.map((x) => '"' + String(x).replaceAll('"', '""') + '"').join(","),
    )
    .join("\n");
}
