import{validateJob,jobId,nextDailyTime,PORTAL_URL}from'./core.mjs';
async function schedule(){const{daily}=await chrome.storage.local.get('daily');await chrome.alarms.clear('diu-daily');if(daily?.enabled)await chrome.alarms.create('diu-daily',{when:nextDailyTime(daily.time||'18:00')})}
chrome.runtime.onInstalled.addListener(schedule);chrome.runtime.onStartup.addListener(schedule);
chrome.alarms.onAlarm.addListener(async a=>{if(a.name!=='diu-daily')return;const {daily}=await chrome.storage.local.get('daily');const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka'}).format(new Date());if(daily?.enabled&&daily.lastOpened!==date){await chrome.storage.local.set({daily:{...daily,lastOpened:date}});await chrome.tabs.create({url:PORTAL_URL})}await schedule()});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{(async()=>{
 const self=sender.id===chrome.runtime.id;
 if(!self)throw Error('Unknown sender.');
 if(message.type==='IMPORT_JOB'){
  if(sender.tab){const u=new URL(sender.url);if(u.origin!=='https://tanjir2710.github.io'||!u.pathname.startsWith('/offline-teacher-attendance/'))throw Error('Only the ClassRoll page can send attendance.');}
  const job=validateJob(message.job),id=await jobId(job);const receipts=(await chrome.storage.local.get('receipts')).receipts||[];if(receipts.some(r=>r.batchId===id))throw Error('This attendance batch was already submitted or is awaiting verification. Check the DIU portal instead of resubmitting.');const old=await chrome.storage.session.get('job');if(old.job?.batchId===id&&['submitted','submission-unverified'].includes(old.job.status))throw Error('This batch has already been sent. Verify its status in DIU before doing anything else.');
  await chrome.storage.session.set({job:{...job,batchId:id,status:'ready',receivedAt:Date.now()}});return{ok:true,batchId:id};
 }
 if(sender.tab)throw Error('This action is only available in the helper popup.');
 if(message.type==='SCHEDULE'){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(message.time))throw Error('Choose a valid time.');await chrome.storage.local.set({daily:{enabled:!!message.enabled,time:message.time}});await schedule();return{ok:true}}
 throw Error('Unknown action.');
})().then(respond,e=>respond({ok:false,error:e.message}));return true});
schedule();
