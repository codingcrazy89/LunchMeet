# Sharing LunchMeet with a Friend on iPhone (Testing Only)

You can share the app for testing on iPhone without publishing to the App Store by using **TestFlight**. You need an **Apple Developer Program** membership ($99/year).

---

## Prerequisites

1. **Apple Developer Program**  
   Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) if you haven’t already.

2. **EAS CLI** (you likely have this already)  
   ```bash
   npm install -g eas-cli
   eas login
   ```

3. **Apple Developer account linked in EAS**  
   ```bash
   eas credentials
   ```  
   When prompted, log in with your Apple ID and let EAS create/manage certificates and provisioning profiles.

---

## Steps to Share with a Friend

### 1. Build the iOS app

From the project root:

```bash
eas build --profile preview --platform ios
```

Or use the script:

```bash
npm run build:preview
```
(If that builds both platforms, run the `eas build` command above with `--platform ios` only.)

Wait for the build to finish in the [Expo dashboard](https://expo.dev). You’ll get an iOS build (e.g. link to the build and optionally an `.ipa`).

### 2. Submit the build to App Store Connect (for TestFlight)

After the build succeeds:

```bash
eas submit --platform ios
```

- Choose the **latest iOS build** when prompted.
- EAS will upload it to **App Store Connect**. Use the same Apple ID / team that has the Developer Program.

### 3. Enable TestFlight and add your friend

1. Go to [App Store Connect](https://appstoreconnect.apple.com).
2. Open your app (create it first if needed; use the same **bundle identifier** as in the app: `com.lunchmeet.app`).
3. In the left sidebar, open **TestFlight**.
4. Wait until the build appears and finishes processing (can take 5–15 minutes).
5. Under **TestFlight**:
   - **Internal testing:** Add your friend as an **Internal Tester** (they must be in your App Store Connect team).
   - **External testing:** Create an **External Group**, add your friend’s **email**, and submit the build for **Beta App Review** (first time can take a day or so). Once approved, they get an invite by email.

### 4. Your friend installs the app

1. They get an email from Apple inviting them to test the app.
2. They install the **TestFlight** app from the App Store (if they don’t have it).
3. They open the invite link and tap **Accept**.
4. In TestFlight, they tap **Install** for LunchMeet. The app appears on their home screen like a normal app.

They can use it for testing; you can ship new builds by repeating the build + submit steps and they’ll get updates via TestFlight.

---

## Optional: Add an EAS submit profile for iOS

To make `eas submit` smoother, you can add an iOS submit profile. In `eas.json`, under `"submit"`, add:

```json
"submit": {
  "production": {},
  "preview": {
    "ios": {
      "appleId": "your-apple-id@email.com",
      "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
    }
  }
}
```

- Replace `your-apple-id@email.com` with your Apple ID.
- After you create the app in App Store Connect, open the app → **App Information** and copy the **Apple ID** (numeric) into `ascAppId`.

Then you can run:

```bash
eas submit --platform ios --profile preview
```

---

## If you don’t have an Apple Developer account yet

- **Without the $99/year program:** You can’t use TestFlight or install a custom app on someone else’s iPhone for testing in the normal way. Options are:
  - **Expo Go:** Your friend installs Expo Go and you share a link or tunnel; they run your app inside Expo Go (not a standalone install, and they need to connect to your dev server or a published update).
  - **Simulator only:** You can build for the **iOS Simulator** and share that build with someone who has a Mac with Xcode; they run it only in the simulator, not on a physical iPhone.

If you want a **simulator-only** build for a Mac user:

```bash
eas build --profile preview --platform ios
```

Then in `eas.json`, under the `preview` profile, you can set `"ios": { "simulator": true }` so the build is a simulator build. Simulator builds can’t be installed on a real iPhone.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Have Apple Developer Program ($99/year). |
| 2 | `eas build --profile preview --platform ios` |
| 3 | `eas submit --platform ios` (choose the new build). |
| 4 | In App Store Connect → TestFlight, add your friend as Internal or External tester. |
| 5 | Friend installs TestFlight, accepts invite, installs LunchMeet. |

After that, you can keep testing by building and submitting new versions; testers get updates through TestFlight.
