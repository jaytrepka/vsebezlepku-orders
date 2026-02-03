import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
        skladovani: data.skladovani || null,
        vyrobce: data.vyrobce,
      },
      create: {
        productName: data.productName,
        nazev: data.nazev,
        slozeni: data.slozeni,
        nutricniHodnoty: data.nutricniHodnoty,
        skladovani: data.skladovani || null,
        vyrobce: data.vyrobce,
      },
    });

    // Link this label to all existing OrderItems with the same productName
    await prisma.orderItem.updateMany({
      where: { productName: data.productName },
      data: { labelId: label.id },
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
