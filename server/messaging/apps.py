from django.apps import AppConfig
import threading
import time
import sys
import os

def background_stale_chat_closer():
    # Wait a few seconds for the server to fully initialize
    time.sleep(5)
    from messaging.services import process_stale_chats
    from django.db import close_old_connections
    
    while True:
        try:
            # Clean up connections before processing
            close_old_connections()
            process_stale_chats()
        except Exception as e:
            print(f"Background chat closer error: {e}")
        finally:
            # Ensure connections are closed after processing to prevent leaks
            close_old_connections()
            
        # Check every 15 seconds
        time.sleep(15)


class MessagingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'messaging'

    def ready(self):
        # Prevent running during typical management commands
        if len(sys.argv) > 1 and sys.argv[1] in ['makemigrations', 'migrate', 'collectstatic', 'shell', 'test']:
            return
            
        # Prevent duplicate threads when runserver uses its auto-reloader
        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return
            
        # Start the background daemon thread
        t = threading.Thread(target=background_stale_chat_closer, daemon=True)
        t.start()

