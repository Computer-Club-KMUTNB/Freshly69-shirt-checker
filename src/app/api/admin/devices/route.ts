import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

/** ADMIN: every phone that has unlocked the app. */
export const GET = route(async () => {
  await requireSession("admin");
  const { data, error } = await db().from("devices").select("*").order("last_seen", { ascending: false });
  if (error) throw error;
  return NextResponse.json(data);
});
