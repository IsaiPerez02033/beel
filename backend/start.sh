#!/bin/bash
# Script de inicio para Render
set -e

# Render corre desde la raíz del repo; moverse a backend/
if [ -d "backend" ]; then
  cd backend
fi

echo "🔄 Corriendo migraciones de base de datos..."
# -c apunta al alembic.ini; alembic corre desde backend/ donde está app/
alembic -c alembic/alembic.ini upgrade head

echo "🚀 Iniciando servidor Beel..."
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
