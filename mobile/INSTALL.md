# Install APEX Drafting on phones (no Expo Go)

These EAS builds install as a normal app icon. The API is already on Fly at `https://apex-angi-leads-api.fly.dev`. Every profile in `eas.json` bakes that URL in as `EXPO_PUBLIC_API_URL`, so after install you do **not** need Metro, a PC on the same Wi‑Fi, or Expo Go.

Local Expo Go (QR / LAN) is unchanged — see the root [README](../README.md). Do not commit `.env` or secrets.

## Expo login

From `mobile/`:

```bash
cd mobile
npx eas-cli login
```

Use a free [Expo](https://expo.dev) account.

This repo has no `extra.eas.projectId` in `app.json` yet — do not invent a UUID. The first `npx eas-cli init` or `npx eas-cli build` creates the Expo project and writes the real id. Bundle / package ids are already set: iOS `com.apexdrafting.leads`, Android `com.apexdrafting.leads`. The `expo-notifications` plugin is already in `app.json`.

## Android APK

```bash
cd mobile
npx eas-cli build -p android --profile preview
```

The **preview** profile builds an APK (`buildType: apk`). When EAS finishes, it prints an **install / download link**. Open that URL on the Samsung (or download the APK and share it). Allow install from unknown sources if Android asks.

Sign in as Jared or Reuben. Settings should show API `https://apex-angi-leads-api.fly.dev`. No Expo Go.

## iOS (Apple Developer)

iOS installable builds need an [Apple Developer Program](https://developer.apple.com/programs/) membership (~$99/year). Then:

```bash
cd mobile
npx eas-cli build -p ios --profile preview
```

- **Internal / ad hoc:** EAS gives an install link for devices registered on the Apple team.
- **TestFlight:** `npx eas-cli build -p ios --profile production` then `npx eas-cli submit -p ios --profile production` (or upload from expo.dev). Testers install via TestFlight.

Same Fly API is baked in. No Metro / Expo Go after install.

## Profiles

| Profile | What you get |
| --- | --- |
| `development` | Dev client, internal distribution |
| `preview` | Internal; Android **APK**; iOS device (not simulator) |
| `production` | Store / TestFlight; auto-increment version |

All three set `EXPO_PUBLIC_API_URL=https://apex-angi-leads-api.fly.dev`. API deploy notes: [DEPLOY.md](../DEPLOY.md).
