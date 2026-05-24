import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()


async def main() -> None:
    pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])

    async with pool.acquire() as conn:
        tables = await conn.fetch(
            """
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name;
            """
        )

        if not tables:
            print("No tables found.")
            return

        print(f"{'SCHEMA':<15} {'TABLE':<35} {'TYPE'}")
        print("-" * 60)
        for row in tables:
            print(f"{row['table_schema']:<15} {row['table_name']:<35} {row['table_type']}")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
