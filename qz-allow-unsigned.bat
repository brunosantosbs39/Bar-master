@echo off
echo ============================================
echo  QZ Tray - Resetar permissoes e configurar
echo ============================================
echo.

REM 1. Matar todos os processos do QZ Tray
echo [1/4] Encerrando QZ Tray...
taskkill /F /IM qz-tray-console.exe /T >nul 2>&1
taskkill /F /IM qz-tray.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

REM 2. Limpar site manager (arquivos de permissao bloqueada)
echo [2/4] Limpando permissoes de sites bloqueados...
set QZ_DATA=%APPDATA%\qz

if exist "%QZ_DATA%" (
  REM Remove arquivos de certificado/permissao (extensoes .crt, .pem, .cer, .der)
  del /F /Q "%QZ_DATA%\*.crt" >nul 2>&1
  del /F /Q "%QZ_DATA%\*.pem" >nul 2>&1
  del /F /Q "%QZ_DATA%\*.cer" >nul 2>&1
  del /F /Q "%QZ_DATA%\*.der" >nul 2>&1
  REM Remove site manager JSON se existir
  del /F /Q "%QZ_DATA%\site-manager.json" >nul 2>&1
  del /F /Q "%QZ_DATA%\site-manager.properties" >nul 2>&1
  echo [OK] Arquivos de permissao removidos de %QZ_DATA%
) else (
  echo [INFO] Diretorio %QZ_DATA% nao encontrado
)

REM 3. Escrever allow-unsigned=true em todos os locais possiveis
echo [3/4] Configurando allow-unsigned=true...

set PROPS1=C:\Program Files\QZ Tray\qz-tray.properties
set PROPS2=C:\Program Files (x86)\QZ Tray\qz-tray.properties
set PROPS3=%APPDATA%\qz\qz-tray.properties
set PROPS4=%USERPROFILE%\.qz\qz-tray.properties

for %%F in ("%PROPS1%" "%PROPS2%" "%PROPS3%" "%PROPS4%") do (
  powershell -Command "$f='%%~F'; $dir=Split-Path $f; if(!(Test-Path $dir)){New-Item -ItemType Directory -Path $dir -Force | Out-Null}; $lines=@(); if(Test-Path $f){$lines=(Get-Content $f) | Where-Object {$_ -notmatch '^allow-unsigned' -and $_ -notmatch '^websocket.insecure'}}; ($lines + 'allow-unsigned=true' + 'websocket.insecure=true') | Set-Content $f" >nul 2>&1
  echo [OK] Configurado: %%F
)

REM 4. Reiniciar QZ Tray
echo [4/4] Iniciando QZ Tray...
set QZ_EXE=
if exist "C:\Program Files\QZ Tray\qz-tray-console.exe" set QZ_EXE=C:\Program Files\QZ Tray\qz-tray-console.exe
if exist "C:\Program Files (x86)\QZ Tray\qz-tray-console.exe" set QZ_EXE=C:\Program Files (x86)\QZ Tray\qz-tray-console.exe

if defined QZ_EXE (
  start "" "%QZ_EXE%"
  echo [OK] QZ Tray iniciado!
) else (
  echo [ATENCAO] Nao encontrou QZ Tray. Inicie manualmente.
)

echo.
echo ============================================
echo  Pronto! Agora:
echo  1. Aguarde QZ Tray aparecer na bandeja
echo  2. Recarregue a pagina (F5)
echo  3. Clique "Verificar"
echo  4. Se aparecer dialogo no QZ Tray, clique ALLOW
echo ============================================
echo.
pause
