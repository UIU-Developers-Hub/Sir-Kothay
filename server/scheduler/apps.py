from django.apps import AppConfig
import threading
import time
import os
from django.core.cache import cache

def start_scheduler_thread():
    from scheduler.services import run_all
    
    def run_loop():
        # Sleep initially to let the server fully boot
        time.sleep(2)
        while True:
            try:
                # If running globally (background thread), ensure only one worker runs this concurrently
                lock_id = "scheduler_run_all_global_lock"
                if cache.add(lock_id, "true", 1):
                    run_all()
            except Exception as e:
                print(f"Background scheduler error: {e}")
            # High precision: evaluate schedules every 2 seconds
            time.sleep(2)
            
    thread = threading.Thread(target=run_loop, daemon=True)
    thread.start()

class SchedulerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'scheduler'

    def ready(self):
        # Prevent running during migrations or management commands (except runserver)
        import sys
        import os
        is_management_command = len(sys.argv) > 1 and sys.argv[1] != 'runserver'
        
        if not is_management_command:
            # If using runserver, prevent running twice due to the auto-reloader
            if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
                return
            start_scheduler_thread()
