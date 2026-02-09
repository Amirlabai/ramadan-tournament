@echo off
REM Tournament Deployment Script
REM Runs Python stats update and pushes to GitHub

echo ========================================
echo   Ramadan Tournament - Deployment
echo ========================================
echo.

echo [1/4] Importing players from CSV...
python import_players.py
if errorlevel 1 (
    echo ERROR: Player import failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Updating statistics...
python update_stats.py
if errorlevel 1 (
    echo ERROR: Stats update failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Adding files to git...
git add .

echo.
echo [4/4] Committing and pushing to GitHub...
git commit -m "Update tournament stats - %date% %time%"
git push

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
pause
