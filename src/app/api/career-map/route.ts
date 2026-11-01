import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { profileJson, ProfileError } from "@/lib/career-profile/http";
import { careerMapErrorResponse } from "@/lib/career-map/error-response";
import { careerMapStore, createMap, mapInputSchema } from "@/lib/career-map/service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const store = careerMapStore();
    const [maps, goals] = await Promise.all([
      store.maps.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      store.goals.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    ]);
    return NextResponse.json({ maps, goals }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return careerMapErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const store = careerMapStore();
    const count = await store.maps.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (count >= 5) throw new ProfileError(429, "MAP_LIMIT");
    const input = mapInputSchema.parse(await profileJson(req));
    const result = await createMap(user.id, input, req.signal);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return careerMapErrorResponse(error);
  }
}
