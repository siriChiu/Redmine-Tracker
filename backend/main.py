from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import sys
from pydantic import BaseModel
from typing import List, Optional
import yaml
import json
from datetime import datetime
import signal

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
    alert_time: Optional[str] = "17:00"
    auto_log_time: Optional[str] = "18:00"
    calendar_start_time: Optional[str] = "06:00"
    calendar_end_time: Optional[str] = "21:00"

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
        try:
            with open(CONFIG_FILE, 'r') as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            print(f"Error loading settings: {e}")
            return {}
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

def update_cache_with_entry(entry_id, start_time=None):
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
        new_entry = {
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
        }
        
        if start_time:
            new_entry['start_time'] = start_time
            
        cache['time_entries'].append(new_entry)
        
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
    try:
        data = load_settings_data()
                
        data['api_key'] = settings.api_key
        data['redmine_url'] = settings.redmine_url
        data['alert_time'] = settings.alert_time
        data['auto_log_time'] = settings.auto_log_time
        data['calendar_start_time'] = settings.calendar_start_time
        data['calendar_end_time'] = settings.calendar_end_time
        
        with open(CONFIG_FILE, 'w') as f:
            yaml.dump(data, f)
        
        # Re-init client
        global redmine_client
        try:
            redmine_client = rm.Redmine(settings.api_key, settings.redmine_url)
        except Exception as e:
            print(f"Warning: Failed to re-init Redmine client: {e}")
            # We still return success because settings were saved
            return {"status": "success", "message": "Settings saved (Redmine connection failed)"}

        return {"status": "success", "message": "Settings saved"}
    except Exception as e:
        print(f"Error saving settings: {e}")
        return {"error": str(e)}

@app.get("/api/settings")
def get_settings():
    data = load_settings_data()
    return {
        "api_key": data.get('api_key', ""),
        "redmine_url": data.get('redmine_url', "http://advrm.advantech.com:3002/"),
        "alert_time": data.get('alert_time', "17:00"),
        "alert_time": data.get('alert_time', "17:00"),
        "auto_log_time": data.get('auto_log_time', "18:00"),
        "calendar_start_time": data.get('calendar_start_time', "06:00"),
        "calendar_end_time": data.get('calendar_end_time', "21:00")
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
            "url": f"{client.url.rstrip('/')}/issues/{issue.id}",
            "custom_fields": [{"id": cf.id, "name": cf.name, "value": cf.value} for cf in issue.custom_fields] if hasattr(issue, 'custom_fields') else []
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
    start_time: Optional[str] = None

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
        update_cache_with_entry(created_entry.id, start_time=entry.start_time)
        
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
                "issue_subject": entry.issue.subject if hasattr(entry, 'issue') else None,
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
        return entry_list
    except Exception as e:
        return {"error": str(e)}

@app.put("/api/redmine/time_entries/{entry_id}")
def update_time_entry(entry_id: int, entry: TimeEntry):
    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        print(f"Updating time entry {entry_id}: {entry}")
        
        custom_field_id = 93
        # Use provided value or default to N/A
        custom_field_value = entry.rd_function_team if hasattr(entry, 'rd_function_team') and entry.rd_function_team else 'N/A'
        
        time_entry_data = {
            'activity_id': entry.activity_id,
            'hours': entry.hours,
            'comments': entry.comments,
            'custom_fields': [{'id': custom_field_id, 'value': custom_field_value}]
        }
        
        # Only update project/issue if strictly necessary/supported by Redmine API for that entry type
        # Redmine allows moving entries between projects/issues usually.
        if entry.issue_id:
            time_entry_data['issue_id'] = entry.issue_id
            time_entry_data['project_id'] = None # Clear project if issue is set
        elif entry.project_id:
            time_entry_data['project_id'] = entry.project_id
            time_entry_data['issue_id'] = None # Clear issue if project is set
            
        # Note: 'spent_on' is also updatable
        time_entry_data['spent_on'] = entry.spent_on
            
        client.redmine.time_entry.update(entry_id, **time_entry_data)
        
        # Update Cache
        update_cache_with_entry(entry_id, start_time=entry.start_time)
        
        return {"status": "success", "message": "Time entry updated"}
    except Exception as e:
        print(f"Error updating time entry: {e}")
        if "Requested resource doesn't exist" in str(e):
            # Treat as success (entry gone), remove from cache
            remove_from_cache(entry_id)
            return {"status": "success", "message": "Entry not found in Redmine, removed locally"}
        return {"error": str(e)}

@app.delete("/api/redmine/time_entries/{entry_id}")
def delete_time_entry(entry_id: int):
    client = get_redmine_client()
    if not client:
        return {"error": "Redmine not configured"}
    
    try:
        print(f"Deleting time entry {entry_id}")
        client.redmine.time_entry.delete(entry_id)
        
        # Remove from Cache
        remove_from_cache(entry_id)
        
        return {"status": "success", "message": "Time entry deleted"}
    except Exception as e:
        print(f"Error deleting time entry: {e}")
        if "Requested resource doesn't exist" in str(e):
            # Treat as success (entry gone), remove from cache
            remove_from_cache(entry_id)
            return {"status": "success", "message": "Entry not found in Redmine, removed locally"}
        return {"error": str(e)}

# --- Daily Planner Endpoints ---

# TASKS_FILE is now defined globally

class Task(BaseModel):
    id: str
    name: str
    redmine_issue_id: Optional[int] = None
    planned_hours: float = 0.0
    is_logged: bool = False
    is_paused: bool = False # New field for pause state
    date: str # YYYY-MM-DD
    last_logged_date: Optional[str] = None # YYYY-MM-DD
    time_entry_id: Optional[int] = None # Added for deletion support
    activity_id: Optional[int] = None
    rd_function_team: Optional[str] = "N/A"
    comments: Optional[str] = ""
    project_id: Optional[int] = None

def load_tasks_data():
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, 'r') as f:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    print("Migrating tasks.json from List to Dict...")
                    # Migration: Convert list to dict
                    new_data = {}
                    for task in data:
                        # Use redmine_issue_id as key if available, else UUID
                        if task.get('redmine_issue_id'):
                            task_id = str(task.get('redmine_issue_id'))
                            task['id'] = task_id # Ensure ID matches key
                        else:
                            task_id = task.get('id')
                            if not task_id: continue 
                        
                        # Clear date as requested (static profile)
                        task['date'] = None
                        
                        # Reset transient state
                        task['is_logged'] = False
                        
                        new_data[task_id] = task
                    
                    # Save immediately
                    save_tasks_data(new_data)
                    return new_data
                
                # Check for Dictionary migration (ensure keys match redmine_issue_id)
                if isinstance(data, dict):
                    migrated = False
                    new_data = {}
                    for key, task in data.items():
                        # If task has issue ID but key is not it, migrate
                        if task.get('redmine_issue_id') and str(task.get('redmine_issue_id')) != key:
                            print(f"Migrating task {key} to issue ID key {task.get('redmine_issue_id')}")
                            new_key = str(task.get('redmine_issue_id'))
                            task['id'] = new_key
                            new_data[new_key] = task
                            migrated = True
                        else:
                            new_data[key] = task
                    
                    if migrated:
                        save_tasks_data(new_data)
                        return new_data
                        
                return data or {}
            except Exception as e:
                print(f"Error loading tasks: {e}")
                return {}
    return {}

def save_tasks_data(tasks):
    with open(TASKS_FILE, 'w') as f:
        json.dump(tasks, f, indent=2)

@app.get("/api/tasks")
def get_tasks(date_str: Optional[str] = None, no_auto_copy: bool = False):
    tasks_data = load_tasks_data() # Returns Dict
    
    # Default to today if not provided
    if not date_str:
        from datetime import date
        date_str = str(date.today())
        
    task_list = []
    for task_id, task in tasks_data.items():
        # Create a copy for the response so we don't mutate storage
        t = task.copy()
        
        # Calculate is_logged based on last_logged_date
        if t.get('last_logged_date') == date_str:
            t['is_logged'] = True
        else:
            t['is_logged'] = False
            # If not logged today, clear the time_entry_id from the response
            # so the frontend doesn't try to delete a past entry
            t['time_entry_id'] = None
            
        # Set the date to the requested date (for frontend context)
        t['date'] = date_str
        
        task_list.append(t)
        
    # Sort by name or some other criteria if needed
    # For now, just return the list
    return task_list

@app.post("/api/tasks")
def create_task(task: Task):
    all_tasks = load_tasks_data() # Dict
    
    # Determine Key
    if task.redmine_issue_id:
        task.id = str(task.redmine_issue_id)
    
    # Store as static profile
    task_dict = task.dict()
    task_dict['date'] = None # Ensure date is null in storage
    
    # If key exists, we overwrite (update)
    all_tasks[task.id] = task_dict
    
    save_tasks_data(all_tasks)
    return {"status": "success", "message": "Task saved", "task": task}

@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, task: Task):
    all_tasks = load_tasks_data() # Dict
    
    # Check if we need to migrate key (e.g. user added issue ID)
    new_key = task_id
    if task.redmine_issue_id:
        new_key = str(task.redmine_issue_id)
        task.id = new_key
        
    # If key changed, remove old
    if new_key != task_id and task_id in all_tasks:
        del all_tasks[task_id]
        
    updated_data = task.dict()
    updated_data['date'] = None # Ensure date is null
    
    all_tasks[new_key] = updated_data
    save_tasks_data(all_tasks)
    return {"status": "success", "message": "Task updated"}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, delete_from_redmine: bool = False):
    all_tasks = load_tasks_data() # Dict
    
    if task_id in all_tasks:
        task_to_delete = all_tasks[task_id]
        
        if delete_from_redmine and task_to_delete.get('time_entry_id'):
            client = get_redmine_client()
            if client:
                try:
                    client.redmine.time_entry.delete(task_to_delete['time_entry_id'])
                    print(f"Deleted Redmine time entry {task_to_delete['time_entry_id']}")
                except Exception as e:
                    print(f"Failed to delete Redmine time entry: {e}")

        del all_tasks[task_id]
        save_tasks_data(all_tasks)
        return {"status": "success", "message": "Task deleted"}
    return {"error": "Task not found"}

@app.post("/api/planner/log_batch")
def log_batch(tasks: List[Task]):
    print(f"DEBUG: Received {len(tasks)} tasks to log")
    client = get_redmine_client()
    if not client:
        print("DEBUG: Redmine client not initialized")
        return {"error": "Redmine not configured"}
    
    all_tasks = load_tasks_data() # Dict
    logged_count = 0
    errors = []
    
    from datetime import date
    today_str = str(date.today())

    for task in tasks:
        print(f"DEBUG: Processing task: {task.name}, Issue ID: {task.redmine_issue_id}, Project ID: {task.project_id}")
        # Skip if no hours or if paused
        if task.planned_hours <= 0 or task.is_paused:
            print(f"DEBUG: Skipping task {task.name} (Hours: {task.planned_hours}, Paused: {task.is_paused})")
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
                'hours': task.planned_hours,
                'activity_id': activity_id,
                'comments': comments,
                'spent_on': today_str, # Always log for today
                'custom_fields': [{'id': 93, 'value': rd_function_team}]
            }

            if task.redmine_issue_id:
                time_entry_data['issue_id'] = task.redmine_issue_id
                print(f"DEBUG: Logging with Issue ID: {task.redmine_issue_id}")
            elif task.project_id:
                time_entry_data['project_id'] = task.project_id
                print(f"DEBUG: Logging with Project ID: {task.project_id}")
            else:
                print("DEBUG: Missing Issue ID and Project ID")
                raise Exception("Task has no Issue ID and no Project ID. Cannot log.")
            
            created_entry = client.redmine.time_entry.create(**time_entry_data)
            
            # Update local task status
            if task.id in all_tasks:
                all_tasks[task.id]['last_logged_date'] = today_str
                all_tasks[task.id]['time_entry_id'] = created_entry.id
            
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
        
        # Preserve start_time from existing cache
        existing_start_times = {}
        if 'time_entries' in cache:
            for e in cache['time_entries']:
                if 'start_time' in e:
                    existing_start_times[e['id']] = e['start_time']
        
        today = date.today()
        start_date = today - timedelta(days=30)
        
        user = client.redmine.user.get('current')
        entries = client.redmine.time_entry.filter(user_id=user.id, from_date=start_date, to_date=today, limit=100)
        
        entry_list = []
        for entry in entries:
            new_entry_dict = {
                "id": entry.id,
                "project": entry.project.name,
                "project_id": entry.project.id,
                "issue": entry.issue.id if hasattr(entry, 'issue') else None,
                "user": entry.user.name,
                "activity": entry.activity.name,
                "activity_id": entry.activity.id,
                "hours": entry.hours,
                "comments": entry.comments,
                "spent_on": str(entry.spent_on),
                "created_on": str(entry.created_on),
                "updated_on": str(entry.updated_on)
            }
            
            # Restore start_time if it existed
            if entry.id in existing_start_times:
                new_entry_dict['start_time'] = existing_start_times[entry.id]
                
            entry_list.append(new_entry_dict)
            
        cache['time_entries'] = entry_list
        
        save_cache(cache)
        return {"status": "success", "message": "Sync completed successfully"}
        
    except Exception as e:
        print(f"Sync failed: {e}")
        return {"error": str(e)}

@app.get("/api/task_history")
def get_task_history():
    all_tasks = load_tasks_data() # Dict
    # Return unique tasks by name
    seen_names = set()
    unique_tasks = []
    
    # Sort by date descending to get most recent first
    # Iterate over values since all_tasks is a dict
    sorted_tasks = sorted(all_tasks.values(), key=lambda x: x.get('date') or '', reverse=True)
    
    for task in sorted_tasks:
        name = task.get('name')
        if name and name not in seen_names:
            seen_names.add(name)
            unique_tasks.append(task)
            
    return unique_tasks

@app.delete("/api/task_history")
def delete_task_history(name: str):
    print(f"Deleting history for task name: {name}")
    all_tasks = load_tasks_data() # Dict
    
    # Identify IDs to remove
    ids_to_remove = [tid for tid, t in all_tasks.items() if t.get('name') == name]
    
    if not ids_to_remove:
        return {"error": "Task not found in history"}
        
    for tid in ids_to_remove:
        del all_tasks[tid]
        
    save_tasks_data(all_tasks)
    return {"status": "success", "message": f"Deleted history for '{name}'"}



# Debug: Print all routes
for route in app.routes:
    print(f"Route: {route.path} {route.methods}")

if __name__ == "__main__":
    # Handle signals for graceful shutdown
    def signal_handler(sig, frame):
        print(f"[{datetime.now()}] Received signal {sig}, exiting...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    port = 8000
    
    # Check if running in frozen mode (PyInstaller)
    if getattr(sys, 'frozen', False):
        try:
            print(f"[{datetime.now()}] Starting backend in frozen mode (stdout)", flush=True)
            
            # Run uvicorn with app instance directly to avoid import errors in frozen mode
            # log_config=None prevents uvicorn from configuring logging (avoiding isatty check)
            # Explicitly set loop and http to avoid auto-detection failures
            uvicorn.run(app, host="127.0.0.1", port=port, reload=False, log_config=None, loop="asyncio", http="h11")
            
            print(f"[{datetime.now()}] Uvicorn returned normally", flush=True)
            
        except (Exception, SystemExit) as e:
            print(f"CRASH: {e}", flush=True)
            if "Errno 10048" in str(e):
                print("\nCRITICAL ERROR: PORT 8000 IS BUSY", flush=True)
                print("Please close other instances of Redmine Tracker or kill 'backend.exe' / 'python.exe' in Task Manager.\n", flush=True)
            import traceback
            traceback.print_exc()
    else:
        # Enable reload for development
        uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
