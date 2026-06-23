"""
Siembra (o borra) propiedades de ejemplo en la base de datos real.

Todas las propiedades demo pertenecen a un único usuario (demo@beel.mx),
así que se pueden borrar TODAS de golpe sin tocar las de usuarios reales.

Uso:
    python -m scripts.seed_demo            # inserta las propiedades demo
    python -m scripts.seed_demo --delete   # borra TODAS las propiedades demo
    python -m scripts.seed_demo --delete --purge-host   # además borra el usuario demo

Nota: si tu plan de Render no incluye Shell, usa el endpoint admin equivalente
(/api/v1/properties/admin/seed-demo) — ver demo_seed.py.
"""

import asyncio
import sys

from app.core.database import AsyncSessionLocal
from app.modules.properties.demo_seed import seed_demo_data, delete_demo_data


async def main():
    async with AsyncSessionLocal() as db:
        if "--delete" in sys.argv:
            res = await delete_demo_data(db, purge_host="--purge-host" in sys.argv)
            print(f"✓ Borradas {res['deleted']} propiedades demo. "
                  f"Usuario demo borrado: {res['host_purged']}")
        else:
            res = await seed_demo_data(db)
            print(f"✓ Insertadas {len(res['created'])} propiedades "
                  f"(omitidas {res['skipped']} ya existentes). "
                  f"Dueño: {res['host_email']}")
            for t in res["created"]:
                print(f"  + {t}")


if __name__ == "__main__":
    if AsyncSessionLocal is None:
        print("✗ Sin DATABASE_URL configurado. Aborta.")
        sys.exit(1)
    asyncio.run(main())
