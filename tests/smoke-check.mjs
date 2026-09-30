import fs from 'node:fs';

function fail(msg){ console.error('SMOKE CHECK FAILED:', msg); process.exit(1); }
const html=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const sw=fs.readFileSync('sw.js','utf8');
const sync=fs.readFileSync('firebase-sync.mjs','utf8');
const config=fs.readFileSync('firebase-config.mjs','utf8');

for (const id of [
  'attendanceList','saveAttendanceBtn','firebaseSyncStatus','firebaseSignInBtn',
  'firebaseSignOutBtn','feedbackRating','feedbackCategory','feedbackMessage','feedbackSubmitBtn'
]) {
  if (!html.includes('id="'+id+'"')) fail('Missing required element #'+id);
}
if (!html.includes('AttendanceAppBridge')) fail('AttendanceAppBridge missing');
if (!html.includes('attendance-local-change')) fail('Local-change sync event missing');
if (!sync.includes("users', currentUser.uid, 'devices'")) fail('Per-user device sync path missing');
if (!sync.includes("collection(db, 'feedback')")) fail('Feedback collection missing');
if (!config.includes('firebaseConfig')) fail('Firebase config module missing');
if (!manifest.start_url) fail('Manifest start_url missing');
if (!sw.includes('offline-teacher-attendance-')) fail('Service worker cache name missing');
if (/clientSecret|client_secret|private_key/i.test(config)) fail('Secret-looking field found in Firebase config');
console.log('Smoke checks passed.');
