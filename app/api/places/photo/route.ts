import { NextRequest, NextResponse } from "next/server";
import { proxyPhoto } from "@/lib/free-places";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const photoRef = searchParams.get("ref");
    const url = searchParams.get("url"); // For Wikimedia images
    const maxWidth = searchParams.get("maxwidth") || "800";

    if (!photoRef) {
      return NextResponse.json({ error: "Parâmetro 'ref' é obrigatório." }, { status: 400 });
    }

    const res = await proxyPhoto(photoRef, url || undefined);
    
    if (!res.ok) {
      return NextResponse.json({ error: "Falha ao buscar imagem." }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (error) {
    console.error("Erro na rota de foto:", error);
    // Return a placeholder SVG instead of error
    const placeholderSvg = `
      <svg width="${800}" height="${600}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#e5e7eb"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
              font-family="system-ui" font-size="16" fill="#9ca3af">
          Imagem não disponível
        </text>
      </svg>
    `;
    return new NextResponse(placeholderSvg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
}
