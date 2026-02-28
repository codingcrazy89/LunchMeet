# Agent 3: Safety Warning and Tips

**Task:** Show a safety warning and tips (e.g., meet in public, tell a friend, trust your instincts).

**Scope:** New components + layout changes. No database. Use AsyncStorage for "has seen tips" flag.

**Files to create:**
- `components/SafetyTipsModal.tsx` - Modal with warning text and bullet tips
- `constants/safetyTips.ts` - Static content (SAFETY_WARNING, SAFETY_TIPS array)

**Files to modify:**
- `app/(tabs)/_layout.tsx` - Show modal on first launch (check AsyncStorage key "lunchmeet_has_seen_safety_tips")
- `app/(tabs)/profile.tsx` - Add "View Safety Tips" button

**Instructions:**
1. Install @react-native-async-storage/async-storage if not present: `npx expo install @react-native-async-storage/async-storage`
2. Create safetyTips.ts with warning text and 5-7 tips (meet in public, tell a friend, trust instincts, stay sober, etc.).
3. Create SafetyTipsModal with overlay, scrollable content, "Got it" button.
4. In tabs layout: on mount, if user logged in and AsyncStorage key not "true", show modal. On close, set key to "true".
5. In profile: add Pressable "View Safety Tips" that opens the modal.

**Permissions:** You have full permission to create and edit these files. Implement this feature completely.
