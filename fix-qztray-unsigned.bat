@echo off
:: Remove trailing space from allow-unsigned=true in qz-tray.properties
:: Run as Administrator

echo Corrigindo qz-tray.properties...

powershell -Command "$path = 'C:\Program Files\QZ Tray\qz-tray.properties'; $content = Get-Content $path; $fixed = $content | ForEach-Object { $_ -replace 'allow-unsigned=true\s*$', 'allow-unsigned=true' }; Set-Content -Path $path -Value $fixed -Encoding UTF8; Write-Host 'Arquivo corrigido.'"

echo.
echo Encerrando QZ Tray...
taskkill /F /IM javaw.exe /T 2>/dev/null
timeout /t 2 /nobreak >/dev/null

echo Iniciando QZ Tray...
start "" "C:\Program Files\QZ Tray\qz-tray.exe"

echo.
echo Pronto! QZ Tray foi reiniciado.
echo Aguarde alguns segundos e clique em "Verificar" no app.
pause
