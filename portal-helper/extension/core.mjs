export const PORTAL_URL='https://teacherportal.diu.edu.bd/student-attendance-entry';
export function validateJob(raw){
 if(raw?.format!=='classroll-diu-attendance'||raw.version!==1)throw Error('Use an attendance job exported by ClassRoll.');
 const course=raw.course;
 if(!course||typeof course.code!=='string'||!course.code.trim()||typeof course.section!=='string'||!course.section.trim())throw Error('Course code and section are required.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)||new Date(raw.date+'T00:00:00Z').toISOString().slice(0,10)!==raw.date)throw Error('Invalid attendance date.');
 if(!Array.isArray(raw.students)||!raw.students.length||raw.students.length>500)throw Error('The roster must contain 1–500 students.');
 const ids=new Set();const students=raw.students.map(s=>{const id=String(s.id||'').trim();if(!/^[A-Za-z0-9-]{3,40}$/.test(id)||ids.has(id))throw Error('Student IDs must be valid and unique.');ids.add(id);if(typeof s.present!=='boolean')throw Error('Every student must have an explicit present/absent value.');return {id,present:s.present}}).sort((a,b)=>a.id.localeCompare(b.id));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka'}).format(new Date());if(raw.date>today)throw Error('Future attendance cannot be submitted.');
 return{format:'classroll-diu-attendance',version:1,date:raw.date,course:{code:course.code.trim().slice(0,80),section:course.section.trim().slice(0,80),name:String(course.name||'').slice(0,180)},students};
}
export async function jobId(job){const j=validateJob(job);const s=JSON.stringify({code:j.course.code,section:j.course.section,date:j.date,students:j.students});const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function buildJob(course,date){
 if(!course?.sessions?.[date])throw Error('Choose a date with saved attendance. Save any draft first.');
 const present=new Set(course.sessions[date].presentIds||[]);const known=new Set(course.students.map(s=>s.id));if([...present].some(id=>!known.has(id)))throw Error('Saved attendance contains student IDs missing from the current roster. Review it first.');
 const job=validateJob({format:'classroll-diu-attendance',version:1,course:{code:course.courseCode,section:course.section,name:course.courseName},date,students:course.students.map(s=>({id:s.id,present:present.has(s.id)}))});
 return {...job,batchId:await jobId(job),exportedAt:new Date().toISOString()};
}
export function nextDailyTime(time,now=Date.now()){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Use HH:MM.');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka'}).format(new Date(now));let next=Date.parse(date+'T'+time+':00+06:00');if(next<=now)next+=86400000;return next;
}
