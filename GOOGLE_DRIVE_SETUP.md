# Google Drive Backup Setup

This is a one-time setup for the project owner. The attendance app uses Google Identity Services in the browser and stores each teacher's backup in that teacher's private Google Drive **App Data** area.

## 1. Create or select a Google Cloud project

Open Google Cloud Console and create a project for the attendance app, for example:

`Offline Teacher Attendance`

## 2. Enable Google Drive API

In **APIs & Services → Library**, enable:

`Google Drive API`

## 3. Configure OAuth consent

Go to **Google Auth Platform / OAuth consent screen**.

For faculty testing, either use an internal app if your institution's Google Workspace allows it, or use External/Testing and add the faculty email addresses as test users.

The app requests only this scope:

`https://www.googleapis.com/auth/drive.appdata`

This scope gives the app access only to its hidden application-data area in the signed-in teacher's Drive. It does not give the app general access to all Drive files.

## 4. Create OAuth Web Client

Create an OAuth Client ID with application type:

`Web application`

Add this Authorized JavaScript origin:

`https://tanjir2710.github.io`

No client secret should ever be put into this repository or into the browser app.

## 5. Copy the Client ID

It looks similar to:

`1234567890-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

Open the attendance app, go to **Backup → Google Drive Cloud Backup**, paste the Client ID, and press **Save setup**.

Then press **Connect Google Drive** and approve access.

## 6. Faculty testing

Each teacher signs in with their own Google account. Their backup is stored only inside that Google account's App Data area.

Attendance remains fully usable offline. Drive sync occurs only while internet is available and the Google Drive session is authorized.

## Current limitation

Browser OAuth access tokens are short-lived. After the app is closed for a long time or the token expires, the teacher may need to press **Connect Google Drive** again. Truly silent persistent background sync across app restarts requires a small backend or another refresh-token-safe architecture.
