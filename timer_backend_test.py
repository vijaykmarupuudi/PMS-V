#!/usr/bin/env python3
"""
Timer Functionality Backend API Testing
Tests timer start/stop functionality, time logging, and timer entries history
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class TimerAPITester:
    def __init__(self, base_url: str = "https://comment-tracker-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_task_id = None

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        self.log(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}")
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    self.log(f"   Response: {response.text[:500]}...")

            try:
                response_data = response.json() if response.text else {}
            except json.JSONDecodeError:
                response_data = {"raw_response": response.text}

            return success, response_data

        except requests.exceptions.Timeout:
            self.log(f"❌ FAILED - Request timeout after 30 seconds")
            return False, {"error": "timeout"}
        except requests.exceptions.ConnectionError as e:
            self.log(f"❌ FAILED - Connection error: {str(e)}")
            return False, {"error": "connection_error", "details": str(e)}
        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}")
            return False, {"error": str(e)}

    def test_demo_login(self) -> bool:
        """Test login with demo credentials"""
        demo_credentials = {
            "email": "demo@company.com",
            "password": "demo123456"
        }
        
        success, response = self.run_test(
            "Demo User Login",
            "POST",
            "/api/auth/login",
            200,
            data=demo_credentials
        )
        
        if success and 'tokens' in response and 'user' in response:
            self.token = response['tokens']['access_token']
            self.user_data = response['user']
            self.log(f"✅ Login successful for user: {self.user_data.get('email')}")
            return True
        else:
            self.log("❌ Login failed - no tokens or user data received")
            return False

    def test_get_tasks_for_timer(self) -> bool:
        """Get tasks to find one for timer testing or create one"""
        if not self.token:
            self.log("❌ Cannot get tasks - no authentication token")
            return False
        
        # First try to get projects to find a project ID
        success_proj, proj_response = self.run_test(
            "Get Projects for Task Creation",
            "GET",
            "/api/projects",
            200
        )
        
        project_id = None
        if success_proj:
            projects = proj_response if isinstance(proj_response, list) else proj_response.get('projects', [])
            if projects and len(projects) > 0:
                project_id = projects[0].get('id')
                self.log(f"   Found project for task creation: {project_id}")
        
        # Try to get existing tasks first
        success, response = self.run_test(
            "Get Tasks for Timer Testing",
            "GET",
            "/api/tasks",
            200
        )
        
        if success:
            # Handle both list and dict responses
            if isinstance(response, list):
                tasks = response
            else:
                tasks = response.get('tasks', response)
                
            if isinstance(tasks, list) and len(tasks) > 0:
                self.test_task_id = tasks[0].get('id')
                self.log(f"✅ Found existing task for timer testing: {self.test_task_id}")
                self.log(f"   Task title: {tasks[0].get('title', 'Unknown')}")
                return True
        
        # If getting tasks failed or no tasks found, try to create a test task
        if project_id:
            self.log("   No existing tasks found, creating test task...")
            task_data = {
                "title": "Timer Test Task",
                "description": "Test task for timer functionality testing",
                "status": "in_progress",
                "priority": "medium",
                "type": "task",
                "project_id": project_id
            }
            
            success_create, create_response = self.run_test(
                "Create Test Task for Timer",
                "POST",
                "/api/tasks/",
                201,
                data=task_data
            )
            
            if success_create:
                self.test_task_id = create_response.get('id')
                self.log(f"✅ Created test task for timer testing: {self.test_task_id}")
                return True
            else:
                self.log("❌ Failed to create test task")
        
        # Last resort: use a hardcoded task ID if we know one exists
        self.log("⚠️ Using fallback approach - will try with known task pattern")
        # We'll set a placeholder and let the timer tests handle the error gracefully
        self.test_task_id = "test-task-placeholder"
        return False

    def test_get_active_timers(self) -> bool:
        """Test getting active timers"""
        if not self.token:
            self.log("❌ Cannot test active timers - no authentication token")
            return False
            
        success, response = self.run_test(
            "Get Active Timers",
            "GET",
            "/api/tasks/timers/active",
            200
        )
        
        if success:
            active_timers = response.get('active_timers', [])
            self.log(f"✅ Active timers retrieved: {len(active_timers)} active timers")
            
            # Stop any existing active timers to ensure clean state
            for timer in active_timers:
                task_id = timer.get('task_id')
                if task_id:
                    self.log(f"   Stopping existing timer for task: {task_id}")
                    self.run_test(
                        f"Stop Existing Timer ({task_id})",
                        "POST",
                        f"/api/tasks/{task_id}/timer/stop",
                        200
                    )
            return True
        else:
            self.log("❌ Failed to retrieve active timers")
            return False

    def test_start_timer(self) -> bool:
        """Test starting a timer"""
        if not self.token:
            self.log("❌ Cannot test timer start - missing authentication token")
            return False
            
        if not self.test_task_id or self.test_task_id == "test-task-placeholder":
            self.log("❌ Cannot test timer start - no valid task ID available")
            return False
            
        success, response = self.run_test(
            f"Start Timer for Task {self.test_task_id}",
            "POST",
            f"/api/tasks/{self.test_task_id}/timer/start",
            200
        )
        
        if success:
            timer_data = response.get('timer', {})
            self.log(f"✅ Timer started successfully")
            self.log(f"   Timer ID: {timer_data.get('id')}")
            self.log(f"   Start time: {timer_data.get('start_time')}")
            self.log(f"   Is active: {timer_data.get('is_active')}")
            return True
        else:
            self.log("❌ Failed to start timer")
            return False

    def test_timer_running_state(self) -> bool:
        """Test that timer is in running state"""
        if not self.token:
            self.log("❌ Cannot test timer state - no authentication token")
            return False
            
        success, response = self.run_test(
            "Check Timer Running State",
            "GET",
            "/api/tasks/timers/active",
            200
        )
        
        if success:
            active_timers = response.get('active_timers', [])
            task_timer = None
            
            for timer in active_timers:
                if timer.get('task_id') == self.test_task_id:
                    task_timer = timer
                    break
            
            if task_timer:
                elapsed_seconds = task_timer.get('elapsed_seconds', 0)
                elapsed_hours = task_timer.get('elapsed_hours', 0)
                self.log(f"✅ Timer is running correctly")
                self.log(f"   Elapsed seconds: {elapsed_seconds}")
                self.log(f"   Elapsed hours: {elapsed_hours}")
                return True
            else:
                self.log("❌ Timer not found in active timers")
                return False
        else:
            self.log("❌ Failed to check timer state")
            return False

    def test_stop_timer(self) -> bool:
        """Test stopping a timer"""
        if not self.token or not self.test_task_id:
            self.log("❌ Cannot test timer stop - missing token or task ID")
            return False
            
        # Wait a few seconds to ensure timer has some elapsed time
        self.log("   Waiting 3 seconds for timer to accumulate time...")
        time.sleep(3)
            
        success, response = self.run_test(
            f"Stop Timer for Task {self.test_task_id}",
            "POST",
            f"/api/tasks/{self.test_task_id}/timer/stop?auto_log=true&description=Test timer session",
            200
        )
        
        if success:
            timer_data = response.get('timer', {})
            time_logged = response.get('time_logged', False)
            time_entry = response.get('time_entry', {})
            
            self.log(f"✅ Timer stopped successfully")
            self.log(f"   Timer ID: {timer_data.get('id')}")
            self.log(f"   Elapsed seconds: {timer_data.get('elapsed_seconds')}")
            self.log(f"   Elapsed hours: {timer_data.get('elapsed_hours')}")
            self.log(f"   Time logged: {time_logged}")
            
            if time_logged and time_entry:
                self.log(f"   Time entry created: {time_entry.get('hours')} hours")
                self.log(f"   Description: {time_entry.get('description')}")
            
            return True
        else:
            self.log("❌ Failed to stop timer")
            return False

    def test_timer_entries_history(self) -> bool:
        """Test that timer entries are recorded in history"""
        if not self.token or not self.test_task_id:
            self.log("❌ Cannot test timer history - missing token or task ID")
            return False
            
        success, response = self.run_test(
            f"Get Task with Timer History {self.test_task_id}",
            "GET",
            f"/api/tasks/{self.test_task_id}/detailed",
            200
        )
        
        if success:
            time_tracking = response.get('time_tracking', {})
            logged_time = time_tracking.get('logged_time', [])
            actual_hours = time_tracking.get('actual_hours', 0)
            
            self.log(f"✅ Timer history retrieved")
            self.log(f"   Total logged entries: {len(logged_time)}")
            self.log(f"   Total actual hours: {actual_hours}")
            
            # Check if we have recent timer entries
            recent_entries = [entry for entry in logged_time if 'timer_id' in entry]
            self.log(f"   Timer-based entries: {len(recent_entries)}")
            
            if len(logged_time) > 0:
                latest_entry = logged_time[-1]
                self.log(f"   Latest entry: {latest_entry.get('hours')} hours - {latest_entry.get('description')}")
                return True
            else:
                self.log("⚠️ No time entries found in history")
                return False
        else:
            self.log("❌ Failed to retrieve timer history")
            return False

    def test_manual_time_logging(self) -> bool:
        """Test manual time logging functionality"""
        if not self.token or not self.test_task_id:
            self.log("❌ Cannot test manual time logging - missing token or task ID")
            return False
            
        success, response = self.run_test(
            f"Manual Time Log for Task {self.test_task_id}",
            "POST",
            f"/api/tasks/{self.test_task_id}/time/log?hours=1.5&description=Manual test entry",
            200
        )
        
        if success:
            time_entry = response.get('time_entry', {})
            self.log(f"✅ Manual time logging successful")
            self.log(f"   Hours logged: {time_entry.get('hours')}")
            self.log(f"   Description: {time_entry.get('description')}")
            return True
        else:
            self.log("❌ Failed to log manual time entry")
            return False

    def test_timer_reset_functionality(self) -> bool:
        """Test that timer starts from 0:00 when started"""
        if not self.token or not self.test_task_id:
            self.log("❌ Cannot test timer reset - missing token or task ID")
            return False
            
        # Start timer again to test reset functionality
        success, response = self.run_test(
            f"Start Timer Again (Reset Test) {self.test_task_id}",
            "POST",
            f"/api/tasks/{self.test_task_id}/timer/start",
            200
        )
        
        if success:
            timer_data = response.get('timer', {})
            self.log(f"✅ Timer reset test successful")
            self.log(f"   Timer starts fresh with new ID: {timer_data.get('id')}")
            
            # Immediately check active timers to verify it starts from 0
            success2, response2 = self.run_test(
                "Check Timer Starts from Zero",
                "GET",
                "/api/tasks/timers/active",
                200
            )
            
            if success2:
                active_timers = response2.get('active_timers', [])
                task_timer = None
                
                for timer in active_timers:
                    if timer.get('task_id') == self.test_task_id:
                        task_timer = timer
                        break
                
                if task_timer:
                    elapsed_seconds = task_timer.get('elapsed_seconds', 0)
                    self.log(f"   Timer elapsed at start: {elapsed_seconds} seconds (should be close to 0)")
                    
                    # Stop the timer for cleanup
                    self.run_test(
                        f"Stop Reset Test Timer {self.test_task_id}",
                        "POST",
                        f"/api/tasks/{self.test_task_id}/timer/stop",
                        200
                    )
                    
                    return elapsed_seconds < 5  # Allow for small delay
                else:
                    self.log("❌ Timer not found after reset")
                    return False
            else:
                return False
        else:
            self.log("❌ Failed to start timer for reset test")
            return False

    def run_comprehensive_timer_test(self) -> Dict[str, Any]:
        """Run all timer tests and return comprehensive results"""
        self.log("🚀 Starting Comprehensive Timer Functionality Testing")
        self.log(f"   Base URL: {self.base_url}")
        self.log(f"   Test time: {datetime.now().isoformat()}")
        
        test_results = {
            "test_summary": {
                "start_time": datetime.now().isoformat(),
                "base_url": self.base_url,
                "focus": "Timer functionality testing"
            },
            "test_results": {},
            "critical_issues": [],
            "timer_functionality": {"status": "unknown"},
            "timer_features": {
                "start_timer": "unknown",
                "stop_timer": "unknown", 
                "timer_history": "unknown",
                "timer_reset": "unknown",
                "manual_logging": "unknown"
            }
        }
        
        # Test sequence
        tests = [
            ("demo_login", self.test_demo_login),
            ("get_tasks_for_timer", self.test_get_tasks_for_timer),
            ("get_active_timers", self.test_get_active_timers),
            ("start_timer", self.test_start_timer),
            ("timer_running_state", self.test_timer_running_state),
            ("stop_timer", self.test_stop_timer),
            ("timer_entries_history", self.test_timer_entries_history),
            ("manual_time_logging", self.test_manual_time_logging),
            ("timer_reset_functionality", self.test_timer_reset_functionality)
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                test_results["test_results"][test_name] = {
                    "passed": result,
                    "timestamp": datetime.now().isoformat()
                }
                
                # Update timer features status
                if test_name == "start_timer":
                    test_results["timer_features"]["start_timer"] = "working" if result else "failing"
                elif test_name == "stop_timer":
                    test_results["timer_features"]["stop_timer"] = "working" if result else "failing"
                elif test_name == "timer_entries_history":
                    test_results["timer_features"]["timer_history"] = "working" if result else "failing"
                elif test_name == "timer_reset_functionality":
                    test_results["timer_features"]["timer_reset"] = "working" if result else "failing"
                elif test_name == "manual_time_logging":
                    test_results["timer_features"]["manual_logging"] = "working" if result else "failing"
                
                # Mark critical issues
                if not result and test_name in ["demo_login", "start_timer", "stop_timer"]:
                    test_results["critical_issues"].append({
                        "test": test_name,
                        "issue": f"Timer {test_name.replace('_', ' ')} not working",
                        "impact": "High - blocks timer functionality"
                    })
                        
            except Exception as e:
                self.log(f"❌ Test {test_name} crashed: {str(e)}")
                test_results["test_results"][test_name] = {
                    "passed": False,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
        # Determine overall timer functionality status
        timer_core_tests = ["start_timer", "stop_timer", "timer_entries_history"]
        timer_working = sum(1 for test in timer_core_tests 
                           if test_results["test_results"].get(test, {}).get("passed", False))
        
        if timer_working == 3:
            test_results["timer_functionality"]["status"] = "working"
        elif timer_working >= 2:
            test_results["timer_functionality"]["status"] = "partial"
        else:
            test_results["timer_functionality"]["status"] = "failing"
        
        # Final summary
        test_results["test_summary"].update({
            "end_time": datetime.now().isoformat(),
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": f"{(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%",
            "critical_issues_count": len(test_results["critical_issues"])
        })
        
        self.log("📊 Timer Test Summary:")
        self.log(f"   Total tests: {self.tests_run}")
        self.log(f"   Passed: {self.tests_passed}")
        self.log(f"   Success rate: {test_results['test_summary']['success_rate']}")
        self.log(f"   Critical issues: {len(test_results['critical_issues'])}")
        
        # Log timer feature status
        for feature, status in test_results["timer_features"].items():
            status_icon = "✅" if status == "working" else "❌" if status == "failing" else "⚠️"
            self.log(f"   {feature.replace('_', ' ').title()}: {status_icon} {status}")
        
        return test_results

def main():
    """Main test execution"""
    print("=" * 80)
    print("Timer Functionality - Backend API Testing")
    print("=" * 80)
    
    # Initialize tester with the public endpoint
    tester = TimerAPITester()
    
    # Run comprehensive tests
    results = tester.run_comprehensive_timer_test()
    
    # Save results to file
    results_file = f"/app/timer_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n📄 Detailed results saved to: {results_file}")
    except Exception as e:
        print(f"⚠️ Could not save results file: {e}")
    
    # Return appropriate exit code
    if results["timer_functionality"]["status"] == "working" and \
       len(results["critical_issues"]) == 0:
        print("\n🎉 Timer backend testing completed successfully!")
        return 0
    else:
        print(f"\n⚠️ Timer backend testing completed with issues:")
        for issue in results["critical_issues"]:
            print(f"   - {issue['test']}: {issue['issue']}")
        return 1

if __name__ == "__main__":
    sys.exit(main())