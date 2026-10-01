import fs from 'node:fs';

function fail(msg){ console.error('STAGING SMOKE CHECK FAILED:', msg); process.exit(1); }
const base='staging-v08/';
const html=fs.readFileSync(base+'index.html','utf8');
const manifest=JSON.parse(fs.readFileSync(base+'manifest.webmanifest','utf8'));
const sw=fs.readFileSync(base+'sw.js','utf8');
const sync=fs.readFileSync(base+'firebase-sync.mjs','utf8');
const config=fs.readFileSync(base+'firebase-config.mjs','utf8');

for (const id of [
  'attendanceList','saveAttendanceBtn','firebaseSyncStatus','googleSignInMount',
  'firebaseSignOutBtn','feedbackRating','feedbackCategory','feedbackMessage','feedbackSubmitBtn',
  'editAttendanceBtn','cancelAttendanceEditBtn','evalCourseSelect','evalSelect','newEvaluationBtn',
  'rubricBuilderRows','saveEvaluationMarksBtn','evaluationStudents','courseType','evaluationList','editEvaluationBtn','closeEvaluationBtn'
]) {
  if (!html.includes('id="'+id+'"')) fail('Missing required staging element #'+id);
}
if (!html.includes("const STORAGE_KEY = 'offlineTeacherAttendance.stagingV08'")) fail('Staging storage key is not isolated');
if (!html.includes("const DB_NAME = 'OfflineTeacherAttendanceDB-StagingV08'")) fail('Staging IndexedDB is not isolated');
if (!html.includes('AttendanceAppBridge')) fail('AttendanceAppBridge missing');
if (!sync.includes("environment: 'staging-v08'")) fail('Staging Firestore environment marker missing');
if (!sync.includes("data?.environment !== 'staging-v08'")) fail('Staging Firestore filter missing');
if (!config.includes('offline-teacher-attendance.firebaseapp.com')) fail('Firebase config missing');
if (!manifest.start_url) fail('Manifest start_url missing');
if (!/classroll-staging-v08-|offline-teacher-attendance-staging-v08-/.test(sw)) fail('Staging service-worker cache name missing');
console.log('Staging smoke checks passed.');

if (!html.includes('saved-attendance-panel')) fail('Saved attendance lock view missing');
if (!html.includes("draft.editing=false")) fail('Attendance save does not lock the record');
if (!html.includes('function renderEvaluation()')) fail('Lab evaluation renderer missing');
if (!html.includes('rubricDraft')) fail('Rubric builder missing');

if (!html.includes('labReportIds') || !html.includes('labTaskIds')) fail('Lab daily report/task tracking missing');
if (!html.includes('function finalAverage25')) fail('Final /25 evaluation average missing');
if (!html.includes('data-note-student')) fail('Evaluation note field missing');
if (!html.includes("state.courses.filter(isLabCourse)")) fail('Evaluation is not restricted to lab courses');
