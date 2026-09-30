// Firebase Web configuration for Offline Teacher Attendance.
// Firebase web configuration is public application configuration, not a secret.
export const firebaseConfig = {
  apiKey: "AIzaSyDFKgOHDcdzlxajvNC_VMsQxJV9NaKrfP4",
  authDomain: "offline-teacher-attendance.firebaseapp.com",
  projectId: "offline-teacher-attendance",
  storageBucket: "offline-teacher-attendance.firebasestorage.app",
  messagingSenderId: "460419019734",
  appId: "1:460419019734:web:389374533d353733e2ea77"
};

export const firebaseConfigured =
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
