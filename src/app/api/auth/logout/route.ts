import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  
  cookieStore.delete("gmail_access_token");
  cookieStore.delete("gmail_refresh_token");
  
  return NextResponse.redirect(new URL("/", "https://vsebezlepku-orders.vercel.app"));
}
