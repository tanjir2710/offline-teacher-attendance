/** Runs only after explicit activeTab access on the DIU attendance-entry page.
 * No credential, OTP, cookie or token fields are read. Unknown forms fail closed.
 */
export async function attendancePage(job,action='inspect',expectedContext=null){
 if(location.origin!=='https://teacherportal.diu.edu.bd'||!location.pathname.startsWith('/student-attendance-entry'))throw Error('Open DIU Student Attendance Entry after completing SSO and OTP.');
 const visible=el=>!!(el.getClientRects().length)&&!el.hidden;
 if(document.querySelector('input[type=password],input[autocomplete="one-time-code"]'))throw Error('Complete DIU sign-in yourself before using the helper.');
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
 const semantic=s=>{s=norm(s);return ['present','p','yes','y'].includes(s)?true:['absent','a','no','n'].includes(s)?false:null};
 const label=input=>{
  const labels=[...(input.labels||[])].map(l=>l.textContent).join(' ');const aria=input.getAttribute('aria-label');if(aria)return aria;if(labels)return labels;
  const cell=input.closest('td'),table=input.closest('table');if(cell&&table){const head=table.querySelector('thead tr')||table.querySelector('tr');return head?.children[cell.cellIndex]?.textContent||''}return '';
 };
 const byId=new Map(job.students.map(s=>[s.id.toUpperCase(),s]));
 const candidates=[];
 for(const table of document.querySelectorAll('table')){
  if(!visible(table))continue;const found=new Map();let duplicate=false,unknown=false;
  for(const row of table.querySelectorAll('tbody tr,tr')){
   if(!visible(row))continue;
   const cells=[...row.querySelectorAll('td')];if(!cells.length)continue;
   const texts=cells.map(c=>c.textContent.trim().replace(/\s+/g,''));const matches=texts.filter(t=>byId.has(t.toUpperCase()));
   if(matches.length>1){duplicate=true;continue}
   if(!matches.length){if(texts.some(t=>/^\d{2,4}-\d{2,4}-\d{2,8}$/.test(t)))unknown=true;continue}
   const id=matches[0].toUpperCase();if(found.has(id)){duplicate=true;continue}found.set(id,row);
  }
  if(found.size)candidates.push({table,found,duplicate,unknown});
 }
 if(candidates.length!==1)throw Error('The student table could not be identified uniquely. Load the complete attendance roster first.');
 const {table,found,duplicate,unknown}=candidates[0];
 if(duplicate||unknown||found.size!==job.students.length||job.students.some(s=>!found.has(s.id.toUpperCase())))throw Error('The portal and saved roster do not match exactly, or not all rows are loaded. Nothing was filled.');
 const context=JSON.stringify([...document.querySelectorAll('select,input[type=date]')].filter(e=>visible(e)&&!table.contains(e)).map(e=>({name:e.name||e.id||'',value:e.value,text:e.tagName==='SELECT'?e.selectedOptions[0]?.textContent:''})));
 if(expectedContext!==null&&context!==expectedContext)throw Error('Course, section, semester or date changed. Check the roster again.');
 const dates=[...document.querySelectorAll('input[type=date]')].filter(e=>visible(e)&&!table.contains(e)&&e.value);if(dates.some(e=>e.value!==job.date))throw Error('The DIU attendance date does not match the saved date.');
 const changes=[];
 for(const student of job.students){
  const row=found.get(student.id.toUpperCase());const controls=[...row.querySelectorAll('input,select')].filter(e=>visible(e)&&!e.disabled);
  const selects=controls.filter(e=>e.tagName==='SELECT');const radios=controls.filter(e=>e.type==='radio');const checks=controls.filter(e=>e.type==='checkbox');let change;
  if(selects.length===1&&!radios.length&&!checks.length){const select=selects[0];const yes=[...select.options].filter(o=>semantic(o.textContent)===true),no=[...select.options].filter(o=>semantic(o.textContent)===false);if(yes.length===1&&no.length===1){const opt=student.present?yes[0]:no[0];change={input:select,value:opt.value,kind:'select'}}}
  else if(radios.length===2&&!selects.length&&!checks.length){const matches=radios.filter(r=>semantic(label(r))===student.present);if(matches.length===1)change={input:matches[0],kind:'radio'}}
  else if(checks.length===1&&!selects.length&&!radios.length){const means=semantic(label(checks[0]));if(means!==null)change={input:checks[0],value:student.present===means,kind:'checkbox'}}
  if(!change)throw Error('Unrecognized attendance controls for '+student.id+'. No changes were made. A DIU-specific adapter is needed.');
  changes.push(change);
 }
 const summarize=()=>({context,matched:changes.length,present:job.students.filter(s=>s.present).length,absent:job.students.filter(s=>!s.present).length});
 const check=()=>changes.every(c=>c.input.isConnected&&(c.kind==='select'?c.input.value===c.value:c.kind==='radio'?c.input.checked:c.input.checked===c.value));
 if(action==='inspect')return summarize();
 if(action==='fill'){
  for(const c of changes){if(c.kind==='select'){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(c.input,c.value);c.input.dispatchEvent(new Event('input',{bubbles:true}));c.input.dispatchEvent(new Event('change',{bubbles:true}))}else if(c.kind==='radio'){if(!c.input.checked)c.input.click()}else if(c.input.checked!==c.value)c.input.click()}
  await new Promise(r=>setTimeout(r,350));if(!check())throw Error('The portal did not retain every attendance value. Review the page manually; submission is blocked.');return{...summarize(),filled:true};
 }
 if(action==='submit'){
  if(!check())throw Error('Attendance values changed after review. Fill and review again.');
  const scope=table.closest('form')||document;
  const submits=[...scope.querySelectorAll('button,input[type=submit]')].filter(e=>visible(e)&&!e.disabled&&/^(submit attendance|save attendance|submit|save)$/i.test((e.tagName==='INPUT'?e.value:e.textContent).trim()));
  if(submits.length!==1)throw Error('Could not identify one attendance-submit button. Submit manually on DIU after checking the values.');
  if(submits[0].closest('form')?.checkValidity()===false)throw Error('Complete required DIU fields before submitting.');
  // Explicit teacher confirmation in the popup precedes this final click.
  submits[0].click();return{...summarize(),submissionSent:true,verified:false};
 }
 throw Error('Unknown operation.');
}
