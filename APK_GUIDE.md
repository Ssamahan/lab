# 📱 Ruli Lab Systems v4 — APK Version (Android) — Publish on GitHub

Your web app is now a **PWA** (manifest.json + sw.js) + **Capacitor Android wrapper** → generates APK that loads your live GitHub Pages link.

**Live Web:** https://ssamahan.github.io/ruli-lab-roster/
**APK Release:** https://github.com/Ssamahan/ruli-lab-roster/releases/tag/v4.0-latest

---

### 🚀 Option A — Automatic APK via GitHub Actions (Recommended, zero-cost)

I added `.github/workflows/build-apk.yml` that builds APK on every push to `main`.

**How it works:**
1. Push to `main` → GitHub Actions runs Ubuntu runner
2. Installs Node 18 + Capacitor CLI + Java 17 + Android SDK
3. `npx cap add android` (generates `android/` folder) + `npx cap copy`
4. `./gradlew assembleDebug` → `app-debug.apk` + `assembleRelease`
5. Uploads APK as artifact + creates **GitHub Release `v4.0-latest`** with APK attached

**To trigger:**
- Just push `index.html` or any file to `main` (already done)
- Go to **GitHub → Actions tab → Build APK** → see build logs
- After ~5-8 min, go to **Releases → v4.0-latest → Assets → Download `Ruli-Lab-v4-debug.apk`**
- Share that APK link with staff — install on Android (allow unknown sources)

**To create a versioned release:**
```bash
git tag v4.0.1
git push origin v4.0.1
```
→ Creates release `v4.0.1` with APK.

---

### 🔧 Option B — Build APK locally (Capacitor)

**Prerequisites:** Node.js 18+, Java 17+, Android Studio

```bash
# In repo root /home/user/ruli-lab-roster
npm install
npx cap init RuliLab rw.gov.ruli.lab --web-dir=.
npx cap add android
npx cap copy android
# Open in Android Studio
npx cap open android
# In Android Studio: Build → Build APK(s) → debug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

**Config** (`capacitor.config.json`):
```json
{
  "appId": "rw.gov.ruli.lab",
  "appName": "Ruli Lab",
  "webDir": ".",
  "server": { "url": "https://ssamahan.github.io/ruli-lab-roster/", "cleartext": true },
  "android": { "backgroundColor": "#0B1C3D" }
}
```
- `server.url` loads live GitHub Pages (always latest)
- If you want offline APK (no internet), set `server.url` to null and `webDir` to `.` — it will load local `index.html` bundled.

---

### 📲 Option C — Simple WebView wrapper (no Capacitor)

Create minimal Android Studio project:

**AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<application android:icon="@drawable/ic_launcher" android:label="Ruli Lab">
  <activity android:name=".MainActivity" android:exported="true">
    <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
  </activity>
</application>
```

**MainActivity.java (rw.gov.ruli.lab):**
```java
package rw.gov.ruli.lab;
import android.os.Bundle; import android.webkit.WebView; import android.webkit.WebViewClient; import androidx.appcompat.app.AppCompatActivity;
public class MainActivity extends AppCompatActivity {
  @Override protected void onCreate(Bundle savedInstanceState){
    super.onCreate(savedInstanceState);
    WebView wv=new WebView(this);
    wv.getSettings().setJavaScriptEnabled(true);
    wv.getSettings().setDomStorageEnabled(true);
    wv.setWebViewClient(new WebViewClient());
    wv.loadUrl("https://ssamahan.github.io/ruli-lab-roster/");
    setContentView(wv);
  }
}
```

Build → APK.

---

### 🔐 Logo & Branding for APK

- App icon uses your new gold blood drop + micropipette: `assets/favicon-192.png` (12KB) and `favicon-512.png` (54KB) copied to `android/app/src/main/res/drawable/ic_launcher.png` in workflow
- Splash screen gold #F7F8FC background, navy #0B1C3D, logo centered with glow
- Package ID `rw.gov.ruli.lab` — Rwanda gov style, unique for Play Store if you later publish

---

### 📦 Publish APK as GitHub Release (Manual)

If you build locally:

1. GitHub → Releases → Draft new release → Tag `v4.0.0` → Title `Ruli Lab v4.0 - APK`
2. Upload `app-debug.apk` (or release) as binary
3. Description:
```
Ruli District Hospital - Lab Systems v4
- Gold pipette logo
- Working Plan + Weekly Roster premium exports
- Live Firebase sync phone↔PC
- EmailJS real OTP
Live: https://ssamahan.github.io/ruli-lab-roster/
```
4. Publish release → get shareable link `https://github.com/Ssamahan/ruli-lab-roster/releases/download/v4.0.0/Ruli-Lab-v4-debug.apk`

---

### ⚡ Why APK?

- Staff without reliable internet can install APK and use offline (localStorage) + sync when online if Firebase enabled
- Appears in app drawer like native app, not browser tab
- Zero-cost, no Play Store needed — distribute via GitHub Releases link or WhatsApp

**Current status:** Workflow file added, manifest.json + sw.js added, PWA installable. First APK will be built on next push (already triggered by this commit). Check Actions tab in ~6 min.
