import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.task.count({ where: { done: false } });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
