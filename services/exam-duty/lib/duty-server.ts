import { env } from 'cloudflare:workers';
import roster from '../data/roster.json';
import { calendar,validateExchange,dutyStart } from './duty-core';
const encoder=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
export const digest=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function passwordHash(p:string,s:string){const k=await crypto.subtle.importKey('raw',encoder.encode(p),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(s),iterations:100000},k,256))}
function db(){if(!env.DB)throw new Error('Database is not configured.');return env.DB}
function json(d:any,status=200,extra:any={}){return Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}})}
function fail(s:string,status=400):never{throw Object.assign(new Error(s),{status})}
async function seed(){const D=db();if(await D.prepare("SELECT value FROM settings WHERE key='roster-v1'").first())return;for(let i=0;i<roster.duties.length;i+=80){await D.batch(roster.duties.slice(i,i+80).map(d=>D.prepare('INSERT OR IGNORE INTO duties (id,teacher_id,date,slot,building,source_page,printed_slot,needs_review,version) VALUES (?,?,?,?,?,?,?,?,0)').bind(d.id,d.teacherId,d.date,d.slot,d.building,d.sourcePage,d.printedSlot,d.needsReview?1:0)))}await D.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('roster-v1','imported')").run()}
const mapDuty=(d:any)=>({id:d.id,teacherId:d.teacher_id,date:d.date,slot:d.slot,building:d.building,sourcePage:d.source_page,printedSlot:d.printed_slot,needsReview:!!d.needs_review,version:d.version});
async function allDuties(){return (await db().prepare('SELECT * FROM duties ORDER BY date,slot,id').all()).results.map(mapDuty)}
function requestToken(req:Request){return req.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{48})$/)?.[1]||req.headers.get('Cookie')?.match(/(?:^|;\s*)diu_session=([a-f0-9]+)/)?.[1]}
async function current(req:Request){const token=requestToken(req);if(!token)return null;return db().prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.teacher_id=s.teacher_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<any>()}
async function limit(req:Request,name:string){const key=await digest((req.headers.get('cf-connecting-ip')||'local')+':'+name);const now=Date.now();await db().prepare('INSERT INTO attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END').bind(key,now,now-900000,now-900000).run();const a=await db().prepare('SELECT count FROM attempts WHERE key=?').bind(key).first<any>();if(a.count>15)fail('Too many attempts. Try again in 15 minutes.',429)}
async function session(tid:string){const token=random();await db().prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await digest(token),tid,Date.now()+7*86400000).run();return {token,cookie:`diu_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`}}
function account(a:any){return a?{teacherId:a.teacher_id,username:a.username,isAdmin:!!a.is_admin,offDays:JSON.parse(a.off_days)}:null}
function cleanIds(x:any){if(!Array.isArray(x)||x.some(v=>typeof v!=='string'))fail('Invalid duty selection.');return x as string[]}
const ATTENDANCE_ORIGIN='https://tanjir2710.github.io';
async function signedIn(tid:string,req:Request){const s=await session(tid);return json({ok:true,...(req.headers.get('Origin')===ATTENDANCE_ORIGIN?{sessionToken:s.token}:{})},200,{'Set-Cookie':s.cookie})}
async function handleApi(req:Request){try{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/?/,'');const method=req.method;
 if(method!=='GET'){const origin=req.headers.get('Origin');if(origin&&origin!==url.origin&&origin!==ATTENDANCE_ORIGIN)fail('Cross-site request blocked.',403);if(!req.headers.get('Content-Type')?.includes('application/json'))fail('Use JSON.',415);if(Number(req.headers.get('Content-Length')||0)>16000)fail('Request too large.',413)}
 await seed();const D=db();const a=await current(req);const b=method==='GET'?{}:await req.json() as any;
 if(path==='status')return json({account:account(a),initialized:!!await D.prepare('SELECT teacher_id FROM accounts WHERE is_admin=1').first()});
 if(path==='roster')return json({...roster,duties:await allDuties(),accounts:(await D.prepare('SELECT teacher_id FROM accounts').all()).results.map((x:any)=>x.teacher_id)});
 if(path==='login'&&method==='POST'){
  const username=String(b.username||'').trim().toLowerCase();await limit(req,'login:'+username);
  const user=await D.prepare('SELECT * FROM accounts WHERE username=?').bind(username).first<any>();
  if(!user||await passwordHash(String(b.password||''),user.salt)!==user.password_hash)fail('Username or password is incorrect.',401);
  return signedIn(user.teacher_id,req);
 }
 if(path==='activate'&&method==='POST'){
  await limit(req,'activate');const t=roster.teachers.find(t=>t.id===b.teacherId);if(!t)fail('Choose your roster profile.');
  const username=String(b.username||'').trim().toLowerCase(),pw=String(b.password||'');if(!/^[a-z0-9._-]{3,32}$/.test(username))fail('Use a username of 3–32 letters, numbers, dots, underscores or hyphens.');if(pw.length<10||pw.length>128)fail('Use a password of 10–128 characters.');
  const existing=await D.prepare('SELECT teacher_id FROM accounts WHERE teacher_id=?').bind(t.id).first();if(await D.prepare('SELECT teacher_id FROM accounts WHERE username=? AND teacher_id!=?').bind(username,t.id).first())fail('This username is already in use.');
  const codeHash=await digest(String(b.code||'').trim());const adminExists=!!await D.prepare('SELECT teacher_id FROM accounts WHERE is_admin=1').first();
  const bootstrap=(env as any).ADMIN_ACTIVATION_HASH;let isAdmin=false;
  if(!adminExists&&t.id==='taa'&&bootstrap&&codeHash===bootstrap)isAdmin=true;
  else {const invite=await D.prepare('SELECT * FROM invitations WHERE teacher_id=? AND token_hash=? AND used_at IS NULL AND expires_at>?').bind(t.id,codeHash,Date.now()).first();if(!invite)fail('Activation code is invalid or expired.',403)}
  const salt=random(),hash=await passwordHash(pw,salt),now=Date.now();
  if(isAdmin){await D.batch([D.prepare("INSERT INTO settings (key,value) VALUES ('admin-activated',?)").bind(t.id),D.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)').bind(t.id,username,hash,salt,1,'[]',now)])}
  else{const eligible='EXISTS (SELECT 1 FROM invitations WHERE teacher_id=? AND token_hash=? AND used_at IS NULL AND expires_at>?)';const change=existing?D.prepare('UPDATE accounts SET username=?,password_hash=?,salt=? WHERE teacher_id=? AND '+eligible).bind(username,hash,salt,t.id,t.id,codeHash,now):D.prepare('INSERT INTO accounts SELECT ?,?,?,?,?,?,? WHERE '+eligible).bind(t.id,username,hash,salt,0,'[]',now,t.id,codeHash,now);const result=await D.batch([change,D.prepare('DELETE FROM sessions WHERE teacher_id=? AND '+eligible).bind(t.id,t.id,codeHash,now),D.prepare('UPDATE invitations SET used_at=? WHERE teacher_id=? AND token_hash=? AND used_at IS NULL').bind(now,t.id,codeHash)]);if(result[0].meta.changes!==1)fail('Activation code has already been used.',409)}
  return signedIn(t.id,req);
 }
 if(path==='logout'&&method==='POST'){const token=requestToken(req);if(token)await D.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':'diu_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'})}
 if(!a)fail('Sign in to continue.',401);
 if(path==='profile'&&method==='POST'){
  if(!Array.isArray(b.offDays)||b.offDays.some((x:any)=>!Number.isInteger(x)||x<0||x>6))fail('Invalid off days.');
  await D.prepare('UPDATE accounts SET off_days=? WHERE teacher_id=?').bind(JSON.stringify([...new Set(b.offDays)]),a.teacher_id).run();return json({ok:true});
 }
 if(path==='password'&&method==='POST'){
  await limit(req,'password:'+a.teacher_id);if(await passwordHash(String(b.currentPassword),a.salt)!==a.password_hash)fail('Current password is incorrect.');const pw=String(b.password||'');if(pw.length<10||pw.length>128)fail('Use a password of 10–128 characters.');const salt=random();await D.batch([D.prepare('UPDATE accounts SET password_hash=?,salt=? WHERE teacher_id=?').bind(await passwordHash(pw,salt),salt,a.teacher_id),D.prepare('DELETE FROM sessions WHERE teacher_id=?').bind(a.teacher_id)]);return signedIn(a.teacher_id,req)
 }
 if(path==='calendar'){
  const t=roster.teachers.find(t=>t.id===a.teacher_id)!;return new Response(calendar(t,(await allDuties()).filter(d=>d.teacherId===t.id)),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="diu-exam-duty.ics"','Cache-Control':'no-store'}})
 }
 if(path==='requests'&&method==='GET')return json({requests:(await D.prepare('SELECT * FROM requests WHERE sender=? OR recipient=? ORDER BY created_at DESC').bind(a.teacher_id,a.teacher_id).all()).results.map((r:any)=>({...r,giveIds:JSON.parse(r.give_ids),returnIds:JSON.parse(r.return_ids)}))});
 if(path==='requests'&&method==='POST'){
  const recipient=roster.teachers.find(t=>t.id===b.recipient);if(!recipient)fail('Choose a teacher.');if(!await D.prepare('SELECT teacher_id FROM accounts WHERE teacher_id=?').bind(recipient.id).first())fail('This teacher must activate their account before receiving requests.');
  const give=cleanIds(b.giveIds),back=cleanIds(b.returnIds);let snap;try{snap=validateExchange(await allDuties(),a.teacher_id,recipient.id,give,back)}catch(e:any){fail(e.message)}const message=String(b.message||'').trim();if(message.length>500)fail('Keep the message under 500 characters.');
  const pending=await D.prepare("SELECT COUNT(*) n FROM requests WHERE sender=? AND status='pending'").bind(a.teacher_id).first<any>();if(pending.n>=20)fail('Resolve an existing request before creating more.');
  const id=crypto.randomUUID();await D.prepare('INSERT INTO requests (id,sender,recipient,give_ids,return_ids,snapshot,message,status,created_at,processed) VALUES (?,?,?,?,?,?,?,\'pending\',?,0)').bind(id,a.teacher_id,recipient.id,JSON.stringify(give),JSON.stringify(back),JSON.stringify(snap),message,Date.now()).run();return json({ok:true,id});
 }
 if(path.startsWith('requests/')&&method==='POST'){
  const id=path.split('/')[1],r=await D.prepare('SELECT * FROM requests WHERE id=?').bind(id).first<any>();if(!r)fail('Request not found.',404);if(r.status!=='pending')fail('This request has already been resolved.',409);
  const action=b.action;if(action==='cancel'&&r.sender===a.teacher_id||action==='decline'&&r.recipient===a.teacher_id){await D.prepare("UPDATE requests SET status=?,resolved_at=? WHERE id=? AND status='pending'").bind(action==='cancel'?'cancelled':'declined',Date.now(),id).run();return json({ok:true})}
  if(action!=='accept'||r.recipient!==a.teacher_id)fail('Only the requested teacher can accept.',403);
  const give=JSON.parse(r.give_ids),back=JSON.parse(r.return_ids),all=await allDuties();
  try{validateExchange(all,r.sender,r.recipient,give,back)}catch(e:any){await D.prepare("UPDATE requests SET status='stale',resolved_at=? WHERE id=? AND status='pending'").bind(Date.now(),id).run();fail(e.message,409)}
  const now=Date.now();const snap=JSON.parse(r.snapshot);if(snap.some((x:any)=>!all.some(d=>d.id===x.id&&d.teacherId===x.teacherId&&d.version===x.version))) {await D.prepare("UPDATE requests SET status='stale',resolved_at=? WHERE id=? AND status='pending'").bind(now,id).run();fail('A selected duty changed. Send a new request.',409)}
  // D1 batch is transactional. The guarded state transition rechecks ownership,
  // versions, start times and both recipients' conflicts inside the transaction.
  const guard=`UPDATE requests SET status='accepted',resolved_at=? WHERE id=? AND status='pending' AND NOT EXISTS (SELECT 1 FROM json_each(snapshot) s LEFT JOIN duties d ON d.id=json_extract(s.value,'$.id') WHERE d.id IS NULL OR d.teacher_id!=json_extract(s.value,'$.teacherId') OR d.version!=json_extract(s.value,'$.version') OR d.needs_review=1 OR (d.date || 'T' || CASE d.slot WHEN 'A' THEN '09:00' WHEN 'B' THEN '11:30' ELSE '14:00' END || ':00+06:00') <= ?) AND NOT EXISTS (SELECT 1 FROM duties src JOIN duties busy ON busy.date=src.date AND busy.slot=src.slot AND busy.teacher_id=CASE WHEN src.teacher_id=sender THEN recipient ELSE sender END WHERE src.id IN (SELECT value FROM json_each(give_ids) UNION SELECT value FROM json_each(return_ids)))`;
  // ISO comparison uses the same +06:00 offset for all local start strings.
  const localNow=new Date(now+21600000).toISOString().slice(0,19)+'+06:00';
  await D.batch([
   D.prepare(guard).bind(now,id,localNow),
   D.prepare(`UPDATE duties SET teacher_id=CASE WHEN id IN (SELECT value FROM json_each(?)) THEN ? ELSE ? END,version=version+1 WHERE id IN (SELECT value FROM json_each(?) UNION SELECT value FROM json_each(?)) AND EXISTS (SELECT 1 FROM requests WHERE id=? AND status='accepted' AND processed=0)`).bind(r.give_ids,r.recipient,r.sender,r.give_ids,r.return_ids,id),
   D.prepare("INSERT INTO audit SELECT ?,?,'swap-accepted',?,? WHERE EXISTS (SELECT 1 FROM requests WHERE id=? AND status='accepted' AND processed=0)").bind(crypto.randomUUID(),a.teacher_id,JSON.stringify({requestId:id,give,back}),now,id),
   D.prepare("UPDATE requests SET processed=1 WHERE id=? AND status='accepted' AND processed=0").bind(id)
  ]);
  const after=await D.prepare('SELECT status FROM requests WHERE id=?').bind(id).first<any>();if(after.status!=='accepted'){await D.prepare("UPDATE requests SET status='stale',resolved_at=? WHERE id=? AND status='pending'").bind(now,id).run();fail('The roster changed. This request is no longer valid.',409)}return json({ok:true});
 }
 if(path==='admin'&&method==='GET'&&a.is_admin){return json({accounts:(await D.prepare('SELECT teacher_id,username,is_admin,created_at FROM accounts').all()).results,audit:(await D.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all()).results,requests:(await D.prepare('SELECT * FROM requests ORDER BY created_at DESC LIMIT 100').all()).results})}
 if(path==='admin/invite'&&method==='POST'&&a.is_admin){const t=roster.teachers.find(t=>t.id===b.teacherId);if(!t)fail('Teacher not found.');const code=random().slice(0,20).toUpperCase();await D.prepare('INSERT INTO invitations VALUES (?,?,?,NULL) ON CONFLICT(teacher_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,used_at=NULL').bind(t.id,await digest(code),Date.now()+7*86400000).run();return json({code,teacherId:t.id,expires:'7 days'})}
 if(path==='admin/review'&&method==='POST'&&a.is_admin){const d=await D.prepare('SELECT * FROM duties WHERE id=? AND needs_review=1').bind(b.dutyId).first<any>();if(!d)fail('No unresolved duty found.');if(!['B','C'].includes(b.slot))fail('Choose B or C.');const auditDetail=JSON.stringify({duty:d.id,originalColumn:d.slot,printed:d.printed_slot,confirmedSlot:b.slot});await D.batch([D.prepare('UPDATE duties SET slot=?,needs_review=0,version=version+1 WHERE id=?').bind(b.slot,d.id),D.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.teacher_id,'committee-slot-confirmed',auditDetail,Date.now())]);return json({ok:true})}
 fail('Endpoint not found.',404);
 }catch(e:any){if(/UNIQUE constraint/i.test(e.message))return json({error:'That username, profile, or duty is already in use. Refresh and try again.'},409);return json({error:e.status?e.message:e.message?.includes('Database is not')?e.message:'The request could not be completed. Please try again.'},e.status||500)}}

// Only the existing attendance-app origin can read cross-origin API responses.
export async function api(req:Request){
 const origin=req.headers.get('Origin'),same=origin===new URL(req.url).origin,allowed=origin===ATTENDANCE_ORIGIN;
 if(origin&&!same&&!allowed)return json({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS'){if(!allowed&&!same)return json({error:'Origin not allowed.'},403);return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin!,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}})}
 const result=await handleApi(req);
 if(!allowed)return result;const headers=new Headers(result.headers);headers.set('Access-Control-Allow-Origin',origin!);headers.set('Vary','Origin');
 return new Response(result.body,{status:result.status,headers});
}
