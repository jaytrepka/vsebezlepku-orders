import { NextRequest, NextResponse } from "next/server";
import { saveAllegroTokensToDb } from "@/lib/allegroTokenStorage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; background: #fff1f0; color: #cf1322;">
          <h2>❌ Chyba autorizace Allegra</h2>
          <p><strong>${error}</strong>: ${errorDescription || "Autorizace byla zrušena nebo selhala."}</p>
          <a href="/api/allegro/auth" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #ff4d4f; color: white; text-decoration: none; border-radius: 6px;">Zkusit znovu</a>
        </body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    if (!code) {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px;">
          <h2>Chybí autorizační kód</h2>
          <p>Allegro nevrátilo kód autorizace.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const clientId = process.env.ALLEGRO_CLIENT_ID;
    const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;
    const redirectUri = process.env.ALLEGRO_REDIRECT_URI || "https://vsebezlepku-orders.vercel.app/api/allegro/callback";
    const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

    if (!clientId || !clientSecret) {
      return new Response("Chybí ALLEGRO_CLIENT_ID nebo ALLEGRO_CLIENT_SECRET na serveru", { status: 500 });
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResponse = await fetch("https://allegro.pl/auth/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Allegro OAuth] Token exchange error:", errorText);
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; background: #fff1f0; color: #cf1322;">
          <h2>❌ Chyba při získávání tokenu z Allegra</h2>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 6px;">${errorText}</pre>
          <a href="/api/allegro/auth" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #ff4d4f; color: white; text-decoration: none; border-radius: 6px;">Zkusit znovu</a>
        </body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { refresh_token, access_token, expires_in } = tokenData;

    // Save tokens directly to PostgreSQL database so they auto-rotate forever!
    try {
      await saveAllegroTokensToDb(access_token, refresh_token, expires_in);
    } catch (dbErr) {
      console.error("[Allegro Callback] DB token save error:", dbErr);
    }

    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>Allegro autorizace úspěšná</title>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0fdf4; color: #166534; padding: 40px; max-width: 700px; margin: 0 auto; line-height: 1.6; }
          .card { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #bbf7d0; }
          h1 { margin-top: 0; color: #15803d; display: flex; align-items: center; gap: 10px; }
          .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; cursor: pointer; border: none; margin-top: 15px; }
          .btn:hover { background: #15803d; }
          .badge { background: #dcfce7; color: #15803d; padding: 6px 12px; border-radius: 20px; font-weight: 600; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Allegro bylo úspěšně propojeno!</h1>
          <p><span class="badge">Automaticky uloženo do databáze</span></p>
          <p>Přístupové tokeny byly automaticky uloženy přímo do databáze aplikace. <strong>Nemusíte nic kopírovat ani nastavovat na Vercelu</strong> – aplikace si bude tokeny automaticky obnovovat sama 24/7!</p>
          
          <a class="btn" href="/api/allegro/sync-order">🚀 Vyzkoušet okamžitou synchronizaci poslední objednávky</a>
        </div>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("[Allegro Callback] Error:", error);
    return new Response("Došlo k neočekávané chybě při autorizaci Allegra", { status: 500 });
  }
}
