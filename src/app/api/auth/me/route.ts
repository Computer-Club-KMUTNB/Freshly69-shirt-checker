import { NextResponse } from "next/server";
import { route, validSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { isOpen } from "@/lib/time";

/** Who am I? (+ whether staff may use the system right now) */
export const GET = route(async () => {
  const [session, settings] = await Promise.all([validSession(), getSettings()]);
  return NextResponse.json({
    session,
    open: isOpen(settings.schedule),
  });
});
