# Android dev setup (WSL2)

This project is developed from WSL2. The Windows-side Android SDK at `/mnt/d/android/sdk`
does NOT work for local builds here — `sdkmanager`/Gradle can't parse its package
metadata correctly over the DrvFs mount (fails with `Failed to find target with hash
string 'android-36'`). A separate Linux-native SDK lives at `~/Android/Sdk` instead, used
via `android/local.properties` (`sdk.dir=/home/<you>/Android/Sdk` — gradle needs an absolute path).

## One-time setup (already done)

- Linux `adb` installed: `sudo apt install -y openjdk-17-jdk android-tools-adb`
- Native SDK installed under `~/Android/Sdk` via `cmdline-tools/latest/bin/sdkmanager`:
  `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, `build-tools;35.0.0`,
  `ndk;27.1.12297006`, `cmake;3.22.1`
- `android/gradle.properties` has `android.builder.sdkDownload=false` (auto-download of
  missing SDK components fails the same way the Windows mount does).

## Connect to phone (wireless adb, per session)

adb's connection drops between sessions/reboots, but pairing persists. Phone needs
**Developer Options → Wireless debugging** enabled and on the same Wi-Fi network.

```bash
# if already paired before, just reconnect (IP:port shown on the phone's
# Wireless debugging screen, NOT the pairing screen):
adb connect <phone-ip>:<port>

# if that fails (not paired yet / re-paired), pair first using
# "Pair device with pairing code" on the phone:
adb pair <phone-ip>:<pairing-port> <6-digit-code>
adb connect <phone-ip>:<port>

adb devices -l   # confirm device shows up
```

## Build + install on phone

Expo Go can't be used — the project's Expo SDK version is newer than what's published
on the Play Store, so it must run via a local dev-client build instead.

```bash
ANDROID_HOME=$HOME/Android/Sdk PATH="$HOME/Android/Sdk/platform-tools:$PATH" npx expo run:android
```

This builds the debug APK with Gradle and installs/launches it on whatever device
`adb devices` currently shows. First build after `npm install` changes can take a
few minutes; incremental builds are much faster.

## Just running Metro after the dev client is installed

Once the dev client APK is installed once, you don't need to rebuild every time —
just start Metro and reload the app on the phone:

```bash
ANDROID_HOME=$HOME/Android/Sdk PATH="$HOME/Android/Sdk/platform-tools:$PATH" npx expo start
```

## Troubleshooting

- `spawn .../adb ENOENT`: `ANDROID_HOME` is pointing at the Windows-mounted SDK
  (`/mnt/d/android/sdk`), which only has `adb.exe` (not Linux-executable). Use the
  `ANDROID_HOME=$HOME/Android/Sdk` override shown above.
- `Failed to find target with hash string 'android-36'` / `Failed to find Build Tools
  revision ...` / `CMake '3.22.1' was not found`: a required SDK component is missing
  from `~/Android/Sdk`. Install it directly, e.g.:
  ```bash
  ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=~/Android/Sdk "build-tools;35.0.0"
  ```
- `adb: failed to connect`: wireless debugging was toggled off/on on the phone, which
  changes the port. Re-check the phone's Wireless debugging screen for the current
  IP:port and `adb connect` again.
