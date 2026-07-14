# Legacy PythonAnywhere Files

These files were used when the backend was hosted on **PythonAnywhere**. They were moved here during the migration to **Render** (July 2026).

## Files

| File | Purpose |
|---|---|
| `deploy_pythonanywhere.sh` | Auto-deploy script triggered by GitHub webhook |
| `webhooks.py` | Django view that received GitHub push events and ran the deploy script |
| `.env.deploy.enc` | Encrypted environment variables for PythonAnywhere deployment |
| `.env.keys.track` | List of environment variable keys tracked for deployment |
| `restore_pythonanywhere.ps1` | Run this to restore PythonAnywhere setup (reverses the migration) |

## Want to switch back to PythonAnywhere?

Run the restore script from the repo root:

```powershell
.\scripts\legacy\restore_pythonanywhere.ps1
```

This will:
1. Move all legacy files back to their original locations
2. Update `api-config.js` to point back to PythonAnywhere
3. Update `about.html` hosting text
4. Re-add the webhook URL route to `urls.py`

After running, you'll need to manually update your PythonAnywhere URL in `api-config.js` if it changed.
