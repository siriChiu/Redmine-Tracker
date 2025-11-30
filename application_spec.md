# Redmine Tracker - Comprehensive Application Specification

## 1. Vision & Executive Summary
**Redmine Tracker** is a premium, desktop-first productivity suite engineered for developers, project managers, and creative professionals who rely on Redmine. It transforms the often tedious process of time tracking into a seamless, aesthetically pleasing, and highly efficient workflow.

By combining a **Daily Planner**, **Interactive Calendar**, and **Project Monitor** into a unified "Dark Mode" experience, Redmine Tracker bridges the gap between *planning work* and *logging work*. It operates with an "Offline First" philosophy, ensuring that productivity is never hampered by network instability.

## 2. Target Audience & Personas
*   **The Developer:** Wants to log 8 hours of work in under 10 seconds. Hates navigating slow web UIs. Values keyboard shortcuts, dark mode, and speed.
*   **The Project Manager:** Needs a quick overview of project status and their own time distribution without getting lost in Redmine's complex menus.
*   **The Freelancer:** Needs accurate time records for billing but forgets to log time until the end of the week. Needs reminders and visual gaps in their calendar.

## 3. Core Features & User Flows

### 3.1. Dashboard (The "Morning View")
**Goal:** Instant situational awareness.
*   **Hero Metric:** A massive, gradient-text display of "Hours Logged Today" vs. "Target (8h)".
*   **Visuals:**
    *   *Animation:* The hours counter counts up on load.
    *   *Background:* Glassmorphism cards with subtle gradients.
*   **Technical Implementation:**
    *   Fetches daily totals via `/api/redmine/daily_hours`.
    *   Data is cached to ensure instant load on app startup.

### 3.2. Daily Planner (The "Workhorse")
**Goal:** Plan -> Execute -> Log.
*   **Header Area:**
    *   **Title:** "Daily Planner" + Current Date (e.g., "10/27/2023").
    *   **Quick Settings Bar:** Inline controls for "Alert Time" and "Auto-Log Time" with "Test" buttons to verify notifications immediately.
*   **Task Entry Bar:**
    *   **Layout:** Horizontal flex container.
    *   **Inputs:**
        1.  *Load Saved Task:* Dropdown to pick a pre-configured Profile.
        2.  *Project:* Dropdown (Cached).
        3.  *Issue:* Dropdown (Cached, filters by Project).
        4.  *Hours:* Number input (Default 8.0).
        5.  *Add Button:* Green action button.
*   **Task List (The "Plan"):**
    *   **Card Style:** Stacked **Glassmorphism Panels** (`.glass-panel`).
    *   **Visual Status:**
        *   *Pending:* Orange border (`1px solid rgba(255, 152, 0, 0.5)`).
        *   *Logged:* Green border (`1px solid #4caf50`) + Green Glow (`box-shadow`).
    *   **Controls:**
        *   *Edit:* Task name is an editable input field.
        *   *Delete:* Trash icon (disabled if logged, unless confirmed).
*   **Footer:**
    *   **Total Planned:** Large text display of the sum of all planned hours (e.g., "Total Planned: 8.5h").

### 3.3. Calendar View (The "Record")
**Goal:** Verification and history.
*   **View Configuration:**
    *   **Mode:** `timeGridWeek` (Weekly view with time slots).
    *   **Scroll Start:** Auto-scrolls to **09:00 AM** on load.
    *   **Visible Range:** **07:00 AM - 09:00 PM** (`slotMinTime` / `slotMaxTime`) to focus on the workday.
    *   **Weekends:** Hidden (`weekends={false}`) to maximize screen space for Mon-Fri.
    *   **All-Day Slot:** Hidden (`allDaySlot={false}`) to force time-based logging.
*   **Visual Events:**
    *   **Time Entries:** Blue blocks (`var(--primary)`) showing "Hours - Comment".
    *   **Lunch Break:** A static gray background event from **12:00 PM - 1:00 PM** to visually demarcate the break.
    *   **Daily Status:** Background colors indicate if the day's target (8h) was met (Green tint vs. Orange tint).
*   **Interactions:**
    *   **Click Event:** Opens the **Time Entry Modal** pre-filled with the event's details.
    *   **Click Empty Slot:** Opens the Modal to create a new entry at that time.
    *   **Performance:** The modal uses `localStorage` to cache Projects and Issues, ensuring it opens instantly without API latency.

### 3.4. Project Monitor (The "Explorer")
**Goal:** Context without the browser.
*   **Project Grid:**
    *   **Layout:** Responsive grid (`repeat(auto-fill, minmax(300px, 1fr))`) of **Glassmorphism Cards** (`.glass-panel`).
    *   **Card Design:**
        *   *Header:* Project Name (H3) + ID (Subtext).
        *   *Action:* "Open ↗" button in the top-right corner to launch the project in the default browser.
        *   *State:* Active card has a highlighted border (`var(--primary)`).
    *   **Interaction:** Clicking anywhere on the card body triggers an **Accordion Expansion** to reveal the detailed view inline.
*   **Detailed Project View (Expanded State):**
    *   **Transition:** Smooth height animation (`0.3s ease`) reveals the content.
    *   **Subtabs:**
        *   *My Issues:* Issues assigned to the user (Default view).
        *   *All Issues:* All open issues in the project.
        *   *Activity:* Recent project activity stream.
    *   **Issue List:**
        *   *Style:* Vertical list with hover effects (`rgba(0,0,0,0.2)` background).
        *   *Item:* `#{id} {subject}` with text truncation for long titles.
        *   *Action:* Each item has its own "↗" icon to open that specific issue in the browser.
*   **Issue Detail Panel (Future/Rich View):**
    *   *Layout:* Clicking an issue opens a detailed view (side panel or split view).
    *   *Content:* Displays full description (HTML rendered), status, priority, start/due dates, and custom fields.
    *   *Metadata:* Rich display of "Assigned To", "Author", and "Fixed Version".
*   **Deep Linking:** All "Open ↗" actions use `shell.openExternal` to ensure they launch in the user's default system browser (Chrome/Edge) rather than inside the Electron window.

### 3.5. Settings & Configuration
**Goal:** Set and forget.
### 3.5. Settings & Configuration
**Goal:** Set and forget.
*   **General Tab:**
    *   **Redmine Configuration:**
        *   *API Key:* Secure password input (masked).
        *   *Redmine URL:* Configurable base URL (e.g., `http://redmine.example.com`).
    *   **Data Synchronization:**
        *   *Manual Sync:* "Sync Data from Redmine" button to force a refresh of Projects, Issues (assigned to me), Activities, and recent Time Entries.
        *   *Status:* Displays last sync time or error messages.
*   **Saved Profiles Tab:**
    *   **Management:** List of saved task profiles with "Delete" option.
    *   **Creation:** Form to create new profiles by "Project" or "Issue ID".
    *   **Fields:** Profile Name, Default Comment, Project/Issue selection.

## 4. UI/UX Design Specification

### 4.1. Design Philosophy
*   **Frameless Window:**
    *   The application runs in a frameless Electron window (`frame: false`) for a modern, floating app aesthetic.
    *   **Custom Title Bar:** A drag-enabled header (`-webkit-app-region: drag`) with a custom "Close" button and application title.
*   **Glassmorphism:** High usage of `backdrop-filter: blur(12px)`, semi-transparent backgrounds (`rgba(30, 30, 36, 0.7)`), and subtle white borders (`1px solid rgba(255, 255, 255, 0.08)`).
*   **Depth:** Use of shadows and layering to create hierarchy.
*   **Motion:**
    *   *Transitions:* All hover states and page navigations have `0.3s ease` transitions.
    *   *Feedback:* Buttons scale down slightly on click.

### 4.2. Color Palette (Dark Mode)
| Variable | Value | Usage |
| :--- | :--- | :--- |
| `--bg-dark` | `#0f0f13` | Main app background |
| `--bg-card` | `#1e1e24` | Card / Panel background |
| `--primary` | `#646cff` | Primary buttons, active states |
| `--accent-gradient` | `linear-gradient(135deg, #646cff 0%, #9f55ff 100%)` | Headers, Hero Text |
| `--text-primary` | `rgba(255, 255, 255, 0.92)` | Headings, Body text |
| `--text-secondary` | `rgba(255, 255, 255, 0.6)` | Labels, Subtitles |

## 5. Technical Architecture & Data Strategy

### 5.1. Tech Stack
*   **Frontend:** React 18+, TypeScript, Vite.
*   **Backend:** Python 3.11, FastAPI.
*   **Runtime:** Electron (Main Process), Node.js (IPC).

### 5.2. Data Persistence (The "Offline Brain")
All data is stored locally to ensure persistence and offline capability.

#### 5.2.1. `settings.yaml`
Stores sensitive configuration and profiles.
```yaml
api_key: "encrypted_key"
redmine_url: "https://redmine.example.com"
profiles:
  - name: "Daily Standup"
    project_id: 123
    issue_id: 456
```

#### 5.2.2. `tasks.json` (The Local Plan)
Stores the user's daily plan. We use JSON (parsed from YAML logic in backend) for robust structure.
```json
[
  {
    "id": "uuid-v4",
    "date": "2023-10-27",
    "name": "Implement Login",
    "planned_hours": 4.0,
    "redmine_issue_id": 101,
    "is_logged": false,
    "last_logged_date": "2023-10-27",
    "time_entry_id": 12345
  }
]
```

#### 5.2.3. `cache_data.yaml` (The Backend Cache)
Primary offline storage for Redmine data, populated via `/api/sync`.
*   `projects`: List of all projects.
*   `issues`: List of issues assigned to the user.
*   `activities`: Activity ID map.
*   `time_entries`: Recent time entries (last 30 days).
*   `issue_details`: Detailed metadata for specific issues (fetched on demand).

#### 5.2.4. Browser Cache (`localStorage`)
Used for high-speed UI state and preferences.
*   `planner_alert_time`: User preference for notifications.
*   `planner_auto_log_time`: User preference for auto-logging.
*   `redmine_projects`: UI cache of projects list.

### 5.3. API Endpoints (Localhost)
*   **Tasks & Planner:**
    *   `GET /api/tasks`: Get tasks (supports `date_str` filter).
    *   `POST /api/tasks`: Create task.
    *   `PUT /api/tasks/{id}`: Update task.
    *   `DELETE /api/tasks/{id}`: Delete task (optional `delete_from_redmine` param).
    *   `POST /api/planner/log_batch`: Log multiple tasks to Redmine.
*   **Redmine Data (Cached/Proxy):**
    *   `GET /api/redmine/projects`: Get all projects.
    *   `GET /api/redmine/issues`: Get issues (supports `scope="me"` or `all`).
    *   `GET /api/redmine/issue/{issue_id}`: Get detailed issue metadata + journals.
    *   `GET /api/redmine/activities`: Get activity types.
    *   `GET /api/redmine/daily_hours`: Get total hours logged today.
    *   `GET /api/redmine/time_entries`: Get entries (supports date range).
    *   `POST /api/redmine/time_entries`: Create new time entry.
*   **System:**
    *   `POST /api/sync`: Trigger manual sync of all Redmine data to `cache_data.yaml`.
    *   `GET /api/settings`: Get configuration.
    *   `POST /api/settings`: Save configuration.
    *   `GET /api/profiles`: Get saved profiles.
    *   `POST /api/profiles`: Save/Update profile.
    *   `DELETE /api/profile`: Delete profile.

## 6. Security & Privacy
*   **API Key:** Stored locally in `settings.yaml`.
*   **Network:** Direct connection to Redmine instance.
*   **IPC Security:** `contextBridge` exposes only safe methods.

## 7. Future Roadmap
*   **Phase 2:**
    *   **Pomodoro Timer:** Integrated focus timer linked to tasks.
    *   **Tray Application:** Minimize to tray.
*   **Phase 3:**
    *   **Team View:** See availability of team members.
    *   **Analytics:** Weekly/Monthly velocity charts.
