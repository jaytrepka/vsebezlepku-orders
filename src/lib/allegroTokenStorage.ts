import { prisma } from "@/lib/prisma";

export interface StoredAllegroToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

let tableEnsured = false;

export async function ensureTokenTableExists(): Promise<void> {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AllegroToken" (
        id TEXT PRIMARY KEY DEFAULT 'allegro_token',
        "accessToken" TEXT NOT NULL,
        "refreshToken" TEXT NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    tableEnsured = true;
  } catch (err) {
    console.error("[AllegroTokenStorage] Table init error:", err);
  }
}

export async function saveAllegroTokensToDb(accessToken: string, refreshToken: string, expiresInSec: number): Promise<void> {
  await ensureTokenTableExists();
  const expiresAt = new Date(Date.now() + (expiresInSec || 43200) * 1000);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "AllegroToken" (id, "accessToken", "refreshToken", "expiresAt", "updatedAt")
    VALUES ('allegro_token', $1, $2, $3, NOW())
    ON CONFLICT (id) DO UPDATE SET
      "accessToken" = EXCLUDED."accessToken",
      "refreshToken" = EXCLUDED."refreshToken",
      "expiresAt" = EXCLUDED."expiresAt",
      "updatedAt" = NOW();
  `, accessToken, refreshToken, expiresAt);
  
  console.log("[AllegroTokenStorage] ✅ Allegro tokeny úspěšně uloženy do databáze.");
}

export async function getAllegroTokensFromDb(): Promise<StoredAllegroToken | null> {
  await ensureTokenTableExists();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      accessToken: string;
      refreshToken: string;
      expiresAt: Date | string;
    }>>(`SELECT "accessToken", "refreshToken", "expiresAt" FROM "AllegroToken" WHERE id = 'allegro_token' LIMIT 1;`);

    if (rows && rows.length > 0) {
      return {
        accessToken: rows[0].accessToken,
        refreshToken: rows[0].refreshToken,
        expiresAt: new Date(rows[0].expiresAt),
      };
    }
    return null;
  } catch (err) {
    console.error("[AllegroTokenStorage] Error reading token:", err);
    return null;
  }
}
