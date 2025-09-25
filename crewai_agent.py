import os
import json
from pathlib import Path
from dotenv import load_dotenv
from crewai import Agent, Task, Crew

# Load environment variables
load_dotenv()

# Data directory
DATA_DIR = Path(__file__).parent / 'data'

# File paths
TASKS_FILE = DATA_DIR / 'tasks.json'
TEAM_FILE = DATA_DIR / 'team.json'
PERFORMANCE_FILE = DATA_DIR / 'performance.json'

def load_json(file_path):
    """Load data from JSON file"""
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_json(file_path, data):
    """Save data to JSON file"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Custom Tools
def get_employee_tasks(employee_id: str) -> str:
    """Get all tasks assigned to a specific employee"""
    tasks = load_json(TASKS_FILE)
    employee_tasks = [task for task in tasks if task.get('assignedToId') == employee_id]
    return json.dumps(employee_tasks, indent=2, ensure_ascii=False)

def update_task_status(task_id: str, new_status: str, employee_id: str) -> str:
    """Update the status of a task (only if assigned to the employee)"""
    tasks = load_json(TASKS_FILE)
    for task in tasks:
        if task['taskId'] == task_id and task.get('assignedToId') == employee_id:
            task['status'] = new_status
            save_json(TASKS_FILE, tasks)
            return f"Task {task_id} status updated to {new_status}"
    return f"Task {task_id} not found or not assigned to you"

def get_all_tasks_for_manager(manager_id: str) -> str:
    """Get all tasks for a manager and their team"""
    tasks = load_json(TASKS_FILE)
    team = load_json(TEAM_FILE)

    # Get team members
    team_members = [member for member in team if member.get('managerId') == manager_id]
    team_member_ids = [member['employeeId'] for member in team_members] + [manager_id]

    manager_tasks = [task for task in tasks if task.get('assignedToId') in team_member_ids]
    return json.dumps(manager_tasks, indent=2, ensure_ascii=False)

def update_any_task(task_id: str, updates: dict) -> str:
    """Update any task (manager privilege)"""
    tasks = load_json(TASKS_FILE)
    for task in tasks:
        if task['taskId'] == task_id:
            task.update(updates)
            save_json(TASKS_FILE, tasks)
            return f"Task {task_id} updated successfully"
    return f"Task {task_id} not found"

def get_performance_reports() -> str:
    """Get all performance reports"""
    performance = load_json(PERFORMANCE_FILE)
    return json.dumps(performance, indent=2, ensure_ascii=False)

def create_task(title: str, description: str, assigned_to_id: str, priority: str = 'medium') -> str:
    """Create a new task"""
    tasks = load_json(TASKS_FILE)
    task_id = f"T{len(tasks) + 1:03d}"
    new_task = {
        "taskId": task_id,
        "title": title,
        "description": description,
        "assignedToId": assigned_to_id,
        "status": "pending",
        "priority": priority,
        "createdAt": "2025-09-22T13:43:00.000Z",
        "dueDate": "2025-10-22T13:43:00.000Z"
    }
    tasks.append(new_task)
    save_json(TASKS_FILE, tasks)
    return f"Task {task_id} created successfully"

# Define tools as functions that can be called
employee_tools = {
    'get_employee_tasks': get_employee_tasks,
    'update_task_status': update_task_status
}

manager_tools = {
    'get_all_tasks_for_manager': get_all_tasks_for_manager,
    'update_any_task': update_any_task,
    'get_performance_reports': get_performance_reports,
    'create_task': create_task
}

# Agents
employee_agent = Agent(
    role='Employee Task Manager',
    goal='Help employees manage their tasks and report progress',
    backstory='You are an AI assistant that helps employees check their tasks, update task status, and report on their work.',
    verbose=True
)

manager_agent = Agent(
    role='Manager Task Overseer',
    goal='Help managers oversee team tasks, update assignments, and view reports',
    backstory='You are an AI assistant that helps managers view all team tasks, update any task, create new tasks, and access performance reports.',
    verbose=True
)

def run_employee_session(employee_id: str, user_input: str):
    """Run a session for an employee - simplified version without LLM"""
    user_input_lower = user_input.lower()

    if 'check' in user_input_lower or 'see' in user_input_lower or 'my tasks' in user_input_lower:
        return get_employee_tasks(employee_id)
    elif 'update' in user_input_lower or 'status' in user_input_lower:
        # Simple parsing - assume format "update task T001 to in_progress"
        parts = user_input.split()
        if len(parts) >= 5 and parts[0] == 'update' and parts[1] == 'task':
            task_id = parts[2]
            new_status = parts[4]
            return update_task_status(task_id, new_status, employee_id)
        else:
            return "Please specify the task ID and new status. Example: 'update task T001 to in_progress'"
    else:
        return "I can help you check your tasks or update task status. What would you like to do?"

def run_manager_session(manager_id: str, user_input: str):
    """Run a session for a manager - simplified version without LLM"""
    user_input_lower = user_input.lower()

    if 'all tasks' in user_input_lower or 'team tasks' in user_input_lower:
        return get_all_tasks_for_manager(manager_id)
    elif 'performance' in user_input_lower or 'reports' in user_input_lower:
        return get_performance_reports()
    elif 'update' in user_input_lower and 'task' in user_input_lower:
        # Simple parsing - assume format "update task T001 status to completed"
        parts = user_input.split()
        if len(parts) >= 6:
            task_id = parts[2]
            new_status = parts[5]
            return update_any_task(task_id, {'status': new_status})
        else:
            return "Please specify the task ID and updates. Example: 'update task T001 status to completed'"
    elif 'create' in user_input_lower and 'task' in user_input_lower:
        # Simple parsing - assume format "create task 'Title' for E001"
        # This is simplified - in real implementation would need better parsing
        return "Task creation requires more specific input. Please use the API directly."
    else:
        return "I can help you view all team tasks, update any task, or view performance reports. What would you like to do?"

def test_agent():
    """Test the agent functionality"""
    print("Testing Employee Agent - Check Tasks:")
    result = run_employee_session('E001', 'check my tasks')
    print(result)

    print("\nTesting Employee Agent - Update Task:")
    result = run_employee_session('E001', 'update task T001 to in_progress')
    print(result)

    print("\nTesting Manager Agent - Show All Tasks:")
    result = run_manager_session('M001', 'show all team tasks')
    print(result)

    print("\nTesting Manager Agent - Performance Reports:")
    result = run_manager_session('M001', 'show performance reports')
    print(result)

if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 4:
        # Command line mode: python3 crewai_agent.py <role> <user_id> <message>
        role = sys.argv[1].lower()
        user_id = sys.argv[2]
        message = ' '.join(sys.argv[3:])

        if role == 'employee':
            result = run_employee_session(user_id, message)
            print(result)
        elif role == 'manager':
            result = run_manager_session(user_id, message)
            print(result)
        else:
            print("Invalid role. Use 'employee' or 'manager'")
    else:
        # Interactive test mode
        test_agent()