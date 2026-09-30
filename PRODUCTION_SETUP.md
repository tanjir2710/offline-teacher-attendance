# v0.8 Firebase Production Setup

This branch prepares the attendance app for automatic multi-device synchronization and centralized user feedback.

## Architecture

- Attendance remains usable without internet.
- Firebase Authentication keeps a teacher signed in on the device.
- Cloud Firestore provides persistent web caching and automatically sends queued writes when connectivity returns.
- Each device publishes its local attendance state to its own Firestore device document.
- All devices signed into the same Google account listen to the user's device collection and merge changes.
- Google Drive remains optional recovery backup, not the primary live-sync database.
- Portal automation is intentionally not included in this version.

## One-time Firebase Console setup

1. Add Firebase to the existing Google Cloud project.
2. Register a **Web app**.
3. Copy the Firebase configuration into `firebase-config.mjs`.
4. Firebase Authentication -> Sign-in method -> enable **Google**.
5. Authentication -> Settings -> Authorized domains -> add:
   - `tanjir2710.github.io`
6. Create **Cloud Firestore**.
7. Publish the rules from `firestore.rules`.

The Firebase web config is public application configuration. Do not put service-account keys, OAuth client secrets, passwords, OTPs, or private API keys into this repository.

## Public release

Before public release:
- Google/Firebase authentication must accept the intended audience.
- Test account isolation with two different Google accounts.
- Test offline attendance and reconnect.
- Test simultaneous changes from two devices.
- Test app upgrade without clearing local data.
- Test feedback submission.

## Portal assistant boundary

The future portal assistant must not store or bypass SSO passwords, OTPs, CAPTCHAs, or MFA. The teacher will authenticate directly to the institutional SSO. Automation, if added, should only operate after successful user authentication and should require a final confirmation before attendance submission.
