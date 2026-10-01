import { firebaseConfig, firebaseConfigured } from './firebase-config.mjs';
import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithCredential,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const APP_VERSION = '0.8.0-rc12';
const GOOGLE_WEB_CLIENT_ID = '460419019734-lhvkcq795cg41k6cet2mvcnmmq3djcht.apps.googleusercontent.com';
const DEVICE_KEY = 'offlineTeacherAttendance.stagingV08.deviceId.v1';

const $ = id => document.getElementById(id);
const statusEl = () => $('firebaseSyncStatus');

function setStatus(message, tone='warning') {
  const el = statusEl();
  if (!el) return;
  el.textContent = message;
  el.className = 'notice ' + (tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : '');
}

function setAuthUI(user) {
  const badge = $('cloudAuthBadge');
  const signInMount = $('googleSignInMount');
  const signOutBtn = $('firebaseSignOutBtn');
  if (user) {
    if (badge) {
      badge.textContent = user.email ? 'Synced: ' + user.email : 'Cloud synced';
      badge.className = 'badge';
    }
    if (signInMount) signInMount.classList.add('hidden');
    if (signOutBtn) signOutBtn.classList.remove('hidden');
  } else {
    if (badge) {
      badge.textContent = firebaseConfigured ? 'Local only' : 'Cloud setup pending';
      badge.className = 'badge file';
    }
    if (signInMount) signInMount.classList.remove('hidden');
    if (signOutBtn) signOutBtn.classList.add('hidden');
  }
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function trustedDeviceNotice() {
  // Firestore web persistence keeps cloud-cached attendance on this browser.
  // This app is intended for a teacher's personal/trusted device.
  const key = 'offlineTeacherAttendance.trustedDeviceNotice.v1';
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, 'shown');
  }
}

async function waitForGoogleIdentity(){
  for(let i=0;i<160;i++){
    if(window.google?.accounts?.id) return true;
    await new Promise(r=>setTimeout(r,50));
  }
  return false;
}

async function waitForBridge() {
  for (let i = 0; i < 100; i++) {
    if (window.AttendanceAppBridge) return window.AttendanceAppBridge;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Attendance app bridge did not initialize.');
}

if (!firebaseConfigured) {
  setAuthUI(null);
  setStatus('Automatic multi-device sync is prepared but not activated yet. The administrator must add the Firebase web configuration.', 'warning');
  if ($('googleSignInMount')) $('googleSignInMount').innerHTML='<button class="primary" type="button" disabled>Cloud setup pending</button>';
  if ($('feedbackSubmitBtn')) $('feedbackSubmitBtn').disabled = true;
  window.dispatchEvent(new CustomEvent('attendance-cloud-ready', {detail:{configured:false}}));
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn('Firebase auth persistence fallback:', err);
  }

  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
    });
  } catch (err) {
    console.warn('Persistent Firestore cache unavailable; using standard Firestore:', err);
    db = getFirestore(app);
  }

  trustedDeviceNotice();

  const bridge = await waitForBridge();
  const deviceId = getDeviceId();
  let currentUser = null;
  let deviceUnsub = null;
  let publishing = false;
  let lastPublished = '';
  let localDebounce = null;

  function currentStateJson() {
    return JSON.stringify(bridge.getState());
  }

  async function publishLocalState() {
    if (!currentUser || publishing) return;
    publishing = true;
    try {
      const state = bridge.getState();
      const json = JSON.stringify(state);
      if (json === lastPublished) return;
      const approxBytes = new Blob([json]).size;
      if (approxBytes > 750000) {
        setStatus('Cloud sync paused because this device data is becoming too large for the current RC sync format. Export a backup and contact the administrator.', 'warning');
        return;
      }
      await setDoc(
        doc(db, 'users', currentUser.uid, 'devices', deviceId),
        {
          deviceId,
          environment: 'staging-v08',
          state,
          appVersion: APP_VERSION,
          updatedAt: serverTimestamp()
        },
        {merge:true}
      );
      lastPublished = json;
      setStatus(navigator.onLine ? 'Automatic sync active · changes are up to date.' : 'Offline · changes are queued and will sync automatically when internet returns.', navigator.onLine ? 'success' : 'warning');
    } catch (err) {
      setStatus('Automatic sync error: ' + (err?.message || String(err)), 'warning');
    } finally {
      publishing = false;
    }
  }

  function queuePublish(delay=350) {
    clearTimeout(localDebounce);
    localDebounce = setTimeout(publishLocalState, delay);
  }

  function startDeviceListener(user) {
    if (deviceUnsub) deviceUnsub();
    const devicesRef = collection(db, 'users', user.uid, 'devices');
    deviceUnsub = onSnapshot(
      devicesRef,
      {includeMetadataChanges:true},
      async snap => {
        let merged = bridge.getState();
        for (const d of snap.docs) {
          const data = d.data();
          if (data?.environment !== 'staging-v08') continue;
          if (data?.state?.courses) merged = bridge.mergeRemote(data.state, {render:false});
        }
        const finalState = bridge.mergeRemote(merged, {render:true});
        const mergedJson = JSON.stringify(finalState);
        if (mergedJson !== lastPublished) queuePublish(100);
        const pending = snap.metadata.hasPendingWrites;
        const cacheOnly = snap.metadata.fromCache && !navigator.onLine;
        if (pending || cacheOnly) {
          setStatus('Offline/local changes saved · cloud synchronization will finish automatically when online.', 'warning');
        } else {
          setStatus('Automatic sync active · this account is synchronized across devices.', 'success');
        }
      },
      err => setStatus('Cloud listener error: ' + (err?.message || String(err)), 'warning')
    );
  }

  window.addEventListener('attendance-local-change', () => {
    if (currentUser) queuePublish();
  });
  window.addEventListener('online', () => {
    if (currentUser) {
      setStatus('Back online · completing automatic synchronization…', 'warning');
      queuePublish(50);
    }
  });
  window.addEventListener('offline', () => {
    if (currentUser) setStatus('Offline · keep taking attendance. Changes will synchronize automatically.', 'warning');
  });

  async function renderOfficialGoogleButton(){
    const mount=$('googleSignInMount');
    if(!mount) return;
    const ready=await waitForGoogleIdentity();
    if(!ready){
      setStatus('Google Sign-In library did not load. Check the internet connection and reload this page.','warning');
      mount.innerHTML='<button class="primary" type="button" disabled>Google Sign-In unavailable</button>';
      return;
    }
    mount.innerHTML='';
    google.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: async(response)=>{
        try{
          if(!response?.credential) throw new Error('Google did not return an ID token.');
          setStatus('Google account selected · signing into Firebase…','warning');
          const credential=GoogleAuthProvider.credential(response.credential);
          await signInWithCredential(auth,credential);
        }catch(err){
          const code=err?.code || 'unknown';
          setStatus('Firebase sign-in failed ('+code+'): '+(err?.message || String(err)),'warning');
        }
      },
      auto_select:false,
      cancel_on_tap_outside:true,
      itp_support:true
    });
    google.accounts.id.renderButton(mount,{
      type:'standard',
      theme:'outline',
      size:'large',
      text:'signin_with',
      shape:'pill',
      logo_alignment:'left',
      width:230
    });
  }

  renderOfficialGoogleButton();

  if ($('firebaseSignOutBtn')) {
    $('firebaseSignOutBtn').onclick = async () => {
      await signOut(auth);
    };
  }

  onAuthStateChanged(auth, user => {
    currentUser = user || null;
    setAuthUI(currentUser);
    if (deviceUnsub) {
      deviceUnsub();
      deviceUnsub = null;
    }
    if (currentUser) {
      setStatus('Signed in · starting automatic synchronization…', 'warning');
      startDeviceListener(currentUser);
      queuePublish(50);
    } else {
      setStatus('Not signed in. Attendance still works locally on this device.', 'warning');
      renderOfficialGoogleButton();
    }
  });

  if ($('feedbackSubmitBtn')) {
    $('feedbackSubmitBtn').onclick = async () => {
      if (!currentUser) {
        setStatus('Sign in with Google before sending feedback.', 'warning');
        bridge.notify('Please sign in first.');
        return;
      }
      const rating = Number($('feedbackRating')?.value || 0);
      const category = $('feedbackCategory')?.value || 'General';
      const message = ($('feedbackMessage')?.value || '').trim();
      if (!rating || !message) {
        bridge.notify('Choose a rating and write your feedback.');
        return;
      }
      try {
        $('feedbackSubmitBtn').disabled = true;
        await addDoc(collection(db, 'feedback'), {
          uid: currentUser.uid,
          email: currentUser.email || '',
          rating,
          category,
          message,
          appVersion: APP_VERSION,
          userAgent: navigator.userAgent,
          createdAt: serverTimestamp()
        });
        $('feedbackMessage').value = '';
        bridge.notify(navigator.onLine ? 'Thank you. Feedback submitted.' : 'Thank you. Feedback saved and will send when online.');
      } catch (err) {
        bridge.notify('Feedback could not be saved: ' + (err?.message || String(err)));
      } finally {
        $('feedbackSubmitBtn').disabled = false;
      }
    };
  }

  window.dispatchEvent(new CustomEvent('attendance-cloud-ready', {detail:{configured:true}}));
}
