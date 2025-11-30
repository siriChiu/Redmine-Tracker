from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import sys
from pydantic import BaseModel
from typing import List, Optional
import yaml
import json

# Import the existing Redmine utility
# Adjust path if necessary since we moved files
sys.path.append(os.path.dirname(__file__))
from packages.redmine import redmine_utility as rm

app = FastAPI()



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/debug")
def debug_endpoint():
    return {"message": "Debug endpoint working", "routes": [r.path for r in app.routes]}

@app.delete("/api/profile")
def delete_profile(name: str):
    print(f"Attempting to delete profile: {name}")
    data = {}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            data = yaml.safe_load(f) or {}
    
    profiles = data.get('profiles', [])
    # Filter out the profile
    new_profiles = [p for p in profiles if p['name'] != name]
    
    if len(new_profiles) == len(profiles):
        return {"error": "Profile not found"}
        
    data['profiles'] = new_profiles
    
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(data, f)
        
    return {"status": "success", "message": "Profile deleted", "profiles": new_profiles}

# Data Models
class Settings(BaseModel):
    api_key: str
    redmine_url: Optional[str] = "http://advrm.advantech.com:3002/"
    alert_time: Optional[str] = "17:00"
    auto_log_time: Optional[str] = "18:00"

# Global Redmine Instance
redmine_client = None

# Determine AppData path for storing settings/data
if sys.platform == 'win32':
    app_data = os.getenv('APPDATA')
    DATA_DIR = os.path.join(app_data, 'RedmineTracker')
else:
    # Fallback for Linux/Mac (though this is a Windows app)
    home = os.path.expanduser("~")
    DATA_DIR = os.path.join(home, '.redmine_tracker')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

CONFIG_FILE = os.path.join(DATA_DIR, "settings.yaml")
CACHE_FILE = os.path.join(DATA_DIR, "cache_data.yaml")
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")

print(f"Data Directory: {DATA_DIR}")

def load_settings_data():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return yaml.safe_load(f) or {}
    return {}

def load_api_key():
    data = load_settings_data()
    return data.get('api_key')

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r') as f:
            try:
                return yaml.safe_load(f) or {}
            except:
                return {}
    return {}

def save_cache(data):
    with open(CACHE_FILE, 'w') as f:
        yaml.dump(data, f)

def get_redmine_client():
    global redmine_client
    if redmine_client:
        return redmine_client
    
    data = load_settings_data()
    api_key = data.get('api_key')
    url = data.get('redmine_url', 'http://advrm.advantech.com:3002/')

    if api_key:
        try:
            redmine_client = rm.Redmine(api_key, url)
            return redmine_client
        except Exception as e:
            print(f"Failed to init Redmine: {e}")
            return None
    return None

def update_cache_with_entry(entry_id):
    client = get_redmine_client()
    if not client:
        return
        
    try:
        entry = client.redmine.time_entry.get(entry_id)
        cache = load_cache()
        if 'time_entries' not in cache:
            cache['time_entries'] = []
            
        # Remove existing if any
        cache['time_entries'] = [e for e in cache['time_entries'] if e['id'] != entry_id]
        
        # Add new
        cache['time_entries'].append({
            "id": entry.id,
            "project": entry.project.name,
            "issue": entry.issue.id if hasattr(entry, 'issue') else None,
            "user": entry.user.name,
            "activity": entry.activity.name,
            "hours": entry.hours,
            "comments": entry.comments,
            "spent_on": str(entry.spent_on),
            "created_on": str(entry.created_on),
            "updated_on": str(entry.updated_on)
        })
        
        save_cache(cache)
    except Exception as e:
        print(f"Failed to update cache for entry {entry_id}: {e}")

def remove_from_cache(entry_id):
    cache = load_cache()
    if 'time_entries' in cache:
        cache['time_entries'] = [e for e in cache['time_entries'] if e['id'] != entry_id]
        save_cache(cache)

@app.post("/api/settings")
def save_settings(settings: Settings):
    data = load_settings_data()
            
    data['api_key'] = settings.api_key
    data['redmine_url'] = settings.redmine_url
    data['alert_time'] = settings.alert_time
    data['auto_log_time'] = settings.auto_log_time
    
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(data, f)
    
    # Re-init client
    global redmine_client
    redmine_client = rm.Redmine(settings.api_key, settings.redmine_url)
    return {"status": "success", "message": "Settings saved"}

@app.get("/api/settings")
def get_settings():
    data = load_settings_data()
    return {
        "api_key": data.get('api_key', ""),
        "redmine_url": data.get('redmine_url', "http://advrm.advantech.com:3002/"),
        "alert_time": data.get('alert_time', "17:00"),
        "auto_log_time": data.get('auto_log_time', "18:00")
    }

class Profile(BaseModel):
    name: str
    project_id: int
    issue_id: int
    activity_id: int
    comments: Optional[str] = ""
    rd_function_team: Optional[str] = "N/A"
    project_name: Optional[str] = None
    issue_name: Optional[str] = None

@app.get("/api/profiles")
def get_profiles():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            data = yaml.safe_load(f) or {}
            return data.get('profiles', [])
    return []

@app.post("/api/profiles")
def save_profile(profile: Profile):
    data = {}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            data = yaml.safe_load(f) or {}
    
    profiles = data.get('profiles', [])
    # Update existing or append
    existing = next((p for p in profiles if p['name'] == profile.name), None)
    if existing:
        existing.update(profile.dict())
    else:
        profiles.append(profile.dict())
    
    data['profiles'] = profiles
    
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(data, f)
        
    return {"status": "success", "message": "Profile saved", "profiles": profiles}



@app.get("/api/redmine/projects")
def get_projects():
    # Try cache first
    cache = load_cache()
    if 'projects' in cache:
        return cache['projects']

    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        projects = client.redmine.project.all(offset=0, limit=1000)
        project_list = [{"id": p.id, "name": p.name} for p in projects]
        project_list = sorted(project_list, key=lambda x: x['name'])
        
        # Update cache
        cache['projects'] = project_list
        save_cache(cache)
        
        return project_list
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/redmine/issues")
def get_issues(project_id: str, scope: str = "me"):
    # Try cache first (only for 'me' scope as that's what we sync)
    if scope == "me":
        cache = load_cache()
        if 'issues' in cache:
            # Filter cached issues by project_id
            try:
                pid = int(project_id)
                cached_issues = [i for i in cache['issues'] if i.get('project_id') == pid]
                return sorted(cached_issues, key=lambda x: x['subject'])
            except ValueError:
                pass

    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        # Fallback to API if not in cache or scope is 'all'
        
        # If scope is 'me', filter by assigned_to_id='me'
        # If scope is 'all', do not filter by assigned_to
        filters = {'project_id': project_id, 'status_id': 'open'}
        if scope == "me":
            filters['assigned_to_id'] = 'me'
            
        issues = client.redmine.issue.filter(**filters)
        issue_list = [{"id": i.id, "subject": i.subject, "project_id": i.project.id} for i in issues]
        
        return sorted(issue_list, key=lambda x: x['subject'])
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/redmine/issue/{issue_id}")
def get_issue_details(issue_id: int):
    # Try cache first
    cache = load_cache()
    # We'll store details in a separate map to avoid scanning the big list
    if 'issue_details' in cache and str(issue_id) in cache['issue_details']:
        details = cache['issue_details'][str(issue_id)]
        # Check if it has the new 'project' field (migration for stale cache)
        if 'project' in details:
            return details
        # If missing 'project', fall through to fetch from Redmine

    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        # Fetch with journals (notes)
        issue = client.redmine.issue.get(issue_id, include=['journals'])
        
        # Extract journals
        journals = []
        if hasattr(issue, 'journals'):
            for j in issue.journals:
                if hasattr(j, 'notes') and j.notes:
                    journals.append({
                        "user": j.user.name,
                        "created_on": j.created_on,
                        "notes": j.notes
                    })
        
        details = {
            "id": issue.id,
            "subject": issue.subject,
            "description": issue.description,
            "status": issue.status.name,
            "priority": getattr(issue.priority, 'name', '-'),
            "author": getattr(issue.author, 'name', '-'),
            "assigned_to": getattr(issue, 'assigned_to', None).name if getattr(issue, 'assigned_to', None) else '-',
            "category": getattr(issue, 'category', None).name if getattr(issue, 'category', None) else '-',
            "fixed_version": getattr(issue, 'fixed_version', None).name if getattr(issue, 'fixed_version', None) else '-',
            "start_date": str(issue.start_date) if getattr(issue, 'start_date', None) else '-',
            "due_date": str(issue.due_date) if getattr(issue, 'due_date', None) else '-',
            "done_ratio": issue.done_ratio,
            "estimated_hours": getattr(issue, 'estimated_hours', '-'),
            "spent_hours": getattr(issue, 'spent_hours', '-'),
            "created_on": str(issue.created_on) if getattr(issue, 'created_on', None) else None,
            "updated_on": str(issue.updated_on) if getattr(issue, 'updated_on', None) else None,
            "project": {
                "id": issue.project.id,
                "name": issue.project.name
            },
            "journals": journals,
            "url": f"{client.url.rstrip('/')}/issues/{issue.id}"
        }
        
        # Update cache
        if 'issue_details' not in cache:
            cache['issue_details'] = {}
        
        cache['issue_details'][str(issue_id)] = details
        save_cache(cache)
        
        return details
    except Exception as e:
        print(f"Error fetching issue {issue_id} from Redmine: {e}")
        # Fallback: Try to find in 'issues' list in cache
        if 'issues' in cache:
            cached_issue = next((i for i in cache['issues'] if i['id'] == issue_id), None)
            if cached_issue:
                project_id = cached_issue.get('project_id')
                project_name = "Unknown Project"
                if project_id and 'projects' in cache:
                    proj = next((p for p in cache['projects'] if p['id'] == project_id), None)
                    if proj:
                        project_name = proj['name']
                
                print(f"Found issue {issue_id} in cache fallback. Project: {project_id} ({project_name})")
                return {
                    "id": issue_id,
                    "subject": cached_issue.get('subject', ''),
                    "description": cached_issue.get('description', ''), # Might be missing
                    "status": "Unknown", # Missing in simple cache
                    "done_ratio": 0,
                    "project": {
                        "id": project_id,
                        "name": project_name
                    },
                    "journals": [],
                    "url": ""
                }
        return {"error": str(e)}

@app.get("/api/redmine/activities")
def get_activities():
    cache = load_cache()
    if 'activities' in cache:
        activities = cache['activities']
        # Check if cache is valid (keys should be numeric IDs as strings)
        # Old format had names as keys. New format has IDs as keys.
        is_valid = True
        if activities:
            first_key = next(iter(activities))
            if not str(first_key).isdigit():
                is_valid = False
        
        if is_valid:
            return activities

    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    activities = client.activity_map
    
    # Update cache
    cache['activities'] = activities
    save_cache(cache)
    
    return activities

class TimeEntry(BaseModel):
    project_id: Optional[int] = None
    issue_id: Optional[int] = None
    spent_on: str # YYYY-MM-DD
    hours: float
    activity_id: int
    rd_function_team: Optional[str] = "N/A"
    comments: Optional[str] = ""

@app.post("/api/redmine/time_entries")
def create_time_entry(entry: TimeEntry):
    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        print(f"Creating time entry: {entry}")
        
        custom_field_id = 93
        # Use provided value or default to N/A
        custom_field_value = entry.rd_function_team if hasattr(entry, 'rd_function_team') and entry.rd_function_team else 'N/A'
        
        # When issue_id is present, project_id is implied and optional.
        # Providing both might cause validation errors if there's any mismatch 
        # or if the API is strict. Let's try sending ONLY issue_id if it's present.
        
        time_entry_data = {
            'spent_on': entry.spent_on,
            'activity_id': entry.activity_id,
            'hours': entry.hours,
            'comments': entry.comments,
            'custom_fields': [{'id': custom_field_id, 'value': custom_field_value}]
        }
        
        if entry.issue_id:
            time_entry_data['issue_id'] = entry.issue_id
        else:
            time_entry_data['project_id'] = entry.project_id
            
        created_entry = client.redmine.time_entry.create(**time_entry_data)
        
        # Update Cache
        update_cache_with_entry(created_entry.id)
        
        return {"status": "success", "message": "Time entry created", "id": created_entry.id}
    except Exception as e:
        print(f"Error creating time entry: {e}")
        return {"error": str(e)}

@app.get("/api/redmine/time_entries")
def get_time_entries(from_date: Optional[str] = None, to_date: Optional[str] = None):
    # Try cache first
    cache = load_cache()
    if 'time_entries' in cache:
        entries = cache['time_entries']
        
        # Filter by date if provided
        if from_date:
            entries = [e for e in entries if str(e.get('spent_on')) >= from_date]
        if to_date:
            entries = [e for e in entries if str(e.get('spent_on')) <= to_date]
            
        return entries

    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    try:
        filters = {'user_id': 'me'}
        if from_date:
            filters['from_date'] = from_date
        if to_date:
            filters['to_date'] = to_date
            
        entries = client.redmine.time_entry.filter(**filters)
        
        entry_list = []
        for entry in entries:
            entry_list.append({
                "id": entry.id,
                "project": entry.project.name,
                "issue": entry.issue.id if hasattr(entry, 'issue') else None,
                "user": entry.user.name,
                "activity": entry.activity.name,
                "hours": entry.hours,
                "comments": entry.comments,
                "spent_on": entry.spent_on,
                "created_on": entry.created_on,
                "updated_on": entry.updated_on
            })
            
        # We don't cache partial fetches here to avoid inconsistency.
        # Cache is populated by Sync.
        return {"status": "success", "message": "Time entry deleted"}
    except Exception as e:
        return {"error": str(e)}

# --- Daily Planner Endpoints ---

# TASKS_FILE is now defined globally

class Task(BaseModel):
    id: str
    name: str
    redmine_issue_id: Optional[int] = None
    planned_hours: float = 0.0
    is_logged: bool = False
    last_logged_date: Optional[str] = None # YYYY-MM-DD
    time_entry_id: Optional[int] = None # Added for deletion support
    activity_id: Optional[int] = None
    rd_function_team: Optional[str] = "N/A"
    comments: Optional[str] = ""

def load_tasks_data():
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, 'r') as f:
            try:
                return json.load(f) or []
            except:
                return []
    return []

def save_tasks_data(tasks):
    with open(TASKS_FILE, 'w') as f:
        json.dump(tasks, f, indent=2)

@app.get("/api/tasks")
def get_tasks(date_str: Optional[str] = None):
    all_tasks = load_tasks_data()
    
    # Default to today if not provided
    if not date_str:
        from datetime import date
        date_str = str(date.today())
        
    # Filter for requested date
    todays_tasks = [t for t in all_tasks if t.get('date') == date_str]
    
    # Auto-copy logic: If today is empty, try to copy from previous available day
    from datetime import date
    today = str(date.today())
    
    if date_str == today and not todays_tasks:
        # Find most recent date with tasks
        # Sort tasks by date descending
        sorted_tasks = sorted(all_tasks, key=lambda x: x.get('date', ''), reverse=True)
        
        most_recent_date = None
        for t in sorted_tasks:
            t_date = t.get('date')
            if t_date and t_date < today:
                most_recent_date = t_date
                break
        
        if most_recent_date:
            print(f"Auto-copying tasks from {most_recent_date} to {today}")
            source_tasks = [t for t in all_tasks if t.get('date') == most_recent_date]
            
            import uuid
            new_tasks = []
            for t in source_tasks:
                new_task = t.copy()
                new_task['id'] = str(uuid.uuid4())
                new_task['date'] = today
                new_task['is_logged'] = False
                new_task['last_logged_date'] = None
                new_task['time_entry_id'] = None
                new_tasks.append(new_task)
                
            all_tasks.extend(new_tasks)
            save_tasks_data(all_tasks)
            todays_tasks = new_tasks

    return todays_tasks

@app.post("/api/tasks")
def create_task(task: Task):
    all_tasks = load_tasks_data()
    # Check if ID exists, if so update, else append
    existing = next((t for t in all_tasks if t['id'] == task.id), None)
    if existing:
        existing.update(task.dict())
    else:
        all_tasks.append(task.dict())
    save_tasks_data(all_tasks)
    return {"status": "success", "message": "Task saved", "task": task}

@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, task: Task):
    all_tasks = load_tasks_data()
    existing = next((t for t in all_tasks if t['id'] == task_id), None)
    if existing:
        existing.update(task.dict())
        save_tasks_data(all_tasks)
        return {"status": "success", "message": "Task updated"}
    return {"error": "Task not found"}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, delete_from_redmine: bool = False):
    all_tasks = load_tasks_data()
    
    # Find task to check for time_entry_id
    task_to_delete = next((t for t in all_tasks if t['id'] == task_id), None)
    
    if delete_from_redmine and task_to_delete and task_to_delete.get('time_entry_id'):
        client = get_redmine_client()
        if client:
            try:
                client.redmine.time_entry.delete(task_to_delete['time_entry_id'])
                print(f"Deleted Redmine time entry {task_to_delete['time_entry_id']}")
            except Exception as e:
                print(f"Failed to delete Redmine time entry: {e}")

    all_tasks = [t for t in all_tasks if t['id'] != task_id]
    save_tasks_data(all_tasks)
    return {"status": "success", "message": "Task deleted"}

@app.post("/api/planner/log_batch")
def log_batch(tasks: List[Task]):
    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    all_tasks = load_tasks_data()
    logged_count = 0
    errors = []
    
    from datetime import date
    today_str = str(date.today())

    for task in tasks:
        # Skip if already logged TODAY or no hours
        if task.last_logged_date == today_str or task.planned_hours <= 0:
            continue
            
        try:
            # Create Time Entry
            # Use task's activity_id or default to 9 (Development)
            activity_id = task.activity_id if task.activity_id else 9
            
            # Use task's comments or fall back to task name
            comments = task.comments if task.comments else task.name
            
            # Use task's rd_function_team or default to N/A
            rd_function_team = task.rd_function_team if task.rd_function_team else 'N/A'
            
            time_entry_data = {
                'issue_id': task.redmine_issue_id,
                'hours': task.planned_hours,
                'activity_id': activity_id,
                'comments': comments,
                'spent_on': today_str,
                'custom_fields': [{'id': 93, 'value': rd_function_team}]
            }
            
            created_entry = client.redmine.time_entry.create(**time_entry_data)
            
            # Update local task status
            # Find in all_tasks and update
            for t in all_tasks:
                if t['id'] == task.id:
                    t['last_logged_date'] = today_str
                    t['time_entry_id'] = created_entry.id # Save ID
                    break
            
            logged_count += 1
            
            # Update Cache
            update_cache_with_entry(created_entry.id)
            
        except Exception as e:
            errors.append(f"Task '{task.name}': {str(e)}")
            
    save_tasks_data(all_tasks)
    
    if errors:
        return {"status": "partial_success", "logged": logged_count, "errors": errors}
    else:
        return {"status": "success", "logged": logged_count}

@app.get("/api/redmine/daily_hours")
def get_daily_hours():
    # Try cache first
    cache = load_cache()
    if 'time_entries' in cache:
        from datetime import date
        today_str = str(date.today())
        
        # Filter cached entries for today
        todays_entries = [e for e in cache['time_entries'] if e.get('spent_on') == today_str]
        total_hours = sum(e['hours'] for e in todays_entries)
        return {"hours": total_hours}

    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    try:
        from datetime import date
        today = date.today()
        user = client.redmine.user.get('current')
        time_entries = client.redmine.time_entry.filter(user_id=user.id, from_date=today, to_date=today)
        total_hours = sum(entry.hours for entry in time_entries)
        return {"hours": total_hours}
    except Exception as e:
        print(f"Error fetching daily hours: {e}")
        return {"hours": 0}

@app.post("/api/sync")
def sync_data():
    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        cache = load_cache()
        
        # 1. Sync Projects
        print("Syncing projects...")
        projects = client.redmine.project.all(offset=0, limit=1000)
        project_list = [{"id": p.id, "name": p.name} for p in projects]
        cache['projects'] = sorted(project_list, key=lambda x: x['name'])
        
        # 2. Sync Issues (assigned to me)
        print("Syncing issues...")
        issues = client.redmine.issue.filter(assigned_to_id='me', status_id='open')
        issue_list = [{"id": i.id, "subject": i.subject, "project_id": i.project.id} for i in issues]
        cache['issues'] = sorted(issue_list, key=lambda x: x['subject'])
        
        # 3. Sync Activities
        print("Syncing activities...")
        activities = client.activity_map
        cache['activities'] = activities
        
        # 4. Sync Time Entries (Recent - e.g., last 30 days)
        print("Syncing time entries...")
        from datetime import date, timedelta
        today = date.today()
        start_date = today - timedelta(days=30)
        
        user = client.redmine.user.get('current')
        entries = client.redmine.time_entry.filter(user_id=user.id, from_date=start_date, to_date=today, limit=100)
        
        entry_list = []
        for entry in entries:
            entry_list.append({
                "id": entry.id,
                "project": entry.project.name,
                "issue": entry.issue.id if hasattr(entry, 'issue') else None,
                "user": entry.user.name,
                "activity": entry.activity.name,
                "hours": entry.hours,
                "comments": entry.comments,
                "spent_on": str(entry.spent_on),
                "created_on": str(entry.created_on),
                "updated_on": str(entry.updated_on)
            })
        cache['time_entries'] = entry_list
        
        save_cache(cache)
        return {"status": "success", "message": "Sync completed successfully"}
        
    except Exception as e:
        print(f"Sync failed: {e}")
        return {"error": str(e)}



# Debug: Print all routes
for route in app.routes:
    print(f"Route: {route.path} {route.methods}")

if __name__ == "__main__":
    port = 8000
    # Enable reload for development
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
    # Force reload check
