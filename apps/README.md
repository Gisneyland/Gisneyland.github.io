# 原生 App 殼

兩個殼 app 都載入線上網站 `https://gisneyland.github.io/`，網站更新後 app 自動同步；網站程式碼不受影響（`apps/` 已在 `_config.yml` 排除，不會被 Jekyll 發佈）。

- `android/`：Capacitor。`npm install && npm run build:apk`（需 JDK 17 與 Android SDK），輸出 `android/android/app/build/outputs/apk/debug/`。
- `desktop/`：Tauri v2（Linux AppImage / deb / rpm）。需 Rust 與 WebKitGTK，`npm install && npm run build`。

也可在 GitHub Actions 手動執行 **Build apps**，或推送 `app-v*` tag，從 artifacts 下載。

## 覆蓋更新

- **Android**：CI 以固定 keystore 簽署 release APK，`versionCode` 取自 workflow run number（每次遞增），新 APK 可直接覆蓋安裝。**keystore 請永久保管，遺失後無法覆蓋更新。** 一次性設定：
  1. `keytool -genkeypair -v -keystore release.jks -alias gisneyland -keyalg RSA -keysize 2048 -validity 36500`
  2. 在 repo Secrets 設定 `ANDROID_KEYSTORE_BASE64`（`base64 -w0 release.jks`）、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`。
- **Linux**：AppImage 直接取代舊檔即可；deb/rpm 需提高 `desktop/src-tauri/tauri.conf.json` 的 `version` 後安裝（會升級）。
- 網站內容本身不需更新 app，開啟時即為最新版。
