# Compilar APK — Mesh Network Venezuela
# Ejecutar en PowerShell desde la carpeta del proyecto

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== Mesh Network Venezuela — Build APK ===" -ForegroundColor Cyan
Write-Host "1. Verificando dependencias...`n"

if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "`n2. Iniciando sesion EAS (se abrira el navegador)...`n"
npx eas-cli login

Write-Host "`n3. Vinculando proyecto Expo (solo la primera vez)...`n"
npx eas-cli init

Write-Host "`n4. Compilando APK en la nube (10-20 min)...`n"
npx eas-cli build --platform android --profile preview

Write-Host "`n=== LISTO ===" -ForegroundColor Green
Write-Host "Descarga el .apk desde el enlace que muestra EAS."
Write-Host "Instalacion en teléfonos: ver INSTALACION_APK_CAMPO.md`n"
