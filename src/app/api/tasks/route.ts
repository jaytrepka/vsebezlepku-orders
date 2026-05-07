import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - List all tasks
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, priority, deadline } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Get max sortOrder for this priority to append at end
    const maxOrder = await prisma.task.aggregate({
      _max: { sortOrder: true },
      where: { priority: priority || "medium" },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        priority: priority || "medium",
        deadline: deadline ? new Date(deadline) : null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error("Tasks POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

// PUT - Update a task (including reorder)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, priority, deadline, done, reorder } = body;

    // Bulk reorder: [{id, sortOrder}, ...]
    if (reorder && Array.isArray(reorder)) {
      for (const item of reorder) {
        await prisma.task.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (priority !== undefined) data.priority = priority;
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (done !== undefined) data.done = done;

    const task = await prisma.task.update({ where: { id }, data });
    return NextResponse.json(task);
  } catch (error) {
    console.error("Tasks PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE - Remove a task
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tasks DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
