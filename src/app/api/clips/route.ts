import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clips } from "@/db/schema";
import { v4 as uuid } from "uuid";
import { desc } from "drizzle-orm";

// GET all clips
export async function GET() {
  try {
    const all = await db.select().from(clips).orderBy(desc(clips.createdAt)).limit(50);
    return NextResponse.json({ clips: all });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ clips: [] });
  }
}

// POST a new clip
export async function POST(req: NextRequest) {
  try {
    const { url, title, author } = await req.json();

    if (!url?.trim() || !title?.trim() || !author?.trim()) {
      return NextResponse.json({ error: "url, title, and author are required" }, { status: 400 });
    }

    // Validate it's a medal.tv URL
    const trimmedUrl = url.trim();
    if (!trimmedUrl.includes("medal.tv")) {
      return NextResponse.json({ error: "only medal.tv links are supported" }, { status: 400 });
    }

    const id = uuid();
    await db.insert(clips).values({
      id,
      url: trimmedUrl,
      title: title.trim(),
      author: author.trim(),
      pinned: false,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error creating clip:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}
