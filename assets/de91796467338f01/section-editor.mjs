import { validateWorkspace } from "./workspace.mjs";
import { esc } from "./exports.mjs";

const numericFields = new Set(["fromM", "toM", "roundM", "protectedPointM"]);
const fields = ["name", "routeId", "direction", "fromM", "toM", "referenceKind", "referenceId", "metric", "roundM", "protectedPointM"];
const fieldForError = [
  [/Allocation section name/, "name"], [/Allocation route/, "routeId"],
  [/Allocation direction/, "direction"], [/Allocation start/, "fromM"],
  [/Allocation end/, "toM"], [/reference type/, "referenceKind"],
  [/Signal\/track-section reference/, "referenceId"], [/allocation quantity/, "metric"],
  [/Allocation selection increment/, "roundM"], [/Protected point/, "protectedPointM"],
];
export function sectionValues(section) {
  return Object.fromEntries(fields.map(key => [key, section[key] == null ? "" : String(section[key])]));
}

// Parse a complete edit into a candidate. The authoritative workspace validator
// checks its meaning; this function never mutates the current study.
export function prepareSectionEdit(workspace, original, values, { create = false } = {}) {
  const errors = {};
  const current = workspace.allocations.find(s => s.id === original.id);
  if ((!create && (!current || JSON.stringify(current) !== JSON.stringify(original))) || (create && current)) {
    return { errors: { form: "This section changed while the editor was open. Cancel and reopen it to use the current record." } };
  }
  const section = { ...original };
  for (const key of fields) {
    const value = String(values[key] ?? "");
    if (key === "protectedPointM" && value.trim() === "") section[key] = null;
    else if (numericFields.has(key) || key === "direction") {
      if (!value.trim() || !Number.isFinite(Number(value))) {
        errors[key] = `Enter ${key === "roundM" ? "a rounding increment" : key === "fromM" ? "a start chainage" : key === "toM" ? "an end chainage" : "a numeric value"}${key === "direction" ? "" : " in metres"}`;
      } else section[key] = Number(value);
    } else {
      section[key] = value;
      if (key === "name" && !value.trim()) errors.name = "Enter a section name";
    }
  }
  if (Object.keys(errors).length) return { errors };
  const candidate = structuredClone(workspace);
  if (create) candidate.allocations.push(section);
  else candidate.allocations[candidate.allocations.findIndex(s => s.id === original.id)] = section;
  try { validateWorkspace(candidate); }
  catch (error) {
    const key = fieldForError.find(([pattern]) => pattern.test(error.message))?.[1] || "form";
    errors[key] = key === "toM" && section.toM < section.fromM
      ? "End chainage must be at or beyond the start chainage"
      : error.message;
    return { errors };
  }
  return { section, errors: {} };
}

export function openSectionEditor({ getWorkspace, section, create = false, onApply, returnFocus }) {
  const original = structuredClone(section), initial = sectionValues(original);
  const dialog = document.createElement("dialog");
  dialog.className = "section-drawer";
  dialog.setAttribute("aria-labelledby", "section-editor-title");
  const input = (key, label, { unit = "", optional = false } = {}) => `<label class="editor-field"><span>${esc(label)}${optional ? '<span class="optional">Optional</span>' : ""}</span><span class="editor-control"><input name="${key}" id="section-${key}" aria-label="${esc(label)}${unit ? ` · ${esc(unit)}` : ""}${optional ? " (optional)" : ""}" value="${esc(initial[key])}" ${numericFields.has(key) ? 'type="number" step="any"' : 'type="text"'} ${!optional ? "required" : ""} aria-describedby="section-${key}-error">${unit ? `<span class="input-suffix">${unit}</span>` : ""}</span><span class="field-error" id="section-${key}-error" aria-live="polite" hidden></span></label>`;
  const select = (key, label, options, help = "") => `<label class="editor-field"><span>${esc(label)}</span><select name="${key}" id="section-${key}" aria-label="${esc(label)}" aria-describedby="section-${key}-error${help ? ` section-${key}-help` : ""}">${options.map(([value, name]) => `<option value="${esc(value)}" ${String(value) === initial[key] ? "selected" : ""}>${esc(name)}</option>`).join("")}</select>${help ? `<span class="field-hint" id="section-${key}-help">${esc(help)}</span>` : ""}<span class="field-error" id="section-${key}-error" aria-live="polite" hidden></span></label>`;
  dialog.innerHTML = `<form class="section-edit-form" novalidate><header class="drawer-header"><div><p>${create ? "New allocation section" : "Allocation section"}</p><h2 id="section-editor-title">${create ? "Add section" : esc(original.name)}</h2></div><button type="button" class="icon-button drawer-close" aria-label="Close section editor"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></header>
  <div class="drawer-body"><div class="drawer-form-error" role="alert" tabindex="-1" hidden></div><fieldset><legend>Identity</legend>${input("name", "Section name")}
  <div class="editor-pair reference-pair">${select("referenceKind", "Reference type", [["signal", "Signal segment"], ["track-section", "CBTC track section"], ["engineering", "Engineering section"]])}${input("referenceId", "Signal / track reference", { optional: true })}</div></fieldset>
  <fieldset><legend>Failure-entry domain</legend>${select("routeId", "Route", getWorkspace().routes.map(r => [r.id, r.name]))}${select("direction", "Travel direction", [[1, "Increasing chainage →"], [-1, "← Decreasing chainage"]])}<div class="editor-pair">${input("fromM", "Start chainage", { unit: "m" })}${input("toM", "End chainage", { unit: "m" })}</div><p class="field-hint">These limits define where failure begins. Braking continues beyond the section end; full train and stopping-path coverage are required.</p></fieldset>
  <fieldset><legend>Allocation</legend>${select("metric", "Quantity", [["selectedMarginM", "Margin beyond ideal service target"], ["protectedM", "Protected first-arrest distance"]], "Margin uses the ideal service reference. Protected distance uses the failure-start nose datum.")}<div class="editor-pair">${input("roundM", "Rounding increment", { unit: "m" })}${input("protectedPointM", "Protected point", { unit: "m", optional: true })}</div><p class="field-hint">A protected point is a separate fixed-hazard chainage. A signal reference alone does not define its location. Shared entries belong to both adjacent sections.</p></fieldset></div>
  <footer class="drawer-footer"><div class="discard-prompt" hidden><p>Discard your unapplied changes?</p><button type="button" class="keep-editing">Keep editing</button><button type="button" class="discard-changes">Discard changes</button></div><div class="drawer-actions"><button type="submit" class="primary">${create ? "Add section" : "Apply changes"}</button><button type="button" class="cancel-edit">Cancel</button><span class="draft-state">No changes</span></div></footer></form>`;
  const form = dialog.querySelector("form");
  const read = () => Object.fromEntries(new FormData(form).entries());
  const dirty = () => { const values = read(); return fields.some(key => String(values[key] ?? "") !== initial[key]); };
  const paintErrors = (errors, only = null) => {
    for (const key of fields) {
      if (only && key !== only) continue;
      const control = form.elements.namedItem(key), message = dialog.querySelector(`#section-${key}-error`);
      control.setAttribute("aria-invalid", String(!!errors[key]));
      message.textContent = errors[key] || "";
      message.hidden = !errors[key];
    }
    if (!only) {
      const summary = dialog.querySelector(".drawer-form-error");
      summary.hidden = !errors.form;
      summary.textContent = errors.form || "";
    }
  };
  const updateDraftState = () => { const changed = dirty(); dialog.querySelector(".draft-state").textContent = changed ? "Unapplied changes" : "No changes"; dialog.querySelector('[type="submit"]').disabled = !create && !changed; };
  form.addEventListener("input", event => {
    updateDraftState();
    if (event.target.getAttribute("aria-invalid") === "true") {
      paintErrors(prepareSectionEdit(getWorkspace(), original, read(), { create }).errors, event.target.name);
    }
  });
  form.addEventListener("change", updateDraftState);
  form.addEventListener("focusout", event => {
    if (fields.includes(event.target.name)) paintErrors(prepareSectionEdit(getWorkspace(), original, read(), { create }).errors, event.target.name);
  });
  const beforeUnload = event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  dialog.addEventListener("close", () => {
    window.removeEventListener('beforeunload', beforeUnload);
    dialog.remove();
    returnFocus?.()?.focus({ preventScroll: true });
  }, { once: true });
  const cancel = () => dialog.close();
  const requestClose = () => {
    if (!dirty()) { cancel(); return; }
    dialog.querySelector(".discard-prompt").hidden = false;
    dialog.querySelector(".drawer-actions").hidden = true;
    dialog.querySelector(".keep-editing").focus();
  };
  dialog.addEventListener("cancel", event => { event.preventDefault(); requestClose(); });
  dialog.querySelector(".drawer-close").onclick = requestClose;
  dialog.querySelector(".cancel-edit").onclick = cancel;
  dialog.querySelector(".discard-changes").onclick = cancel;
  dialog.querySelector(".keep-editing").onclick = () => {
    dialog.querySelector(".discard-prompt").hidden = true;
    dialog.querySelector(".drawer-actions").hidden = false;
    form.elements.namedItem("name").focus();
  };
  form.onsubmit = event => {
    event.preventDefault();
    const prepared = prepareSectionEdit(getWorkspace(), original, read(), { create });
    paintErrors(prepared.errors);
    if (Object.keys(prepared.errors).length) {
      const first = fields.find(key => prepared.errors[key]);
      if (first) form.elements.namedItem(first).focus();
      else dialog.querySelector(".drawer-form-error").focus();
      return;
    }
    try { if (create || JSON.stringify(prepared.section) !== JSON.stringify(original)) onApply(prepared.section, create); dialog.close(); }
    catch (error) { paintErrors({ form: error.message }); dialog.querySelector(".drawer-form-error").focus(); }
  };
  updateDraftState();
  document.body.append(dialog);
  dialog.showModal();
  form.elements.namedItem("name").focus();
  return dialog;
}
