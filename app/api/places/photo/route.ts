import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const photoRef = searchParams.get("ref");
    const maxWidth = searchParams.get("maxwidth") || "800";

    const apiKey = req.headers.get("x-google-api-key") || process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Google API key não configurada." }, { status: 500 });
    }

    if (!photoRef) {
      return NextResponse.json({ error: "Parâmetro 'ref' é obrigatório." }, { status: 400 });
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${encodeURIComponent(
      photoRef
    )}&key=${apiKey}`;

    const res = await fetch(photoUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Falha ao buscar imagem do Google Places." }, { status: res.status });
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
    return NextResponse.json({ error: "Erro ao processar imagem." }, { status: 500 });
  }
}
