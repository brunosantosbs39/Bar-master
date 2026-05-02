Write-Host "Baixando cloudflared.exe..." -ForegroundColor Cyan
$dest = "$PSScriptRoot\cloudflared.exe"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $dest -UseBasicParsing
    Write-Host "Concluido! cloudflared.exe salvo em: $dest" -ForegroundColor Green
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
pause
