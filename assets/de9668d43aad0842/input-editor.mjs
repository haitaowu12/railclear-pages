import { ALGORITHMS } from './algorithms.mjs';
import { validateWorkspace, newId } from './workspace.mjs';
import { esc } from './exports.mjs';

const number = (key, label, unit, min, max, optional = false) => ({ key, label, unit, min, max, type: 'number', optional });
const text = (key, label, optional = false, max = 200) => ({ key, label, optional, max, type: ['evidence','basis'].includes(key) ? 'textarea' : 'text' });
export const INPUT_EDITORS = {
  vehicle: { title: 'Vehicle sheet', groups: [
    ['Identity & source', [text('name', 'Vehicle name'), text('evidence', 'Source, revision & conditions', true, 10000)]],
    ['Formation', [number('lengthM','Train length','m',1,2000),number('massT','Static mass · record only','t',1,30000),number('maxSpeedKph','Maximum commanded speed','km/h',1,400)]],
    ['Effective level-track rates', [number('tractionA','Runaway traction acceleration','m/s²',0,3),number('brakeA','Emergency deceleration','m/s²',.01,3),number('serviceA','Ideal service reference deceleration','m/s²',.01,3)]],
  ]},
  profile: { title: 'Operating profile', groups: [
    ['Identity & direction', [text('name','Operating profile name'),{key:'direction',label:'Travel direction',type:'select', options:[[1,'Increasing chainage →'],[-1,'← Decreasing chainage']]}]],
    ['Failure timing', [number('reactionS','Detection & command latency','s',0,30),number('tractionDisableS','Propulsion disable after command','s',0,30),number('brakeDelayS','Brake onset after command','s',0,30),number('buildUpS','Linear brake build-up','s',0,30)]],
    ['Speed & clearance allowances', [number('overspeedKph','Overspeed allowance','km/h',0,30),number('speedErrorKph','Speed measurement error','km/h',0,30),number('frontErrorM','Following front uncertainty','m',0,1000),number('rearErrorM','Leading rear uncertainty','m',0,1000),number('rollbackM','Leading rollback clearance','m',0,1000),number('extraM','Additional stand-off','m',0,1000)]],
    ['Calculation algorithm', [{key:'algorithm',label:'Calculation algorithm',type:'select',options:Object.entries(ALGORITHMS).map(([id,a])=>[id,a.name+(a.status==='definition'?' · definition only':'')])}]],
    ['Reference & numerical method', [{key:'method',label:'Grade model',type:'select',options:[['trajectory','Alignment · finite train'],['constant','Constant-grade reference']]},number('constantGradePermille','Reference grade','‰',-100,100),number('roundM','Single-study selection increment','m',.001,100),number('dtS','Maximum integration step','s',.01,.5),number('toleranceM','Refinement distance tolerance','m',.0001,1),number('maxTimeS','Stopping time limit','s',1,1200),number('obstacleM','Single-study fixed obstacle','m',-1e8,1e8,true)]],
  ]},
  sampling: { title: 'Sampling & overlay', groups: [
    ['Common calculation grid', [number('spacingM','Chainage spacing','m',1,100000),{key:'speedsKph',label:'Commanded speed samples · km/h',type:'speeds'}]],
    ['Common-entry overlay', [number('startM','Overlay entry chainage','m',-1e8,1e8),number('speedKph','Overlay commanded speed','km/h',0,400)]],
  ]},
  project: { title: 'Project record', groups: [['Calculation identity', [text('name','Project name'),text('revision','Document revision',true,10000),text('author','Prepared by',true,10000),text('basis','Calculation basis & source references',true,10000)]]]},
  route: { title: 'Route identity', groups: [['Coordinate reference', [text('name','Route profile name'),text('datum','Route chainage datum',false,1000)]]]},
};
const fields = kind => INPUT_EDITORS[kind].groups.flatMap(([, list]) => list);
function asset(w, kind) {
  const a = w.alternatives.find(a => a.id === w.activeStudyId);
  if (kind === 'vehicle') return w.vehicles.find(v => v.id === a.vehicleId).spec;
  if (kind === 'profile') { const profile = w.profiles.find(p => p.id === a.profileId); return { ...profile.scenario, algorithm:profile.scenario.algorithm??'rk4', name: profile.name }; }
  if (kind === 'sampling') return { spacingM: w.study.spacingM, speedsKph: w.study.speedsKph, ...w.probe };
  if (kind === 'route') return w.routes.find(r => r.id === a.routeId);
  return w;
}
export function inputValues(w, kind) {
  const record = asset(w,kind);
  const values = Object.fromEntries(fields(kind).map(f => [f.key, f.type === 'speeds' ? record[f.key].join(', ') : String(record[f.key] ?? '')]));
  if (kind === 'vehicle') for (const key of ['brakeCurve','tractionCurve']) values[key] = (record[key] || []).map(point => point.map(String));
  return values;
}
export function inputUsers(w, kind) {
  const a = w.alternatives.find(a => a.id === w.activeStudyId), key = {vehicle:'vehicleId',profile:'profileId',route:'routeId'}[kind];
  return key ? w.alternatives.filter(item => item[key] === a[key]).map(item => item.name) : [];
}
export function prepareInputEdit(current, original, kind, values, { separate = false } = {}) {
  if (JSON.stringify(current) !== JSON.stringify(original)) return { errors: { form: 'The workspace changed while this editor was open. Cancel and reopen it to review the current inputs.' } };
  const errors = {}, parsed = {};
  for (const f of fields(kind)) {
    const value = String(values[f.key] ?? '');
    if (f.type === 'number') {
      if (f.optional && !value.trim()) parsed[f.key] = null;
      else if (!value.trim() || !Number.isFinite(Number(value)) || Number(value)<f.min || Number(value)>f.max) errors[f.key] = `Enter a number from ${f.min} to ${f.max}${f.unit ? ` ${f.unit}` : ''}.`;
      else parsed[f.key] = Number(value);
    } else if (f.type === 'speeds') {
      const parts = value.split(',');
      if (parts.length>40 || parts.some(x => !x.trim() || !Number.isFinite(Number(x)) || Number(x)<0 || Number(x)>400)) errors[f.key]='Enter 1–40 comma-separated speeds from 0 to 400 km/h; no empty entries.';
      else parsed[f.key] = parts.map(Number);
    } else if (f.type === 'select') {
      const match = f.options.find(([v]) => String(v) === value);
      if (!match) errors[f.key] = 'Select an available option.'; else parsed[f.key]=match[0];
    } else if ((!f.optional && !value.trim()) || value.length>f.max) errors[f.key]=`Enter ${f.label.toLowerCase()} (up to ${f.max} characters).`;
    else parsed[f.key]=value;
  }
  if (kind === 'vehicle') for (const key of ['brakeCurve','tractionCurve']) {
    const rows=values[key];
    if (!Array.isArray(rows) || rows.length>1000) { errors[key]='Use at most 1,000 speed points.'; continue; }
    parsed[key]=[];
    for (let i=0;i<rows.length;i++) {
      const row=rows[i];
      if (!Array.isArray(row)||row.length!==2||row.some(v=>String(v).trim()===''||!Number.isFinite(Number(v)))) {errors[key]=`Point ${i+1}: enter both speed and acceleration.`;break;}
      const [speed,rate]=row.map(Number);
      if (speed<0||speed>500||rate<(key==='brakeCurve'?.0001:0)||rate>5) {errors[key]=`Point ${i+1}: speed must be 0–500 km/h and acceleration ${key==='brakeCurve'?'0.0001':'0'}–5 m/s².`;break;}
      if (i && speed<=parsed[key][i-1][0]) {errors[key]=`Point ${i+1}: speed must exceed the previous point.`;break;}
      parsed[key].push([speed,rate]);
    }
  }
  if (Object.keys(errors).length) return {errors};
  const candidate=structuredClone(current), a=candidate.alternatives.find(a=>a.id===candidate.activeStudyId);
  if (kind==='vehicle') {
    let v=candidate.vehicles.find(v=>v.id===a.vehicleId);
    if (separate) { v=structuredClone(v);v.id=newId('vehicle');candidate.vehicles.push(v);a.vehicleId=v.id; }
    v.spec={...v.spec,...parsed,id:'custom',status:'User modified — unverified'};
  } else if (kind==='profile') {
    let profile=candidate.profiles.find(p=>p.id===a.profileId);
    if (separate) { profile=structuredClone(profile);profile.id=newId('profile');candidate.profiles.push(profile);a.profileId=profile.id; }
    const {name,...scenario}=parsed;profile.name=name;profile.scenario={...profile.scenario,...scenario};
  } else if (kind==='sampling') {
    candidate.study.spacingM=parsed.spacingM;candidate.study.speedsKph=parsed.speedsKph;candidate.probe={startM:parsed.startM,speedKph:parsed.speedKph};
  } else if (kind==='route') Object.assign(candidate.routes.find(r=>r.id===a.routeId),parsed);
  else Object.assign(candidate,parsed);
  try { validateWorkspace(candidate); } catch (error) { return {errors:{form:error.message}}; }
  return {candidate, errors:{}};
}

export function openInputEditor({getWorkspace,kind,onApply,returnFocus}) {
  const original=structuredClone(getWorkspace()), initial=inputValues(original,kind), definition=INPUT_EDITORS[kind];
  const dialog=document.createElement('dialog');dialog.className='section-drawer input-drawer';dialog.setAttribute('aria-labelledby','input-editor-title');
  const users=inputUsers(original,kind), canSeparate=['vehicle','profile'].includes(kind);
  const control=f=>`<label class="editor-field"><span>${esc(f.label)}${f.optional?'<span class="optional">Optional</span>':''}</span>${f.type==='select'?`<select name="${f.key}" aria-label="${esc(f.label)}" aria-describedby="input-${f.key}-error">${f.options.map(([value,label])=>`<option value="${value}" ${String(value)===initial[f.key]?'selected':''}>${esc(label)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea rows="4" name="${f.key}" aria-label="${esc(f.label)}" aria-describedby="input-${f.key}-error">${esc(initial[f.key])}</textarea>`:`<span class="editor-control"><input name="${f.key}" aria-label="${esc(f.label)}" value="${esc(initial[f.key])}" type="${f.type==='number'?'number':'text'}" ${f.type==='number'?'step="any"':''} aria-describedby="input-${f.key}-error">${f.unit?`<span class="input-suffix">${esc(f.unit)}</span>`:''}</span>`}<span class="field-error" id="input-${f.key}-error" hidden></span></label>`;
  const curveRow=(key,row,i)=>`<tr><td><input type="number" step="any" aria-label="${key==='brakeCurve'?'Brake':'Traction'} speed ${i+1} · km/h" value="${esc(row[0])}"></td><td><input type="number" step="any" aria-label="${key==='brakeCurve'?'Brake':'Traction'} acceleration ${i+1} · m/s²" value="${esc(row[1])}"></td><td><button type="button" data-remove-point aria-label="Remove ${key==='brakeCurve'?'brake':'traction'} point ${i+1}">Remove</button></td></tr>`;
  const curveBlock=(key,label)=>`<fieldset class="curve-editor" data-curve="${key}"><legend>${label}</legend><p class="field-hint">Empty uses the constant rate. Otherwise cover all attained speeds in increasing order; no extrapolation.</p><table><thead><tr><th>Speed · km/h</th><th>Rate · m/s²</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${initial[key].map((row,i)=>curveRow(key,row,i)).join('')}</tbody></table><span class="field-error" id="input-${key}-error" role="status" hidden></span><button type="button" data-add-point="${key}">Add ${key==='brakeCurve'?'brake':'traction'} point</button></fieldset>`;
  dialog.innerHTML=`<form class="section-edit-form" novalidate><header class="drawer-header"><div><p>Applied inputs remain unchanged until you apply</p><h2 id="input-editor-title">${definition.title}</h2></div><button type="button" class="icon-button drawer-close" aria-label="Close input editor">✕</button></header><div class="drawer-body"><div class="drawer-form-error" role="alert" tabindex="-1" hidden></div>${users.length?`<div class="shared-input-note"><strong>Used by ${users.length} alternative${users.length===1?'':'s'}</strong><p>${users.map(esc).join(' · ')}</p>${canSeparate?'<label class="separate-option"><input type="checkbox" name="separate"> Create a separate copy for the active alternative</label>':''}</div>`:''}${definition.groups.map(([name,list])=>`<fieldset><legend>${name}</legend>${list.map(control).join('')}</fieldset>`).join('')}${kind==='vehicle'?`<p class="field-hint">Effective rates already represent load, adhesion and equipment condition. Mass is recorded, not used to rescale rates. Source edits do not establish acceptance.</p>${curveBlock('brakeCurve','Emergency brake curve')}${curveBlock('tractionCurve','Traction acceleration curve')}`:''}${kind==='profile'?'<p class="field-hint">Both delays start at the command. Propulsion and braking may overlap. Section quantities, rounding and protected points are set separately in the allocation register.</p>':''}</div><footer class="drawer-footer"><div class="discard-prompt" hidden><p>Discard your unapplied changes?</p><button type="button" class="keep-editing">Keep editing</button><button type="button" class="discard-changes">Discard changes</button></div><div class="drawer-actions"><button type="submit" class="primary">Apply changes</button><button type="button" class="cancel-edit">Cancel</button><span class="draft-state">No changes</span></div></footer></form>`;
  const form=dialog.querySelector('form');
  const read=()=>{
    const values=Object.fromEntries(fields(kind).map(f=>[f.key,form.elements.namedItem(f.key).value]));
    if(kind==='vehicle') for(const key of ['brakeCurve','tractionCurve']) values[key]=[...dialog.querySelectorAll(`[data-curve="${key}"] tbody tr`)].map(row=>[...row.querySelectorAll('input')].map(input=>input.value));
    return values;
  };
  const separate=()=>!!form.elements.namedItem('separate')?.checked;
  const dirty=()=>separate()||JSON.stringify(read())!==JSON.stringify(initial);
  const update=()=>{dialog.querySelector('.draft-state').textContent=dirty()?'Unapplied changes':'No changes';form.querySelector('[type="submit"]').disabled=!dirty();};
  const paint=errors=>{
    for(const key of [...fields(kind).map(f=>f.key),...(kind==='vehicle'?['brakeCurve','tractionCurve']:[])]) {
      const message=dialog.querySelector(`#input-${key}-error`);message.textContent=errors[key]||'';message.hidden=!errors[key];
      const controls=form.elements.namedItem(key)?[form.elements.namedItem(key)]:[...dialog.querySelectorAll(`[data-curve="${key}"] input`)];
      for(const control of controls){control.setAttribute('aria-invalid',String(!!errors[key]));control.setAttribute('aria-describedby',`input-${key}-error`);}
    }
    const summary=dialog.querySelector('.drawer-form-error');summary.textContent=errors.form||'';summary.hidden=!errors.form;
  };
  form.oninput=update;form.onchange=update;
  form.addEventListener('click',event=>{
    const add=event.target.closest('[data-add-point]'),remove=event.target.closest('[data-remove-point]');
    if(add){const key=add.dataset.addPoint,tbody=dialog.querySelector(`[data-curve="${key}"] tbody`);if(tbody.rows.length>=1000)return;tbody.insertAdjacentHTML('beforeend',curveRow(key,['',''],tbody.rows.length));tbody.lastElementChild.querySelector('input').focus();update();}
    if(remove){const group=remove.closest('[data-curve]');remove.closest('tr').remove();[...group.querySelectorAll('tbody tr')].forEach((row,i)=>{const label=group.dataset.curve==='brakeCurve'?'Brake':'Traction';const inputs=row.querySelectorAll('input');inputs[0].setAttribute('aria-label',`${label} speed ${i+1} · km/h`);inputs[1].setAttribute('aria-label',`${label} acceleration ${i+1} · m/s²`);row.querySelector('button').setAttribute('aria-label',`Remove ${label.toLowerCase()} point ${i+1}`);});group.querySelector('[data-add-point]').focus();update();}
  });
  const close=()=>dialog.close();
  const requestClose=()=>{if(!dirty()){close();return;}dialog.querySelector('.discard-prompt').hidden=false;dialog.querySelector('.drawer-actions').hidden=true;dialog.querySelector('.keep-editing').focus();};
  dialog.querySelector('.drawer-close').onclick=requestClose;
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  dialog.querySelector('.cancel-edit').onclick=close;dialog.querySelector('.discard-changes').onclick=close;
  dialog.querySelector('.keep-editing').onclick=()=>{dialog.querySelector('.discard-prompt').hidden=true;dialog.querySelector('.drawer-actions').hidden=false;form.elements.namedItem(fields(kind)[0].key).focus();};
  const beforeUnload=event=>{if(dirty()){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  dialog.addEventListener('close',()=>{window.removeEventListener('beforeunload',beforeUnload);dialog.remove();returnFocus?.()?.focus({preventScroll:true});},{once:true});
  form.onsubmit=event=>{
    event.preventDefault();const prepared=prepareInputEdit(getWorkspace(),original,kind,read(),{separate:separate()});paint(prepared.errors);
    if(Object.keys(prepared.errors).length){const key=Object.keys(prepared.errors)[0];(form.elements.namedItem(key)||dialog.querySelector(`[data-curve="${key}"] input`)||dialog.querySelector('.drawer-form-error')).focus();return;}
    try{onApply(prepared.candidate);dialog.close();}catch(error){paint({form:error.message});dialog.querySelector('.drawer-form-error').focus();}
  };
  document.body.append(dialog);update();dialog.showModal();form.elements.namedItem(fields(kind)[0].key).focus();return dialog;
}
