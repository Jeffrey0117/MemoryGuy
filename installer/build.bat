@echo off
REM ============================================================
REM MemoryGuy NSIS Installer Build Script
REM
REM Prerequisites:
REM   1. NSIS 3.x installed and in PATH
REM      https://nsis.sourceforge.io/Download  (or: choco install nsis)
REM   2. App packaged: npm run package
REM   3. (Optional) Companion installers in installer\companions\
REM ============================================================

cd /d "%~dp0"

REM --- Check NSIS ---
where makensis >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] makensis not found. Install NSIS 3.x and add to PATH.
    echo         https://nsis.sourceforge.io/Download
    echo         Or: choco install nsis
    exit /b 1
)

REM --- Check packaged app ---
if not exist "..\out\MemoryGuy-win32-x64\MemoryGuy.exe" (
    echo [ERROR] Packaged app not found at out\MemoryGuy-win32-x64\
    echo         Run "npm run package" first.
    exit /b 1
)

REM --- Report companion status ---
echo.
echo Companion tools:
if exist "companions\REPIC-Setup.exe" (
    echo   [OK] REPIC-Setup.exe
) else (
    echo   [--] REPIC-Setup.exe not found (checkbox will be skipped)
)
if exist "companions\REVID-Setup.exe" (
    echo   [OK] REVID-Setup.exe
) else (
    echo   [--] REVID-Setup.exe not found (checkbox will be skipped)
)
echo.

REM --- Build ---
echo Building NSIS installer...
makensis memoryguy.nsi
if %ERRORLEVEL% neq 0 (
    echo [ERROR] NSIS build failed.
    exit /b 1
)

echo.
echo [OK] MemoryGuy-Setup.exe created successfully.
echo.
