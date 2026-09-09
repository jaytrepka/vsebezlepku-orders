import { NextRequest, NextResponse } from "next/server";

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
          .token-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: monospace; word-break: break-all; margin: 15px 0; font-size: 14px; color: #334155; }
          .btn { display: inline-block; background: #16a34a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; cursor: pointer; border: none; }
          .btn:hover { background: #15803d; }
          .step { margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Allegro bylo úspěšně propojeno!</h1>
          <p>Přístupový token byl vygenerován. Pro trvalé automatické fungování synchronizace vložte tento <strong>Refresh Token</strong> do proměnných prostředí na Vercelu (a do lokálního <code>.env.local</code>):</p>
          
          <div class="token-box" id="token">${refresh_token}</div>
          
          <button class="btn" onclick="navigator.clipboard.writeText('${refresh_token}'); alert('Refresh Token zkopírován do schránky!');">📋 Zkopírovat Refresh Token</button>
          
          <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <h3>Nastavení proměnné na Vercelu:</h3>
            <div class="step">1. Otevřete Vercel Dashboard &rarr; Projekt <strong>vsebezlepku-orders</strong> &rarr; <strong>Settings</strong> &rarr; <strong>Environment Variables</strong>.</div>
            <div class="step">2. Přidejte klíč <code>ALLEGRO_REFRESH_TOKEN</code> a vložte výše uvedený token.</div>
            <div class="step">3. Nyní bude Vercel schopen automaticky aktualizovat kusy na Allegru 24/7!</div>
          </div>
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
