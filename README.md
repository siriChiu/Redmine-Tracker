# Redmine Tracker

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge) 
![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-39.2.3-blueviolet?style=for-the-badge)
![React](https://img.shields.io/badge/React-19.2.0-61dafb?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.11+-yellow?style=for-the-badge)

**A premium desktop companion for Redmine that transforms time tracking into a seamless, visual, and automated experience.**

[Features](#-features) • [User Guide](#-user-guide) • [Installation](#-installation) • [Development](#-development) • [Release](#-release)

</div>

---

## ✨ Features

**Redmine Tracker** replaces the tedious, manual process of logging time with a streamlined workflow designed for professionals.

*   **� Interactive Dashboard**: Get an instant pulse check of your day with real-time hours tracking and weekly analytics.
*   **�📝 Smart Daily Planner**: Plan your day, track tasks, and batch-log time to Redmine with a single click.
*   **📅 Visual Calendar**: Drag-and-drop interface to review your history, complete with visual cues for lunch breaks and work hours.
*   **⚙️ Intelligent Profiles**: Save complex task templates (Issue ID, Activity, Comments) for one-click reuse.
*   **🔔 Automated Workflows**: Auto-log tasks at the end of the day and get reminders if you forget.
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

---

## 🛠️ Installation

### Prerequisites
*   **Node.js** (v18 or higher)
*   **Python** (v3.11 or higher)
*   **Git**

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
*Note: This runs the included CLI script (`bin/cli.js`), which currently provides setup information.*

---

## �💻 Development Guide

The application uses a concurrent architecture to run the Frontend (Vite/React), Backend (FastAPI), and Electron wrapper simultaneously.

### Project Structure
*   `src/`: React Frontend (TypeScript, Vite)
*   `electron/`: Electron Main Process
*   `backend/`: Python FastAPI Server

### Running Locally
To start the development environment with hot-reloading:

```bash
npm run dev
```
*   **Frontend**: `http://localhost:5173`
*   **Backend**: `http://127.0.0.1:8000` (Swagger UI at `/docs`)

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

### Debug Build
If you need to troubleshoot startup issues in the production build, create a version with a visible backend console:

```bash
npm run dist:debug
```

### Troubleshooting Releases
*   **Port 8000 Busy**: If the app crashes with `[Errno 10048]`, it means a previous instance didn't close cleanly. Use Task Manager to kill `backend.exe`.
*   **Missing DLLs**: If the backend fails to start on a new machine, ensure the Visual C++ Redistributable is installed.

---

<div align="center">

**Redmine Tracker** — *Effortless Time Tracking for Professionals*

</div>
