<div align="center">

<img src="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" width="88" alt="RoutineTracker icon" />

# RoutineTracker

**English** · [Português](README.pt-BR.md)

An Android app that logs, on its own and in the background, when you arrive at and leave your places (home, work, gym…), with a daily log, charts, goals and suggestions to add new places. Everything stays on your phone.

![Android](https://img.shields.io/badge/Android-292524?logo=android&logoColor=3DDC84)
![Capacitor](https://img.shields.io/badge/Capacitor_8-292524?logo=capacitor&logoColor=119EFF)
![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Java](https://img.shields.io/badge/Java-292524?logo=openjdk&logoColor=white)
![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-292524?logo=openstreetmap&logoColor=7EBC6F)

</div>

> The app interface is in Brazilian Portuguese.

## Features

- **Automatic logging** of arrivals and departures at your saved places, even with the app closed
- **Now**: where you are and for how long
- **Daily log** with a timeline bar of time spent at each place
- **Charts** and weekly **goals** (e.g. work hours, gym visits)
- **Place discovery**: detects long stays at unsaved places and suggests adding them
- **Map-based place setup** with address search (OpenStreetMap, no API key)
- **Daily summary** notification
- **JSON backup** and **CSV export** through the Android share sheet
- **Privacy**: no server; data never leaves the device

## How it works

- **Native geofences** (Google Play Services): Android does the monitoring, not the app, so battery use is close to zero and it works with the app closed.
- A low-power location reading every ~15 min (WorkManager) catches missed exits and detects stays at unsaved places.
- Android queues the events and the app processes them when opened (`src/core/engine.ts`).
- The logging, discovery and statistics logic is pure and covered by tests (`src/core/*.test.ts`).

```
Android (Java)                                   App (React + Capacitor)
 ├── GeofenceReceiver ── enter/exit ─────┐
 ├── SamplerWorker ───── reading ~15 min ─┼──► NativeStore ──► bridge.ts ──► core/engine.ts ──► screens
 ├── SummaryWorker ───── daily summary    │                                  core/discovery.ts
 └── BootReceiver ────── restores geofences after reboot                     core/stats.ts
```

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Leaflet |
| Native | Capacitor 8 + a custom Java plugin (geofences, WorkManager, notifications) |
| Maps | OpenStreetMap / Nominatim |
| Tests | `node:test` via `tsx` |
| CI | GitHub Actions: tests, build and a signed APK published to Releases |

## Installing on a phone

1. Open the **Actions** tab: the **Build APK** workflow runs on every push (or manually via *Run workflow*).
2. On the phone, open the repository's **Releases** page, download **RoutineTracker.apk** and install it. If Android asks, allow "install unknown apps" for the browser.
3. Open the app and follow the setup screen: **Location → "Allow all the time"**, notifications, and battery "Unrestricted".

To update, just `git push`: the new APK installs over the previous one without losing data, because every build is signed with the same key (`android/app/routinetracker.keystore`).

## Development

```bash
npm install
npm test          # pure logic (engine, discovery, statistics)
npm run dev       # UI in the browser (demo data under Config)
npm run build && npx cap sync android
```

## Known limitations

- Manufacturers such as Xiaomi, Samsung and Motorola may kill background apps: set battery to "Unrestricted".
- Android may take a few minutes to report a geofence enter or exit.
- Daily summary, new-place alert and status are best-effort notifications.
- The new-place alert covers a single long stay; repeated short visits show up in the Places tab.

> **Note:** the signing keystore is in the repository and its password is in `android/app/build.gradle` (personal use). **Keep this repository private.** Before making it public, move the keystore and password into GitHub Actions secrets.

## License

[MIT](LICENSE)
