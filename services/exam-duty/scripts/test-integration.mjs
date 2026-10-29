/** Real API + isolated D1 tests. Does not contact or modify a deployed Site. */
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare'),{build}=wranglerRequire('esbuild');
mkdirSync('.sites-runtime',{recursive:true});
await build({stdin:{contents:"import {api} from './lib/duty-server.ts'; export default {fetch:api};",resolveDir:process.cwd(),sourcefile:'integration-worker.ts',loader:'ts'},bundle:true,format:'esm',platform:'neutral',external:['cloudflare:workers'],outfile:'.sites-runtime/integration-worker.mjs',logLevel:'silent'});
const code='LOCAL-TEST-ACTIVATION-ONLY';const hash=createHash('sha256').update(code).digest('hex');
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/integration-worker.mjs',compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:{ADMIN_ACTIVATION_HASH:hash}});
let count=0;
const ok=(test,label)=>{assert.ok(test,label);count++;console.log('PASS '+label)};
async function req(path,body,cookie='',origin,extra={}){const headers={'Content-Type':'application/json',...extra};if(cookie)headers.Cookie=cookie;if(origin)headers.Origin=origin;const r=await mf.dispatchFetch('https://test.local/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data,cookie:r.headers.get('set-cookie')||'',allowOrigin:r.headers.get('access-control-allow-origin')}}
try{
 const db=await mf.getD1Database('DB');const sql=readFileSync('drizzle/0000_round_true_believers.sql','utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);await db.batch(sql.map(s=>db.prepare(s)));
 let r=await req('roster');ok(r.status===200&&r.data.teachers.length===175&&r.data.duties.length===1286,'Complete roster imported');let all=r.data.duties;const teachers=r.data.teachers,mine=all.filter(d=>d.teacherId==='taa');
 ok(all.filter(d=>d.building==='ANX1').length===380,'380 green cells preserved as ANX1');
 const now=Date.now(),slots={A:'09:00',B:'11:30',C:'14:00'},future=d=>Date.parse(d.date+'T'+slots[d.slot]+':00+06:00')>now;let pair;
 for(const give of mine.filter(future)){for(const t of teachers.filter(t=>t.id!=='taa')){const theirs=all.filter(d=>d.teacherId===t.id);if(theirs.some(d=>d.date===give.date&&d.slot===give.slot))continue;const back=theirs.find(d=>future(d)&&!d.needsReview&&!mine.some(x=>x.date===d.date&&x.slot===d.slot));if(back){pair={give,back,t};break}}if(pair)break}
 assert.ok(pair,'Need two future duties for test');const {give,back,t}=pair;const pw='Local-test-password-2026';
 r=await req('activate',{teacherId:'taa',username:'test-admin',password:pw,code});ok(r.status===200,'Administrator bootstrap via one-time setup code');let adminCookie=r.cookie.split(';')[0];ok(r.cookie.includes('HttpOnly')&&r.cookie.includes('Secure')&&r.cookie.includes('SameSite=Lax'),'Secure session cookie flags');
 r=await req('login',{username:'test-admin',password:'wrong'});ok(r.status===401,'Incorrect password rejected');
 r=await req('login',{username:'test-admin',password:pw});ok(r.status===200,'Username/password login succeeds');adminCookie=r.cookie.split(';')[0];
 r=await req('requests',{recipient:t.id,giveIds:[give.id],returnIds:[]});ok(r.status===401,'Anonymous writes rejected');
 r=await req('profile',{offDays:[0]},adminCookie,'https://untrusted.example');ok(r.status===403,'Cross-site writes rejected');
 r=await req('admin/invite',{teacherId:t.id},adminCookie);ok(r.status===200&&r.data.code.length===20,'Admin issues teacher activation code');const invite=r.data.code;
 r=await req('activate',{teacherId:t.id,username:'test-recipient',password:pw,code:invite});ok(r.status===200,'Teacher activates with own username and password');let recipientCookie=r.cookie.split(';')[0];
 r=await req('activate',{teacherId:t.id,username:'test-recipient2',password:pw,code:invite});ok(r.status>=400,'Consumed activation code cannot be reused');
 r=await req('admin/invite',{teacherId:'zh'},recipientCookie);ok([403,404].includes(r.status),'Teacher cannot issue admin invitations');
 r=await req('requests',{recipient:t.id,giveIds:[back.id],returnIds:[]},adminCookie);ok(r.status===400,'Cannot offer another teacher’s duty');
 const body={recipient:t.id,giveIds:[give.id],returnIds:[back.id],message:'Isolated test only'};
 r=await req('requests',body,adminCookie);ok(r.status===200,'One-for-one swap request created');const one=r.data.id;
 r=await req('requests',body,adminCookie);ok(r.status===200,'Competing request created for stale-data test');const two=r.data.id;
 r=await req('requests/'+one,{action:'accept'},adminCookie);ok(r.status===403,'Sender cannot accept own swap');
 r=await req('requests/'+one,{action:'accept'},recipientCookie);ok(r.status===200,'Recipient accepts swap');
 r=await req('roster');const after=Object.fromEntries(r.data.duties.map(d=>[d.id,d]));ok(after[give.id].teacherId===t.id&&after[back.id].teacherId==='taa'&&r.data.duties.length===1286,'Both duties exchange atomically with unchanged total');
 ok(after[give.id].version===give.version+1&&after[give.id].building===give.building,'Duty version increases and building is preserved');
 r=await req('requests/'+one,{action:'accept'},recipientCookie);ok(r.status===409,'Double acceptance rejected');
 r=await req('requests/'+two,{action:'accept'},recipientCookie);ok(r.status===409,'Stale competing swap cannot overwrite assignments');
 r=await req('requests',undefined,recipientCookie);ok(r.data.requests.some(x=>x.id===two&&x.status==='stale'),'Stale request marked for both teachers');
 r=await req('calendar',undefined,adminCookie);ok(r.status===200&&r.data.includes('TRIGGER:-PT40M')&&r.data.match(/BEGIN:VEVENT/g).length===mine.length,'Calendar exports 40-minute alarms for current assignments');
 ok(r.data.includes('DTSTART:'+back.date.replaceAll('-','')+'T'+({A:'030000',B:'053000',C:'080000'}[back.slot])+'Z'),'Bangladesh exam times convert correctly to UTC calendar timestamps');
 r=await req('profile',{offDays:[0,6]},adminCookie);ok(r.status===200,'Off-day preferences saved');r=await req('status',undefined,adminCookie);ok(JSON.stringify(r.data.account.offDays)==='[0,6]','Off-day preferences persist');
 r=await req('admin/invite',{teacherId:t.id},adminCookie);const reset=r.data.code;ok(r.status===200,'Administrator issues recovery code for an activated teacher');
 r=await req('activate',{teacherId:t.id,username:'test-recipient',password:pw+'changed',code:reset});ok(r.status===200,'Teacher resets password with one-time recovery code');const newCookie=r.cookie.split(';')[0];
 r=await req('requests',undefined,recipientCookie);ok(r.status===401,'Password reset revokes old sessions');
 r=await req('login',{username:'test-recipient',password:pw});ok(r.status===401,'Old password rejected after reset');
 r=await req('logout',{},newCookie);ok(r.status===200,'Logout succeeds');r=await req('requests',undefined,newCookie);ok(r.status===401,'Logout revokes session');

 const origin='https://tanjir2710.github.io';
 r=await req('login',{username:'test-admin',password:pw},'',origin);ok(r.status===200&&/^[a-f0-9]{48}$/.test(r.data.sessionToken),'Attendance-app origin gets a cross-origin session token');
 ok(r.allowOrigin===origin,'CORS response is restricted to the attendance origin');const bearer=r.data.sessionToken;
 r=await req('status',undefined,'',origin,{Authorization:'Bearer '+bearer});ok(r.status===200&&r.data.account.teacherId==='taa','Attendance app can authenticate with bearer session');
 r=await req('roster',undefined,'','https://untrusted.example');ok(r.status===403&&!r.allowOrigin,'Untrusted origins cannot read API responses');
 let pre=await mf.dispatchFetch('https://test.local/api/status',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization,content-type'}});ok(pre.status===204&&pre.headers.get('access-control-allow-origin')===origin,'Attendance-app authorization preflight succeeds');
 pre=await mf.dispatchFetch('https://test.local/api/status',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}});ok(pre.status===403,'Untrusted preflight rejected');
 r=await req('logout',{},'',origin,{Authorization:'Bearer '+bearer});ok(r.status===200,'Cross-origin logout succeeds');
 r=await req('status',undefined,'',origin,{Authorization:'Bearer '+bearer});ok(r.data.account===null,'Cross-origin logout revokes bearer token');

 console.log(`${count} integration checks passed.`);
}finally{await mf.dispose()}
