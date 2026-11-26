import { NextResponse } from "next/server";
import { route, validSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { isOpen } from "@/lib/time";

/** Who am I? Also tells the unlock page whether to show the nickname field. */
export const GET = route(async () => {
  const [session, settings] = await Promise.all([validSession(), getSettings()]);
  return NextResponse.json({
    session,
    askDeviceName: settings.askDeviceName,
    open: isOpen(settings.schedule),
  });
});
