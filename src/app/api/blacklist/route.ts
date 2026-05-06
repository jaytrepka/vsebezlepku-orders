import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - List all blacklisted customers
export async function GET() {
  try {
    const customers = await prisma.blacklistedCustomer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error("Blacklist GET error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST - Add a new blacklisted customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, note } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const customer = await prisma.blacklistedCustomer.create({
      data: { name: name.trim(), note: note?.trim() || null },
    });
    return NextResponse.json(customer);
  } catch (error) {
    console.error("Blacklist POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

// PUT - Update a blacklisted customer
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, note } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 });
    }

    const customer = await prisma.blacklistedCustomer.update({
      where: { id },
      data: { name: name.trim(), note: note?.trim() || null },
    });
    return NextResponse.json(customer);
  } catch (error) {
    console.error("Blacklist PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE - Remove a blacklisted customer
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.blacklistedCustomer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Blacklist DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
