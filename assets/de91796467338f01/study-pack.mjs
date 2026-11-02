import {
  workspaceReportHTML,
  workspaceRegisterCSV,
  allocationCSV,
  continuousBoundsCSV,
  envelopeCSV,
  overlayTraceCSV,
  portableWorkspaceResult,
} from "./workspace-exports.mjs";
const encode = (s) => new TextEncoder().encode(s);
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
// Standard ZIP STORE, UTF-8 filenames. No runtime dependency or external upload.
export function zipFiles(files) {
  const locals = [],
    central = [];
  let offset = 0;
  const header = (length) => {
    const a = new Uint8Array(length);
    return [a, new DataView(a.buffer)];
  };
  for (const [name, text] of files) {
    const n = encode(name),
      data = typeof text === "string" ? encode(text) : text,
      crc = crc32(data);
    if (n.length > 65535 || data.length > 0xffffffff)
      throw Error("Study pack exceeds ZIP limits.");
    const [a, v] = header(30);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint16(12, 33, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, n.length, true);
    locals.push(a, n, data);
    const [b, w] = header(46);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x800, true);
    w.setUint16(14, 33, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, data.length, true);
    w.setUint32(24, data.length, true);
    w.setUint16(28, n.length, true);
    w.setUint32(42, offset, true);
    central.push(b, n);
    offset += a.length + n.length + data.length;
  }
  const size = central.reduce((n, x) => n + x.length, 0),
    [end, v] = header(22);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, files.length, true);
  v.setUint16(10, files.length, true);
  v.setUint32(12, size, true);
  v.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let i = 0;
  for (const b of [...locals, ...central, end]) {
    out.set(b, i);
    i += b.length;
  }
  return out;
}
export function studyPack(r) {
  return zipFiles([
    [
      "README.txt",
      `RailClear study pack\nProject: ${r.workspace.name}\nRevision: ${r.workspace.revision}\nRun: ${r.generatedAt}\nEngine: ${r.engine}\nStatus: ${r.status}\nInput SHA-256: ${r.inputDigest}\n\nStart with report.html. allocations.csv is sampled selection; continuous-bounds.csv is a separate comparison bound and refusal register. Neither is automatic operational approval. No automatic infrastructure transition policy or position-count conversion is applied. workspace.json restores inputs; study.json retains the complete reproducible record and imports require recomputation. All files refer to this same run.\n`,
    ],
    ["report.html", workspaceReportHTML(r)],
    ["workspace.json", JSON.stringify(r.workspace, null, 2)],
    ["study.json", JSON.stringify(portableWorkspaceResult(r), null, 2)],
    ["allocations.csv", allocationCSV(r)],
    ["continuous-bounds.csv", continuousBoundsCSV(r)],
    ["cases.csv", workspaceRegisterCSV(r)],
    ["envelopes.csv", envelopeCSV(r)],
    ["common-entry-traces.csv", overlayTraceCSV(r)],
  ]);
}
