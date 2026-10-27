@echo off
echo ========================================================
echo ==> 1. Enviando arquivos (clasp push --force)...
echo ========================================================
cmd.exe /c npx.cmd @google/clasp push --force
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha no push. Abortando deploy.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo ==> 2. Publicando nova versao (clasp deploy)...
echo ========================================================
cmd.exe /c npx.cmd @google/clasp deploy -d AutoDeploy
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha no deploy.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo ==> Sucesso! O sistema foi atualizado e publicado no GAS.
echo ========================================================
pause
