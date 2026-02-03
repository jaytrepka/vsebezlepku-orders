import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const labels = await prisma.productLabel.findMany({
      orderBy: { productName: "asc" },
    });

    return NextResponse.json(labels);
  } catch (error) {
    console.error("Labels fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch labels" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const label = await prisma.productLabel.upsert({
      where: { productName: data.productName },
      update: {
        nazev: data.nazev,
        slozeni: data.slozeni,
        nutricniHodnoty: data.nutricniHodnoty,
        skladovani: data.skladovani,
        vyrobce: data.vyrobce,
      },
      create: {
        productName: data.productName,
        nazev: data.nazev,
        slozeni: data.slozeni,
        nutricniHodnoty: data.nutricniHodnoty,
        skladovani: data.skladovani,
        vyrobce: data.vyrobce,
      },
    });

    return NextResponse.json(label);
  } catch (error) {
    console.error("Label save error:", error);
    return NextResponse.json(
      { error: "Failed to save label" },
      { status: 500 }
    );
  }
}
