# Publishing LunchMeet to the iOS App Store

This guide walks through the steps to fully publish your app to the App Store (not just TestFlight).

---

## Prerequisites

- **Apple Developer Program** membership ($99/year). Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/).
- Your app builds successfully with EAS (you’ve already done TestFlight or similar).
- **App Store Connect** access with the same Apple ID / team.

---

## Step 1: Create (or confirm) your app in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com) and sign in.
2. Click **My Apps** → **+** (or **Add App**).
3. Fill in:
   - **Platforms:** iOS.
   - **Name:** LunchMeet (or your chosen display name).
   - **Primary Language:** e.g. English (U.S.).
   - **Bundle ID:** Select the one that matches your app — in your project this is **`com.lunchmeet.app`**. If it’s not in the list, create it in the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list) under **Identifiers** → **+** → **App IDs**.
   - **SKU:** Any unique string (e.g. `lunchmeet-ios-2026`).
   - **User Access:** Full Access (typical).
4. Click **Create**. You’ll land on the app’s **App Information** and **Pricing and Availability** sections.

---

## Step 2: Prepare app information and metadata

In App Store Connect, complete these for the **first iOS version** (e.g. 1.0.0):

### Version information

- **Version:** Must match or be ahead of what you build (e.g. `1.0.0` from your `app.config.js`).
- **Copyright:** e.g. `2026 Your Name` or your company.
- **What’s New in This Version:** Short release notes (e.g. “Initial release of LunchMeet.”).

### App information (under the app’s **App Information**)

- **Subtitle:** Short tagline (optional, ~30 characters).
- **Category:** e.g. **Food & Drink** or **Social Networking** (primary + optional secondary).
- **Content Rights:** If you use third‑party content (e.g. maps, APIs), you may need to declare it.
- **Age Rating:** Complete the questionnaire (likely 4+ for a lunch-planning app).
- **Privacy Policy URL:** **Required.** Host a page that explains what data you collect (e.g. account, location) and link it here. You can use GitHub Pages, your own site, or a privacy policy generator.

### Pricing and availability

- **Price:** Free or paid. For free, select **Free**.
- **Availability:** Choose countries/regions (e.g. United States, or all).

---

## Step 3: Screenshots and preview (required)

Apple requires screenshots for each device size you support.

1. In the version page, go to **App Store** (left sidebar) → select the version (e.g. 1.0.0).
2. Under **Screenshots**, add:
   - **6.7" (iPhone 15 Pro Max):** 1290 x 2796 px (at least one; add more for a better first impression).
   - **6.5" (iPhone 14 Plus, etc.):** 1284 x 2778 px.
   - **5.5" (iPhone 8 Plus):** 1242 x 2208 px.  
   You can use the same image for multiple sizes if it fits, or export from simulator/design tool per size.
3. **Preview (optional but good):** Short video preview of the app.
4. **Promotional Text (optional):** Can be updated without a new version.
5. **Description:** Clear description of what LunchMeet does (what you see in the App Store).
6. **Keywords:** Comma‑separated, no spaces (e.g. `lunch,meetup,restaurant,food,plans`). Max 100 characters total.
7. **Support URL:** Required. A page or email (e.g. `https://yoursite.com/support` or `mailto:support@yoursite.com`).
8. **Marketing URL (optional):** e.g. your website.

You can use the iOS Simulator to capture screens: run the app, then **File → Save Screen** (or Cmd+S), or take screenshots on a real device and transfer them.

---

## Step 4: Build the app for release

Use EAS to build an iOS app that’s ready for App Store submission (not simulator, not development).

1. **Use a production (or release) profile.**  
   In your project you have `preview` and `production`. For store submission you typically use **production** (or a profile that doesn’t use `developmentClient` and uses `distribution: "store"`).

2. **Check `eas.json`.**  
   Ensure you have a profile that builds for the App Store, for example:
   ```json
   "production": {
     "distribution": "store",
     "channel": "production",
     "ios": { "simulator": false }
   }
   ```
   If `production` is already set up for store, use it.

3. **Build:**
   ```bash
   eas build --profile production --platform ios
   ```
   Or, if you use `preview` for store builds:
   ```bash
   eas build --profile preview --platform ios
   ```
   Wait for the build to finish on [expo.dev](https://expo.dev).

4. **Submit the build to App Store Connect:**
   ```bash
   eas submit --platform ios --latest
   ```
   Or specify the build ID. When prompted (or in your submit profile), choose **App Store Connect** and the correct app. EAS will upload the `.ipa` to App Store Connect.

5. In **App Store Connect** → your app → **TestFlight** (or **App Store** tab), wait until the build appears and finishes processing (often 5–15 minutes). The build will show under the version you’re preparing (e.g. 1.0.0).

---

## Step 5: Select the build and complete the version

1. In App Store Connect, open your app → **App Store** tab → select the version (e.g. 1.0.0).
2. Under **Build**, click **+** and select the build you just uploaded.
3. Ensure all required fields are filled (screenshots, description, keywords, support URL, privacy policy, age rating, etc.). App Store Connect will show warnings for anything missing.
4. Under **Pricing and Availability**, confirm price and countries.
5. Under **App Review Information**, provide:
   - **Contact info:** Phone and email for Apple to reach you.
   - **Demo account (if needed):** If the app requires login, provide a test account so reviewers can sign in.
   - **Notes:** Any short instructions (e.g. “Use the provided demo account to test chat and lunch creation.”).

---

## Step 6: Submit for review

1. Click **Add for Review** (or **Submit for Review**) for that version.
2. Answer the export compliance and content questions (e.g. encryption, IDFA, etc.). For many apps this is straightforward (e.g. “No” for custom encryption, “No” for IDFA if you don’t use it).
3. Confirm and submit. Status will change to **Waiting for Review**, then **In Review**. Review usually takes **24–48 hours** (sometimes longer on first submission).

---

## Step 7: After approval

- **Manual release:** You choose when to release the app to the store (recommended for first launch).
- **Automatic release:** Apple releases as soon as it’s approved.

Once released, the app will appear on the App Store in the countries you selected. You can update it later by bumping the version in `app.config.js`, building again with EAS, submitting the new build, and submitting the new version for review.

---

## Checklist summary

| Step | Action |
|------|--------|
| 1 | Create app in App Store Connect; match Bundle ID to `com.lunchmeet.app`. |
| 2 | Fill version info, category, age rating, **privacy policy URL**, copyright. |
| 3 | Add **screenshots** (required sizes), description, keywords, **support URL**. |
| 4 | `eas build --profile production --platform ios` then `eas submit --platform ios --latest`. |
| 5 | In App Store Connect, select the build for the version; complete all required fields and review info. |
| 6 | Submit for review; answer compliance questions. |
| 7 | After approval, release manually or automatically. |

---

## Optional: EAS Submit profile for production

To make future submissions easier, you can add to `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@email.com",
      "ascAppId": "1234567890"
    }
  }
}
```

Get **ascAppId** from App Store Connect → your app → **App Information** → **Apple ID** (numeric). Then you can run:

```bash
eas submit --platform ios --latest --profile production
```

---

## Common issues

- **Missing compliance:** Fill in the export/compliance and advertising (IDFA) questions correctly.
- **Rejection for login:** Provide a demo account and clear notes so reviewers can test.
- **Privacy policy / support URL:** Both are required; add them before submitting.
- **Screenshots:** At least one screenshot per required device size; use simulator or device captures.

Once you’ve done this once, future updates are: bump version → build → submit → add new version in App Store Connect → submit for review.
