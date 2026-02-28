# Agent 8: Social Media Auth (Google & Apple)

**Task:** Users can sign in with Google or Apple in addition to email magic link.

**Scope:** AuthContext, login screen. Supabase Dashboard config (user must enable providers).

**Files to modify:**
- `src/AuthContext.tsx` - Add signInWithGoogle, signInWithApple. Use signInWithOAuth({ provider: "google"|"apple", options: { redirectTo } }). If data.url, redirect: window.location.href (web) or Linking.openURL (native).
- `app/login.tsx` - Add "or" divider, "Sign in with Google" button, "Sign in with Apple" button (Apple only on native, not web). On press call signInWithGoogle/signInWithApple, catch and setError.

**Instructions:**
1. signInWithOAuth returns { data: { url } }. Redirect user to that URL.
2. Supabase handles OAuth flow. User must enable Google and Apple in Supabase Dashboard > Authentication > Providers.
3. Add redirect URL in Supabase (e.g. app origin for web).
4. Style: socialButton (outlined), appleButton (black bg, white text).

**Note:** User must configure Google and Apple OAuth in Supabase Dashboard. Document this in README.

**Permissions:** You have full permission to edit AuthContext and login. Implement this feature completely.
