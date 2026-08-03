import { NextResponse } from "next/server";
import { pool } from "@/db";

export async function GET() {
  try {
    // Test database connection
    const result = await pool.query("SELECT 1 as test");
    
    if (result.rows[0]?.test === 1) {
      return NextResponse.json({ ok: true, db: "connected" });
    }
    
    return NextResponse.json({ ok: false, db: "query failed" }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ 
      ok: false, 
      db: "error",
      error: message 
    }, { status: 500 });
  }
}
