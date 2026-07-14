<#
.SYNOPSIS
    Restores the PythonAnywhere deployment setup by moving legacy files
    back to their original locations and reverting code changes.

.DESCRIPTION
    Run this from the repository root:
        .\scripts\legacy\restore_pythonanywhere.ps1
#>

$ErrorActionPreference = "Stop"
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    $repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
}

$legacyDir = Join-Path $repoRoot "scripts\legacy"

Write-Host "`n=== Restoring PythonAnywhere Setup ===" -ForegroundColor Cyan

# 1. Move files back to original locations
$moves = @(
    @{ From = "$legacyDir\deploy_pythonanywhere.sh";  To = "$repoRoot\scripts\deploy_pythonanywhere.sh" }
    @{ From = "$legacyDir\webhooks.py";               To = "$repoRoot\server\core\webhooks.py" }
    @{ From = "$legacyDir\.env.deploy.enc";            To = "$repoRoot\.env.deploy.enc" }
    @{ From = "$legacyDir\.env.keys.track";            To = "$repoRoot\.env.keys.track" }
)

foreach ($move in $moves) {
    if (Test-Path $move.From) {
        Move-Item -Path $move.From -Destination $move.To -Force
        Write-Host "  Moved: $(Split-Path $move.From -Leaf) -> $(Split-Path $move.To -Parent)" -ForegroundColor Green
    } else {
        Write-Host "  Skip (not found): $(Split-Path $move.From -Leaf)" -ForegroundColor Yellow
    }
}

# 2. Update api-config.js: Render URL -> PythonAnywhere URL
$apiConfig = Join-Path $repoRoot "client\static\js\api-config.js"
if (Test-Path $apiConfig) {
    $content = Get-Content $apiConfig -Raw
    $content = $content -replace "https://sir-kothay-server\.onrender\.com", "https://TahsinFaiyaz30.pythonanywhere.com"
    Set-Content $apiConfig -Value $content -NoNewline
    Write-Host "  Updated: api-config.js -> PythonAnywhere URL" -ForegroundColor Green
}

# 3. Update about.html: Render -> PythonAnywhere
$aboutHtml = Join-Path $repoRoot "client\about.html"
if (Test-Path $aboutHtml) {
    $content = Get-Content $aboutHtml -Raw
    $content = $content -replace "Hosting:</span> Render", "Hosting:</span> PythonAnywhere"
    Set-Content $aboutHtml -Value $content -NoNewline
    Write-Host "  Updated: about.html -> PythonAnywhere" -ForegroundColor Green
}

# 4. Re-add webhook import and URL to urls.py
$urlsFile = Join-Path $repoRoot "server\core\urls.py"
if (Test-Path $urlsFile) {
    $content = Get-Content $urlsFile -Raw

    # Add 'from . import webhooks' after 'from . import views'
    if ($content -notmatch "from \. import webhooks") {
        $content = $content -replace "(from \. import views)", "`$1`r`nfrom . import webhooks"
        Write-Host "  Updated: urls.py -> added webhooks import" -ForegroundColor Green
    }

    # Add webhook URL before the closing ] + static(...)
    if ($content -notmatch "github-webhook") {
        $content = $content -replace "(path\('api/health/'.*?api_health'\),)", "`$1`r`n    path('api/github-webhook/', webhooks.github_webhook, name='github_webhook'),"
        Write-Host "  Updated: urls.py -> added webhook URL" -ForegroundColor Green
    }

    Set-Content $urlsFile -Value $content -NoNewline
}

Write-Host "`n=== PythonAnywhere setup restored! ===" -ForegroundColor Cyan
Write-Host "Don't forget to:" -ForegroundColor Yellow
Write-Host "  1. Update your PythonAnywhere URL in api-config.js if it changed" -ForegroundColor Yellow
Write-Host "  2. Set GITHUB_WEBHOOK_SECRET in your .env" -ForegroundColor Yellow
Write-Host "  3. git add -A; git commit -m 'Restore PythonAnywhere setup'; git push" -ForegroundColor Yellow
Write-Host ""
