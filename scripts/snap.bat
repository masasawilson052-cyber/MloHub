@echo off
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --no-sandbox --disable-gpu --user-data-dir="%TEMP%\chrome_snap" --window-size=390,844 --hide-scrollbars --virtual-time-budget=4000 "--screenshot=%~1" "%~2"
