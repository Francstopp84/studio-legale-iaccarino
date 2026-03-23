@echo off
title Avv. Iaccarino Studio - Avvio completo
color 0A
echo.
echo ============================================
echo    AVV. IACCARINO STUDIO - Avvio Completo
echo ============================================
echo.

:: Verifica Ollama
echo [1/3] Verifico Ollama...
ollama list >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama non in esecuzione. Avvio...
    start "" ollama serve
    timeout /t 3 /nobreak >nul
)
echo [OK] Ollama attivo

:: Avvia Next.js in background
echo [2/3] Avvio Next.js...
cd /d "%~dp0"
start "AIS-NextJS" cmd /c "npm run dev"
timeout /t 5 /nobreak >nul
echo [OK] Next.js su http://localhost:3000

:: Avvia Cloudflare Tunnel con nome fisso
echo [3/3] Avvio tunnel Cloudflare...
echo.
echo ============================================
echo    APP DISPONIBILE OVUNQUE:
echo.
echo    PC:        http://localhost:3000
echo    Cellulare: https://braynr.studiolegalefrancescoiaccarino.com
echo ============================================
echo.
"%~dp0cloudflared.exe" tunnel run braynr-studio
