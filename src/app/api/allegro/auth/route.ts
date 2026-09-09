import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.ALLEGRO_CLIENT_ID;
  const redirectUri = process.env.ALLEGRO_REDIRECT_URI || "https://vsebezlepku-orders.vercel.app/api/allegro/callback";

  if (!clientId) {
    return NextResponse.json({ error: "ALLEGRO_CLIENT_ID is not configured in environment variables" }, { status: 500 });
  }

  const allegroAuthUrl = `https://allegro.pl/auth/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(allegroAuthUrl);
}
