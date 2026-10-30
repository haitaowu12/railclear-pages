import {esc as e} from './exports.mjs';
import {algorithmName} from './algorithms.mjs';
const num=x=>Number.isFinite(x)?x.toLocaleString('en',{maximumFractionDigits:2}):'—';
export function workspaceContext(w,p,{compact=false}={}) {
 const a=w.alternatives.find(x=>x.id===w.activeStudyId);
 const route=w.routes.find(x=>x.id===a.routeId);
 const profile=w.profiles.find(x=>x.id===a.profileId);
 return `<aside class="context-region" aria-label="Study inputs"><details class="context-details" ${compact?'':'open'}><summary>Inputs</summary><div class="context-body">
 <label class="context-alternative">Editing alternative<select data-active-study aria-label="Active alternative">${w.alternatives.map(x=>`<option value="${e(x.id)}" ${x.id===a.id?'selected':''}>${e(x.name)}</option>`).join('')}</select></label>
 <section class="context-section"><header><h2>Vehicle</h2><button data-input-editor="vehicle">Edit vehicle</button></header><strong>${e(p.vehicle.name)}</strong><dl><div><dt>Emergency brake</dt><dd>${num(p.vehicle.brakeA)} m/s²</dd></div><div><dt>Train length</dt><dd>${num(p.vehicle.lengthM)} m</dd></div><div><dt>Maximum speed</dt><dd>${num(p.vehicle.maxSpeedKph)} km/h</dd></div></dl></section>
 <section class="context-section"><header><h2>Failure profile</h2><button data-input-editor="profile">Edit profile</button></header><strong>${e(profile.name)}</strong><dl><div><dt>Reaction</dt><dd>${num(p.scenario.reactionS)} s</dd></div><div><dt>Brake build-up</dt><dd>${num(p.scenario.buildUpS)} s</dd></div><div><dt>Direction</dt><dd>${p.scenario.direction===1?'Increasing':'Decreasing'}</dd></div></dl></section>
 <section class="context-section"><header><h2>Alignment</h2><button data-nav="alignment">Edit alignment</button></header><strong>${e(route.name)}</strong><p>${num(p.alignment[0].fromM)}–${num(p.alignment.at(-1).toM)} m · ${p.alignment.length} segments</p></section>
 <section class="context-section"><header><h2>Method</h2><button data-nav="method">Change method</button></header><strong>${e(algorithmName(p))}</strong><p>${p.scenario.method==='constant'?'Constant gradient':'Finite-train gradient'}</p></section>
 <a href="#inputs" data-nav="inputs" class="all-inputs-link">All input records</a></div></details></aside>`;
}
