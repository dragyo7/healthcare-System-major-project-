# MedAI Android & Web Application Integration Report

> **Authoritative Technical Document: Android Architecture, Parity Analysis & Build Verification**  
> **Repository Root**: `E:\Major Project Code`  
> **Capacitor Application Name**: `MedAI`  
> **Android Package Identifier**: `com.abhyudaya.medai`  
> **Workspace Roots**: `frontend/` (prototype unified app) & `Portal Major P/` (active 3-role portal suite)  
> **Date**: October 2026  

---

## 1. Executive Summary & Android Classification

| Dimension | Technical Finding | Status / Classification |
| :--- | :--- | :--- |
| **Architectural Type** | Pure Capacitor WebView Wrapper | **Classified as Type 1 (Capacitor Wrapper)** |
| **Native Kotlin/Java Logic** | Minimal wrapper only (`MainActivity.java` extends `BridgeActivity`) | **Zero Custom Native Modules** |
| **Package ID** | `com.abhyudaya.medai` | **Verified** in `AndroidManifest.xml` & `build.gradle` |
| **Web Asset Root** | `frontend/dist` -> `frontend/android/app/src/main/assets/public` | **Synchronized via `npx cap sync android`** |
| **Android Build Verification** | Gradle 8.14.3 + AGP 8.13.0 on OpenJDK 21 | **Verified (`BUILD SUCCESSFUL in 45s`, APK: 4.44 MB)** |
| **Device Execution** | No physical device or emulator attached via ADB | **BLOCKED (No target attached; static and packaging verified)** |

---

## 2. Source Code & Layout Audit

### 2.1 File & Module Inventory

* **Configuration**: `frontend/capacitor.config.json`
  ```json
  {
    "appId": "com.abhyudaya.medai",
    "appName": "MedAI",
    "webDir": "dist"
  }
  ```
* **Native Entrypoint**: `frontend/android/app/src/main/java/com/abhyudaya/medai/MainActivity.java`
  ```java
  package com.abhyudaya.medai;
  import com.getcapacitor.BridgeActivity;
  public class MainActivity extends BridgeActivity {}
  ```
* **Manifest Permissions**: `frontend/android/app/src/main/AndroidManifest.xml`
  * Declares `android.permission.INTERNET`
  * Declares `MainActivity` with `android.intent.action.MAIN` and `android.intent.category.LAUNCHER`
  * Declares `androidx.core.content.FileProvider` for secure file sharing
  * No privileged SMS, location, or background telemetry permissions requested.
* **Ignored Build Outputs**:
  * `frontend/android/.gitignore` correctly ignores `app/src/main/assets/public`, `local.properties`, `build/`, `.gradle/`, and `.idea/`.

---

## 3. Relationship: `frontend/` vs. `Portal Major P/` (Parity Matrix)

The repository contains two distinct web application surfaces:
1. **`frontend/`**: The original unified single-SPA prototype containing patient and doctor layouts, client-side routing, mock fallback services, and Capacitor configuration for Android packaging.
2. **`Portal Major P/`**: The production-grade, 3-role clinical portal ecosystem built during subsequent phases:
   * **Doctor Portal (`Portal Major P/Bhumi/Doctor portal/frontend`)**: Port 5173, connected to Express Gateway on port 5000.
   * **Receptionist Portal (`Portal Major P/Ketki/receptionist_frontend`)**: Port 5174, connected to Express Gateway on port 5000.
   * **Patient Portal (`Portal Major P/patient_frontend`)**: Port 5175, connected to Express Gateway on port 5000.

### Feature & Parity Matrix

| Feature / Workflow | Prototype `frontend/` (Android Wrapper) | Active 3-Role Suite (`Portal Major P/`) | Parity Status |
| :--- | :--- | :--- | :--- |
| **Gateway Hub Architecture** | Configurable via `VITE_API_URL` (defaults to port 8000/mock) | Strictly calls Express Hub on port 5000 | **Architectural Migration** |
| **Doctor Workflows** | Static mock data / direct `/cds-assistant` | Full clinical consultations, OCR review, discharge orders | **Enhanced in Portal** |
| **Receptionist Intake** | Not present | Queue management, patient intake, activation generation | **Exclusive to Portal** |
| **Patient Workflows** | Basic records / vitals / mock prescriptions | Self-registration, secure token activation, discharge view | **Hardened in Portal** |
| **Post-Discharge Instructions** | Not present | Structured orders, educational CDS guardrails | **Exclusive to Portal** |
| **Prescription OCR Pipeline** | Direct upload stub | Offline Tesseract.js, regex dosing, doctor-only confirmation | **Exclusive to Portal** |
| **Drug Safety Engine** | SIDER / DrugBank lookups | Integrated CDS Gateway (`/cds/evaluate`, `/cds/screen`) | **Full Parity via Hub** |
| **Multilingual Support** | Language dropdown stub | 4-language support (`en`, `hi`, `mr`, `gu`), translation fallback | **Enhanced in Portal** |

---

## 4. Build & Synchronization Verification Evidence

### Step 1: Web Application Production Build
* **Command**: `npm run build` (in `E:\Major Project Code\frontend`)
* **Exit Code**: `0`
* **Duration**: 822 ms
* **Artifacts Generated**:
  * `dist/index.html` (0.45 kB)
  * `dist/assets/index-8XBqgk_7.css` (53.83 kB)
  * `dist/assets/index-A0KdqFcb.js` (889.32 kB)

### Step 2: Capacitor Android Synchronization
* **Command**: `npx cap sync android`
* **Exit Code**: `0`
* **Duration**: 0.43 s
* **Operations**:
  * Copied web assets from `dist` to `android\app\src\main\assets\public` in 9.75ms
  * Created `capacitor.config.json` in `android\app\src\main\assets` in 1.04ms
  * Updated Android plugins in 14.25ms

### Step 3: Native Android Compilation
* **Command**: `.\gradlew.bat assembleDebug` (in `E:\Major Project Code\frontend\android`)
* **Exit Code**: `0`
* **Duration**: 45 s
* **Output APK**: `frontend\android\app\build\outputs\apk\debug\app-debug.apk` (4,440,219 bytes / 4.44 MB)
* **Metadata**: `frontend\android\app\build\outputs\apk\debug\output-metadata.json`

---

## 5. Security & Runtime Isolation

1. **Honest Handling of Optional Cloud Providers (`frontend/src/lib/supabase.js`)**:
   * Removed all fake fallback domains (`https://placeholder-domain-local.supabase.co`) and speculative network calls.
   * Exports `isSupabaseConfigured` boolean and returns null-safe fallback handlers.
   * In local prototype mode without Supabase environment variables, the app boots without crashing or firing unroutable DNS requests.
   * Local demo accounts (`doctor@medai.com`) function locally, while optional cloud-auth operations report an explicit configuration error.
2. **Gateway Boundary**:
   * For mobile devices connected over Wi-Fi / LAN, `localhost:5000` points to the mobile device itself.
   * In a networked environment, `VITE_API_URL` must be set to the host machine's LAN IP (e.g., `http://192.168.1.X:5000`), never directly to MySQL (3306) or private FastAPI (8000).
   * For USB-connected testing via ADB reverse proxy:
     ```powershell
     adb reverse tcp:5000 tcp:5000
     ```
3. **Sensitive Artifacts**:
   * No `local.properties`, keystores, passwords, or machine-specific SDK paths are committed to Git.
   * `build/` and asset outputs remain strictly gitignored.

---

## 6. How to Run & Build the Android Application

```powershell
# 1. Build the web distribution
cd "E:\Major Project Code\frontend"
npm run build

# 2. Sync web assets into the Android native wrapper
npx cap sync android

# 3. Compile the debug APK
cd android
.\gradlew.bat assembleDebug

# Output APK location:
# frontend\android\app\build\outputs\apk\debug\app-debug.apk

# 4. Install onto attached Android device / emulator (when target is connected):
adb devices -l
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb reverse tcp:5000 tcp:5000
```
