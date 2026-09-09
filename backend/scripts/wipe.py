import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def force_wipe():
    # settings.DATABASE_URL is a MultiHostUrl in pydantic v2
    db_url = str(settings.DATABASE_URL)
    engine = create_async_engine(db_url, isolation_level="AUTOCOMMIT")
    async with engine.connect() as conn:
        print("Dropping schema public cascade...")
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        print("Creating schema public...")
        await conn.execute(text("CREATE SCHEMA public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    print("Database wiped successfully!")

if __name__ == "__main__":
    asyncio.run(force_wipe())
