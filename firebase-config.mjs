// Firebase Web configuration for Offline Teacher Attendance.
// This file is intentionally safe to publish: Firebase web config is not a password.
// Fill these values from Firebase Console -> Project settings -> Your apps -> Web app.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export const firebaseConfigured =
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
