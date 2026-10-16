import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Primera barrera para /admin. Cada ruta de /api/admin vuelve a validar el rol contra la BD (requireAdmin).
export async function middleware(req: NextRequest) {
  try {
    const { payload } = await jwtVerify(
      req.cookies.get("session")?.value ?? "",
      new TextEncoder().encode(process.env.JWT_SECRET!),
    );
    if (payload.role === "ADMIN") return NextResponse.next();
  } catch {}
  return req.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "No autorizado" }, { status: 403 })
    : NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
