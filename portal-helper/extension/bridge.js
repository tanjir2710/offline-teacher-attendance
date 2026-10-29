// The bridge only accepts a job from the exact ClassRoll page in the current window.
window.addEventListener('message',async e=>{
 if(e.source!==window||e.origin!=='https://tanjir2710.github.io'||!location.pathname.startsWith('/offline-teacher-attendance/')||e.data?.type!=='CLASSROLL_PORTAL_JOB'||typeof e.data.nonce!=='string')return;
 try{const result=await chrome.runtime.sendMessage({type:'IMPORT_JOB',job:e.data.job});window.postMessage({type:'CLASSROLL_PORTAL_RECEIPT',nonce:e.data.nonce,...result},location.origin)}catch{window.postMessage({type:'CLASSROLL_PORTAL_RECEIPT',nonce:e.data.nonce,ok:false,error:'Reload ClassRoll after installing or updating the helper.'},location.origin)}
});
