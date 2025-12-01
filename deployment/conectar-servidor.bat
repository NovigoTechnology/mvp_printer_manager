@echo off
echo ========================================
echo Conectando al servidor 10.10.10.193
echo ========================================
echo.
echo Contraseña: Novigo2025
echo.
echo Al conectar, ejecuta estos comandos:
echo.
echo   cd mvp_printer_manager/deployment
echo   chmod +x full-update.sh
echo   sudo bash full-update.sh
echo.
echo ========================================
pause
ssh im@10.10.10.193
