# Safe Area Configuration for iPhone 11 and Notched Devices

## Changes Made

### 1. Root Layout (`app/_layout.tsx`)
- Added `StatusBar` component with `style="light"` for light-colored status bar text
- Wrapped entire app in `GestureHandlerRootView` for gesture support

### 2. Tab Layout (`app/(tabs)/_layout.tsx`)
- **BrandHeader**: Now uses `useSafeAreaInsets()` to get top inset
- Applied dynamic padding: `paddingTop: Math.max(insets.top, 12)`
- This ensures the logo and title are never blocked by the notch
- Removed fixed `paddingTop: 16` from styles

### 3. Login Screen (`app/login.tsx`)
- **BrandHeader**: Same safe area treatment as tab layout
- Uses `useSafeAreaInsets()` with dynamic padding
- Removed fixed `paddingTop: 16` from styles

### 4. Profile Detail Screen (`app/profile/[id].tsx`)
- Already configured with safe area insets (from earlier changes)
- BrandHeader uses `topInset` prop to respect notch

### 5. App Configuration (`app.json`)
- Added proper iOS and Android configuration
- Set app icons and splash screen
- Added bundle identifiers

## How It Works

**Safe Area Insets:**
- `insets.top`: Distance from top of screen to safe area (accounts for notch)
- `insets.bottom`: Distance from bottom to safe area (accounts for home indicator)
- `Math.max(insets.top, 12)`: Uses notch height or minimum 12px padding (whichever is larger)

**Result:**
- On iPhone 11 (and other notched devices): Logo appears below the notch
- On devices without notch: Logo has standard 12px padding
- StatusBar text is white/light colored for visibility on blue header
- All content respects safe areas automatically

## Testing
Restart the app on your iPhone 11. The logo should now appear below the notch with proper spacing, and all screens should respect the safe areas around the notch and home indicator.
