# Offline Teacher Attendance v3

Cross-device offline attendance PWA for Android, iPhone, iPad, Windows, and Mac.

## What was fixed in v3

The earlier package referenced `styles.css` and `app.js` but did not actually include those files. That caused the page to look like plain HTML and left the status at **Checking…**. Version 3 is self-contained: the CSS and JavaScript are embedded directly in `index.html`, so opening that file alone already gives a working styled attendance app.

## Main behavior

- Create a course with section, course code, course name, and alert threshold.
- Paste Student ID + Name directly from Google Sheets or import CSV.
- Select a date, tick only present students, then press **Save attendance**.
- Every saved date remains permanent and editable.
- **Red** = 2 or more consecutive recorded-class absences.
- **Yellow** = 2 or more total absences without a current 2-class streak.
- Alerts page, student statistics, daily attendance rates, bar chart, portal-entry view, CSV export, print, backup, and restore.

## Quick Windows test

Do not judge PWA installation by double-clicking `index.html`, because browsers do not allow service workers from `file://` URLs.

The app itself *does* work when double-clicked, but for the real PWA behavior run it through a local web server:

```bash
cd offline-teacher-attendance-v3
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## GitHub Pages deployment

1. Upload the **contents of this folder** to the root of the GitHub repository.
2. GitHub → repository **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose `main` and `/ (root)`.
5. Save.
6. Open the generated Pages URL once while online.

### Install on devices

- **iPhone/iPad:** Safari → Share → Add to Home Screen.
- **Android:** Chrome → menu → Install app / Add to Home screen.
- **Windows/Mac:** use the browser's Install App option where available.

After the hosted app has been opened once, its shell is cached for offline use.

## Privacy

Real student names, IDs, and attendance data are stored locally in the browser. Do not commit real student attendance data into a public GitHub repository. Use the built-in JSON backup if data must be moved to another device.