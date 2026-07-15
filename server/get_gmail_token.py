import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def main():
    if not os.path.exists('credentials.json'):
        print("ERROR: Please save your OAuth client JSON file as 'credentials.json' in this folder.")
        print("You can download it from the Google Cloud Console (the little download icon next to your OAuth Client ID).")
        return

    print("Opening browser to authorize...")
    flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
    creds = flow.run_local_server(port=0)

    print("\n\n=== SUCCESS! ===")
    print(f"GMAIL_API_REFRESH_TOKEN={creds.refresh_token}")
    print(f"GMAIL_API_CLIENT_ID={creds.client_id}")
    print(f"GMAIL_API_CLIENT_SECRET={creds.client_secret}")
    print("================\n")
    print("Add these 3 variables to your .env and Render Dashboard!")

if __name__ == '__main__':
    main()
