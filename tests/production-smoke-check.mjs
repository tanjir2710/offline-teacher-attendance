import fs from 'node:fs';

function fail(msg){ console.error('PRODUCTION SMOKE CHECK FAILED:', msg); process.exit(1); }
const html=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const sw=fs.readFileSync('sw.js','utf8');
const sync=fs.readFileSync('firebase-sync.mjs','utf8');
const config=fs.readFileSync('firebase-config.mjs','utf8');

for (const id of [
  'attendanceList','saveAttendanceBtn','firebaseSyncStatus','googleSignInMount',
  'firebaseSignOutBtn','feedbackRating','feedbackCategory','feedbackMessage','feedbackSubmitBtn',
  'editAttendanceBtn','cancelAttendanceEditBtn','evalCourseSelect','evalSelect','newEvaluationBtn',
  'rubricBuilderRows','saveEvaluationMarksBtn','evaluationStudents','courseType','evaluationList',
  'editEvaluationBtn','closeEvaluationBtn','newFinalLabTestBtn','labReportMax','labTaskMax',
  'exportEvaluationExcelBtn','exportLabSummaryBtn','recoverStagingV08Btn','restoreStagingDriveBtn'
]) {
  if (!html.includes('id="'+id+'"')) fail('Missing required production element #'+id);
}
if (!html.includes("const STORAGE_KEY = 'offlineTeacherAttendance.v3'")) fail('Production storage key changed');
if (!html.includes("const DB_NAME = 'OfflineTeacherAttendanceDB'")) fail('Production IndexedDB name changed');
if (!html.includes("const APP_VERSION = '0.8.2'")) fail('Production app version missing');
if (!html.includes("const PRE_V08_BACKUP_KEY = 'offlineTeacherAttendance.preV08Backup'")) fail('Pre-v0.8 recovery snapshot missing');
if (!html.includes('AttendanceAppBridge')) fail('AttendanceAppBridge missing');
if (!sync.includes("environment: 'production'")) fail('Production Firestore environment marker missing');
if (!sync.includes("data?.environment !== 'production'")) fail('Production Firestore filter missing');
if (!config.includes('offline-teacher-attendance.firebaseapp.com')) fail('Firebase config missing');
if (manifest.name !== 'ClassRoll') fail('Production manifest is not ClassRoll');
if (!manifest.start_url) fail('Manifest start_url missing');
if (!sw.includes("classroll-production-v0.8.2")) fail('Production service-worker cache name missing');
if (html.includes('>STAGING<') || html.includes('STAGING v0.8')) fail('Visible staging branding remains in production');

if (!html.includes('saved-attendance-panel')) fail('Saved attendance lock view missing');
if (!html.includes('function renderEvaluation()')) fail('Lab evaluation renderer missing');
if (!html.includes('labReportIds') || !html.includes('labTaskIds')) fail('Lab daily report/task tracking missing');
if (!html.includes('function finalAverage25')) fail('Final /25 evaluation average missing');
if (!html.includes('data-note-student')) fail('Evaluation note field missing');
if (!html.includes("state.courses.filter(isLabCourse)")) fail('Evaluation is not restricted to lab courses');
if (!html.includes("type==='final_lab'")) fail('Final Lab Test evaluation type missing');
if (!html.includes('Final lab /40')) fail('Final Lab Test 40-mark summary missing');
if (!html.includes('Evaluation average /25')) fail('Continuous lab evaluation average /25 missing');
if (!html.includes('function exportCurrentEvaluationExcel')) fail('Evaluation Excel export missing');
if (!html.includes('function exportLabSummaryExcel')) fail('Lab summary Excel export missing');
if (!html.includes('function componentMark(completed,total,maxMarks)')) fail('Configurable daily lab mark conversion missing');
if (!html.includes('id="labComponentPreview"')) fail('Converted daily mark preview missing');

console.log('Production smoke checks passed.');

if (!html.includes("STAGING_V08_STORAGE_KEY")) fail('Local v0.8 recovery key missing');
if (!html.includes("STAGING_V08_DRIVE_FILE_NAME")) fail('v0.8 Drive recovery filename missing');
if (!html.includes("readNamedDriveState")) fail('Named Drive recovery reader missing');
