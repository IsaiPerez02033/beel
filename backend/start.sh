#!/bin/bash
# Script de inicio para Render — corre migraciones antes de arrancar el servidor
set -e

# Moverse al directorio del backend si estamos en la raíz del repo
if [ -d "backend" ]; then
  cd backend
fi

echo "🔄 Corriendo migraciones de base de datos..."
cd alembic && alembic upgrade head && cd ..

echo "🚀 Iniciando servidor Beel..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
