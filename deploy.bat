@echo off
REM Publish the gallery: stage everything, commit with a timestamp, and push.
REM Vercel rebuilds and optimizes the photos automatically after the push.
cd /d "%~dp0"

git add -A
git commit -m "Update %DATE% %TIME%"
git push

echo.
echo Done. Vercel will redeploy in about a minute.
pause
