@echo off
title BarMaster
cd /d "%~dp0"
echo.
echo  Iniciando BarMaster...
echo.

REM Verifica se cloudflared.exe existe, baixa se necessario
if not exist "%~dp0cloudflared.exe" (
  echo  [Tunel] Baixando cloudflared para QR Code sem tela de senha...
  powershell -Command "& '%~dp0baixar-cloudflared.ps1'" 2>/dev/null
  if exist "%~dp0cloudflared.exe" (
    echo  [Tunel] Download concluido!
  ) else (
    echo  [Tunel] Aviso: cloudflared nao disponivel. Sera usado localtunnel.
  )
)
echo.

REM Inicia o servidor (API + Vite)
start "BarMaster App" cmd /k "npm start"

REM Aguarda o servidor subir
echo  Aguardando servidor iniciar...
timeout /t 6 /nobreak >/dev/null

REM Descobre o IP local
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "169.254"') do (
  set RAW=%%A
  goto :found
)
:found
set IP=%RAW: =%

REM Abre o admin pelo IP local (para que o QR code funcione no celular)
if defined IP (
  start "" "http://%IP%:5173"
) else (
  start "" "http://localhost:5173"
)
