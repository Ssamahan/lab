# 🚀 Ruli Lab Roster — Make it LIVE in 2 minutes (GitHub Pages)

Your app is READY. It's one file: `index.html`

## ✅ Fastest way — GitHub Pages (permanent link)

You already have GitHub profile: https://github.com/Ssamahan

### Step-by-step (do it on your phone or PC):

1. **Go to GitHub and create repo**
   - Open https://github.com/new
   - Repository name: `ruli-lab-roster`  (exactly this, lowercase)
   - Description: `Ruli DH Lab Smart Roster`
   - Make it **Public**
   - Check ✅ Add a README file (we will overwrite it)
   - Click **Create repository**

2. **Upload your app**
   - In the new repo, click **Add file → Upload files**
   - Drag these 3 files from this folder:
     - `index.html` (the app — REQUIRED)
     - `README.md`
     - `.nojekyll` (empty file — prevents GitHub errors)
   - Click **Commit changes**

3. **Turn on Pages (one click)**
   - Click **Settings** tab (top right of repo)
   - On left menu → **Pages**
   - Under **Build and deployment**:
     - Source: **Deploy from a branch**
     - Branch: **main** + **/ (root)** → Save
   - Wait 30-60 seconds, refresh page

4. **Your live link appears at top of Pages settings:**
   ```
   https://ssamahan.github.io/ruli-lab-roster/
   ```
   🎉 That's your permanent link! Share it with staff.

### How staff see it:
- Without Firebase: each device keeps its own copy, but staff cannot affect your master copy.
- With Firebase (recommended): staff become LIVE read-only observers — they always see your latest plan automatically.

## ☁️ Optional but recommended — True live observer mode (10 min once)

1. Go to https://console.firebase.google.com → Add project → name `ruli-lab-roster` → Disable Analytics → Create
2. Left menu: **Build → Realtime Database → Create database** → choose **Belgium (europe-west1)** → Start in **locked mode**
3. Tab **Rules** → replace with:
```json
{
  "rules": {
    "labRoster": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```
→ Publish

4. **Build → Authentication → Get started → Email/Password → Enable**
   → Users tab → Add user → your email + strong password (manager login)

5. Gear ⚙️ → Project settings → Your apps → click `</>` Web icon → register (no hosting) → copy the `firebaseConfig = {...}`

6. **Two ways to use it:**
   - **Easy (no code):** Open your live site `https://ssamahan.github.io/ruli-lab-roster/` → ☁️ Live Sync tab → paste config → Connect → Sign in → Push
   - **Zero-config for staff (best):** Paste that config into `index.html` at line `window.RULI_FIREBASE_CONFIG = ...` and re-upload. Then staff open link and are instantly observers — they never paste anything.

## 🔄 Updating the app later
Just upload new `index.html` to same repo → Commit → link stays same, updates in ~30 sec.

## 📱 Add to Home Screen (looks like an app)
Open live link on phone → browser menu ⋮ → Add to Home Screen.

## 🆘 If Pages says 404
- Make sure file is named exactly `index.html` (lowercase)
- Make sure `.nojekyll` file exists in repo root
- Wait 1 minute and hard refresh Ctrl+F5

---
Need me to hard-code Firebase for you? Just paste your `firebaseConfig` here and I'll embed it and give you a new `index.html` ready to upload — staff will then be auto-observers.
