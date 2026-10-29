# ClassRoll DIU Portal Helper (desktop prototype)

The existing ClassRoll app did not have an SSO agent. This release adds a local browser-automation companion and an in-app attendance job handoff. It is a deterministic helper, with no LLM or external AI service.

**Status:** the live DIU attendance form could not be inspected because Cloudflare repeatedly blocked the development browser. The companion is not certified against DIU's current form. It supports only exact student-ID matching and clearly labeled Present/Absent controls. It stops on unknown or ambiguous layouts. A DIU-specific adapter may be required. No real student attendance was submitted during development.

## Install and use

Desktop Chrome or Microsoft Edge:

1. Download `classroll-diu-helper.zip` from ClassRoll → More → DIU Portal Helper, and extract it.
2. Open your browser's extensions manager. Enable Developer mode and choose **Load unpacked**, selecting the extracted folder containing `manifest.json`. This is a local prototype, not a Chrome Web Store release.
3. Reload ClassRoll after installing the helper.
4. In ClassRoll's DIU Portal Helper section, choose a course and recorded date, then **Prepare saved attendance**. Review the course, section, date, present count and absent count. Only saved attendance is exported; save any draft first.
5. Use **Send to installed helper**. Alternatively download the attendance-job JSON and import it in the extension. The job contains student IDs and presence values, with no passwords or OTPs.
6. Open DIU SSO / teacher portal. Personally enter your ID/password and OTP in DIU's actual page. The helper never automates or reads those fields and has no permission to access the SSO domain.
7. On **Student Attendance Entry**, select the exact course, section and recorded date and load the complete roster. Open the helper from the browser toolbar **on that DIU tab**.
8. Choose **Check roster**. It requires every saved ID to match one visible portal row exactly. Duplicate IDs, missing rows, unknown attendance fields and ambiguous submit buttons stop the operation.
9. Confirm course/section/date, then **Fill attendance for review**. Review the filled values on DIU. Reopen the helper if necessary; the prepared batch is retained for ten minutes and is bound to the same tab/document and context fields.
10. Check **I reviewed all filled values and totals**, then **Submit reviewed attendance**. The helper clicks a unique recognized Submit/Save button once. A click is recorded as **submission unverified**. Confirm DIU's actual success message yourself. The helper never labels a click as a successful submission.

If the helper stops on an unknown layout, use the existing P/A portal list for manual entry. To complete reliable automatic course selection and submission verification, the adapter must be validated against an authenticated DIU attendance page or DIU's supported API. Do not work around Cloudflare, CAPTCHA, OTP or SSO restrictions.

## Daily opening

In the extension popup, enable **Open the DIU portal once each day** and choose a time in **Bangladesh time** (default shown: 18:00). It opens the attendance-entry URL, which may redirect to DIU SSO. Login and OTP remain manual whenever DIU requires them. The browser must be running; alarms cannot wake a closed browser or sleeping device. Do not rely on an exact wake-up time.

This companion works on desktop Chromium browsers. The ClassRoll PWA can still record attendance and display exam duties on phones/tablets; this desktop extension is not an iPhone/iPad automation solution.

## Privacy and duplicate prevention

- `activeTab` grants portal access only when you open the extension on the selected tab. There is no broad `all_urls` access.
- No password, OTP, cookie or token collection. No external network or AI calls.
- Attendance jobs are kept in browser session storage and expire after 24 hours. Persistent local receipts store only batch hash/date/course/status/time, to prevent resubmission after popup closure or job removal.
- The ClassRoll bridge is limited to `https://tanjir2710.github.io/offline-teacher-attendance/` and can only import an attendance job. It cannot operate DIU tabs or submit attendance.
- Selecting an incorrect class or recorded date can change university records. Teacher review of the exact context is required immediately before submission.
