# Redmine Tracker

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge) 
![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-39.2.3-blueviolet?style=for-the-badge)
![React](https://img.shields.io/badge/React-19.2.0-61dafb?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.11+-yellow?style=for-the-badge)

**A premium desktop companion for Redmine that transforms time tracking into a seamless, visual, and automated experience.**

[Features](#-features) • [User Guide](#-user-guide) • [Installation](#-installation) • [Development](#-development-guide) • [CI/CD](#-gitea-actions-cicd) • [Release](#-release-guide)

</div>

---

## ✨ Features

**Redmine Tracker** replaces the tedious, manual process of logging time with a streamlined workflow designed for professionals.

*   **� Interactive Dashboard**: Get an instant pulse check of your day with real-time hours tracking and weekly analytics.
*   **�📝 Smart Daily Planner**: Plan your day, track tasks, and batch-log time to Redmine with a single click.
*   **📅 Visual Calendar**: Drag-and-drop interface to review your history, complete with visual cues for lunch breaks and work hours.
*   **✉️ Outlook Import**: Read classic Outlook locally, map meeting titles to Redmine defaults, and batch-log selected meetings without a second sign-in.
*   **⚡ Inline Issue Creation**: Pick a project and either reuse an open issue or create a new issue directly inside Log Time.
*   **⭐ Favorite Projects**: Keep the Log Time project picker focused on up to 20 frequently used projects, with one-click access to the full list.
*   **⚙️ Intelligent Profiles**: Save complex task templates (Issue ID, Activity, Comments) for one-click reuse.
    Issues created from Log Time are automatically saved as uniquely named Profiles after setup, so they can be reused immediately.
*   **🔔 Automated Workflows**: Auto-log tasks and show a topmost Windows warning when the daily 8-hour or Friday 40-hour target is still incomplete.
*   **🌑 Premium UI**: A distraction-free, glassmorphism-inspired dark mode interface.
*   **🔒 Privacy First**: All settings and data are stored locally on your machine.

---

## 📖 User Guide

### 1. The "Focus First" Workflow
The application is built around a simple 3-step loop: **Plan ➝ Track ➝ Log**.

#### **Plan**
*   Open the **Daily Planner**.
*   Use **Profiles** to quickly load recurring tasks (e.g., "Daily Standup").
*   Set your **Planned Hours** for each task.

#### **Track**
*   Tasks sit in your list as you work.
*   **Auto-Log**: If enabled, tasks will automatically push to Redmine at your set time (e.g., 6:00 PM).
*   **Pause**: Stepping away? Pause a task to exclude it from the auto-log cycle.

#### **Log**
*   Click the **Clock Icon** 🕑 to instantly log a task.
*   The task turns **Green** and locks, giving you a satisfying sense of completion.

### 2. Visualizing Your Time
*   **Dashboard**: Check the "Weekly Overview" bar chart to ensure you're maintaining a balanced schedule.
*   **Calendar**: Switch between Weekly and Monthly views to audit your past entries. Gaps in your schedule (like lunch) are automatically visualized.

### 3. Deep Diving into Projects
*   Navigate to the **Projects** view.
*   Select a **Profile** to instantly fetch live data from Redmine.
*   View status, priority, due dates, and read through the latest history/journals without opening a browser.

### 4. Importing Outlook Meetings

*   Open **Outlook Import** and choose a date range.
*   Add a title rule such as `Platform Weekly`, then choose its default Project and optional Issue.
*   Save the mapping. Matching meetings also appear in **Calendar** and open the unified Log Time window.
*   Select mapped meetings in Outlook Import to log several at once. Previously logged occurrences are protected from duplicates.
*   This integration uses the signed-in profile from **classic Outlook for Windows**. Outlook remains read-only.

When creating an Issue inline, the app supplies the required `HW Version`, `FW Version`,
`Issue Finder`, and `Bug Create After MP` custom fields. Their most recent values are
remembered locally. Worklogs always use `RD Function Team = SW_OS/BSP`.

See [UX_ARCHITECTURE.md](UX_ARCHITECTURE.md) for the design decisions, failure states, privacy model, and recommended next improvements.

---

## 🛠️ Installation

### Prerequisites
*   **Windows 10/11** (the Outlook integration and packaged backend use Windows APIs)
*   **Node.js** (v20 recommended; v18 or higher)
*   **Python** (v3.11 or higher)
*   **Git**
*   **Classic Outlook for Windows** with a signed-in profile, when Outlook import is required

### Quick Start

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd redmine-tracker
    ```

2.  **Install Frontend Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Python Backend**
    ```bash
    # Create virtual environment
    python -m venv .venv
    
    # Activate (Windows)
    .\.venv\Scripts\activate
    
    # Install dependencies
    pip install -r backend/requirements.txt
    ```

4.  **Launch Application**
    ```bash
    npm run dev
    ```

---

## � Usage via npx

You can execute the setup/info script directly from the repository without cloning manually if you have access to the internal Gitea:

```bash
# This will run the repository's CLI script
npx -y git+https://git.sw.ciot.work/Team/Redmine-Tracker.git#v1.0
```
*Note: This runs the interactive setup wizard in `bin/cli.js`. Run it with `--help` for non-interactive usage information.*

---

## �💻 Development Guide

The application uses a concurrent architecture to run the Frontend (Vite/React), Backend (FastAPI), and Electron wrapper simultaneously.

### Project Structure
*   `src/`: React Frontend (TypeScript, Vite)
*   `electron/`: Electron Main Process
*   `backend/`: Python FastAPI Server
*   `config/`: Sanitized example configuration included in release archives
*   `scripts/`: Reusable validation, smoke-test, packaging, and Gitea publishing scripts
*   `.gitea/workflows/`: Gitea Actions CI and tag release workflows

### Running Locally
To start the development environment with hot-reloading:

```bash
npm run dev
```
*   **Frontend (development)**: Electron starts Vite on the first available port from `5173`; it is not fixed.
*   **Backend**: Electron selects the first available port in `8000-8099` and passes it to the UI. If that range is full, Windows assigns another free local port automatically.

### Local validation

The CI checks can be reproduced on Windows after installing Node and Python dependencies:

```powershell
npm run ci:validate
npm run ci:syntax
npm run test:backend
npm run build:backend
npm run build
npm run ci:verify
node bin/cli.js --help
npm run ci:smoke
```

`ci:validate` parses `package.json`, `package-lock.json`, workflow YAML, and the example YAML configuration. TypeScript configuration is validated by `npm run build`. `ci:syntax` parses PowerShell, JavaScript, and Python scripts before packaging.

---

## 📦 Release Guide

### Building for Production
To create an optimized installer (Windows `.exe`):

```bash
npm run dist
```
*   This packages the Python backend into a single executable using `PyInstaller`.
*   It builds the React frontend.
*   It bundles everything into an Electron installer using `electron-builder`.
*   **Output**: Check the `release/` directory.

### Build outputs

| Output | Produced by | Purpose |
| --- | --- | --- |
| `dist/index.html` and `dist/assets/` | `npm run build` | Vite/React production frontend |
| `backend/dist/backend.exe` | `npm run build:backend` | Standalone FastAPI backend |
| `release/Redmine Tracker v<app-version>.exe` | `npm run dist` | Electron NSIS installer |
| `release-bundle/redmine-tracker-<tag>-windows-x64.exe` | CD packaging | Tag-versioned installer |
| `release-bundle/redmine-tracker-<tag>-windows-x64.tar.gz` | CD packaging | Installer, README, `VERSION`, and sanitized config archive |
| `release-bundle/SHA256SUMS` and `VERSION` | CD packaging | Integrity hashes and exact release tag |
| `release-bundle/latest/` | CD packaging | Stable filenames for the `latest` Generic Package alias |

### Debug Build
If you need to troubleshoot startup issues in the production build, create a version with a visible backend console:

```bash
npm run dist:debug
```

### Troubleshooting Releases
*   **Port already busy**: The app normally avoids occupied ports automatically. If a bind error still occurs because of a startup race, close stale `backend.exe`, `electron.exe`, or Vite processes and relaunch.
*   **Missing DLLs**: If the backend fails to start on a new machine, ensure the Visual C++ Redistributable is installed.

---

## 🚦 Gitea Actions CI/CD

The workflows are intentionally Windows-native because the backend depends on `pywin32`, reads classic Outlook through COM, and the release is an NSIS `.exe`. No cross compiler is used or supported by the current pipeline. The Gitea runner label `windows-latest` must resolve to a Windows runner with PowerShell, Node setup support, Python setup support, `curl.exe`, and `tar.exe`.

### Trigger rules

*   **CI** (`.gitea/workflows/ci.yml`) runs for every branch push and every pull request. Tag pushes are handled only by CD.
*   **CD** (`.gitea/workflows/release.yml`) runs only when a tag is pushed, for example `v1.00`.

CI checks out the repository, installs locked Node dependencies and Python build dependencies, validates JSON/YAML/configuration and script syntax, runs backend tests, builds the backend and frontend, verifies their outputs, runs `redmine-tracker --help`, and starts the packaged backend briefly on a dynamically selected free port.

CD repeats the validation and tests, runs `npm run dist`, verifies the NSIS installer, builds the versioned and `latest` package directories, verifies the expected package files, publishes Generic Packages, creates or reuses the matching Gitea Release, and uploads the same versioned artifacts as Release assets.

### Generic Packages and Releases

| Distribution | Best for | Behavior |
| --- | --- | --- |
| Gitea Generic Package | Scripts, updaters, and stable machine-readable URLs | Publishes the immutable tag version and a refreshed `latest` alias |
| Gitea Release assets | People browsing the repository release page | Attaches the versioned installer, archive, checksums, and `VERSION` to the tag release |

The package name is `redmine-tracker`. A tag version is immutable: an HTTP `409 Conflict` means that file already exists and is skipped. Before uploading `latest`, CD deletes the old `latest` package version and recreates it. `latest/VERSION` always contains the real tag, so clients can resolve what `latest` currently means. Existing Release assets that return `409 Conflict` are also skipped.

Versioned download examples for tag `v1.00`:

```text
https://git.sw.ciot.work/api/packages/Team/generic/redmine-tracker/v1.00/redmine-tracker-v1.00-windows-x64.exe
https://git.sw.ciot.work/api/packages/Team/generic/redmine-tracker/v1.00/redmine-tracker-v1.00-windows-x64.tar.gz
https://git.sw.ciot.work/api/packages/Team/generic/redmine-tracker/v1.00/SHA256SUMS
```

Latest download examples:

```text
https://git.sw.ciot.work/api/packages/Team/generic/redmine-tracker/latest/redmine-tracker-windows-x64.exe
https://git.sw.ciot.work/api/packages/Team/generic/redmine-tracker/latest/redmine-tracker-windows-x64.tar.gz
https://git.sw.ciot.work/api/packages/Team/generic/redmine-tracker/latest/VERSION
```

Private packages require authentication, for example `curl.exe -H "Authorization: token <token>" <download-url>`. Public packages can be downloaded without the header if the Gitea instance permits anonymous package access.

### Required secrets and permissions

The release workflow declares these permissions:

```yaml
permissions:
  contents: read
  packages: write
  releases: write
```

Configure repository or organization Actions secrets as needed:

*   `PACKAGE_TOKEN` — preferred token for Generic Package upload and deleting/recreating `latest`.
*   `RELEASE_TOKEN` — preferred token for creating releases and uploading Release assets.
*   `GITEA_TOKEN` — Gitea Actions token used as the fallback. Gitea normally injects this secret automatically, subject to repository and instance policy.

Package authentication precedence is `PACKAGE_TOKEN`, then `GITEA_TOKEN`. Release authentication precedence is `RELEASE_TOKEN`, then `GITEA_TOKEN`, then `PACKAGE_TOKEN`. The selected personal access token must belong to a user that can write packages for the owner and create releases in this repository.

### Publishing a release

Create and push a tag only after CI succeeds on the intended commit:

```bash
git tag v1.00
git push origin v1.00
```

For a local packaging-only simulation that does not publish anything:

```powershell
npm run dist
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-release.ps1 -Tag v1.00
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-artifacts.ps1 -Mode Package
```

---

<div align="center">

**Redmine Tracker** — *Effortless Time Tracking for Professionals*

</div>
