@echo off
rem Einmalig: Schreib-Schluessel fuer das private GitHub-Repository eingeben (unsichtbar)
cd /d "%~dp0"
".venv\Scripts\python.exe" garmin_sync.py github-login
pause
