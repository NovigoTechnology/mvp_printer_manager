@echo off
REM Script de Actualización del Servidor
REM Actualiza la rama main y ejecuta migraciones de base de datos

setlocal enabledelayedexpansion

cls
echo ╔════════════════════════════════════════════════════╗
echo ║   Actualización del Servidor - MVP Printer Manager ║
echo ╚════════════════════════════════════════════════════╝
echo.
echo IP del Servidor: 10.10.10.193
echo Usuario: im
echo.
echo Presione Enter para conectar...
pause

echo.
echo 🔐 Conectando al servidor...
echo.

ssh im@10.10.10.193 "cd ~/mvp_printer_manager && ^
  echo 📥 Actualizando repositorio... && ^
  git checkout main && ^
  git pull origin main && ^
  echo ✅ Repositorio actualizado && ^
  echo. && ^
  echo 🔄 Ejecutando migraciones de base de datos... && ^
  python api/migrations/add_user_tracking_to_incidents.py && ^
  python api/app/migrations/add_cost_center_fk_to_contracts_and_printers.py && ^
  echo ✅ Migraciones ejecutadas && ^
  echo. && ^
  echo 🐳 Reiniciando contenedores Docker... && ^
  docker compose restart && ^
  echo ✅ Servidor actualizado correctamente!"

echo.
echo ✨ Proceso completado
pause
