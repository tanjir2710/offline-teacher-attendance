# Exam Duty inside ClassRoll

This is an integrated section of the existing attendance app, not a redirect to a separate roster app. Open **Exam Duty** in the main navigation.

- Imported roster: 175 faculty, 1,286 duties, 380 ANX1 assignments. Name, initial, designation, faculty group, external-duty marker and source page are retained.
- Electric-green source cells mean **ANX1 (Annex 1)**. Other duties use the roster's Knowledge Tower center, KT-204, Level 2. Exact examination rooms and the Annex control-room number are not in the PDF.
- Slot A 09:00–10:30, B 11:30–13:00, C 14:00–15:30 (Asia/Dhaka). Reminders are 40 minutes early; report to Exam Control 30 minutes early.
- Calendar `.ics` exports carry a 40-minute VALARM. Browser reminders require the app to be open. Replace imported calendars after swaps.
- Find a colleague roster-free for selected slots or the entire day; request one or more return duties, or coverage without return duty.
- Shared username/password accounts, activation codes and accepted swaps use the shared D1-backed duty service. This is separate from the attendance app's existing Google/Firebase sync account.
- The duty-service origin is configured in `app.mjs`. It accepts cross-origin calls only from the existing GitHub Pages origin. The service currently retains its original private audience. Teacher sign-in and shared swaps are unavailable from the public app until the owner explicitly enables teacher access to that service. The UI explains failed connections; the imported/last saved roster remains usable.
- Authenticated cross-origin sessions use a 7-day server session token in this tab's `sessionStorage`, sent in the Authorization header. No password or activation code is saved locally. Closing the tab ends this browser's remembered duty session. The standalone service retains HttpOnly cookie login.
- Backend source lives in `services/exam-duty/`. No production key or admin setup code is included. Its Sites project identity is retained for deployment; do not make a second database or reset imported duties.
- RNA's 1 November printed B under column C is flagged. The duty is blocked from swapping and calendar export until committee clarification is recorded. Five teachers' missing initials remain missing, with explicit username suggestions.

The new module uses its own `classroll.examDuty.*` keys. Attendance storage, IndexedDB, Google/Firebase configuration and cloud ownership remain on their existing paths and keys.
