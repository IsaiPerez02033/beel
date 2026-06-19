#!/bin/bash
# Script de inicio para Render — corre migraciones antes de arrancar el servidor
set -e

echo "🔄 Corriendo migraciones de base de datos..."
alembic upgrade head

echo "🚀 Iniciando servidor Beel..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
