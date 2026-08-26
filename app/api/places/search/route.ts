import { NextRequest, NextResponse } from "next/server";
import { searchGooglePlaces } from "@/lib/google-places";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body?.query;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "O campo 'query' é obrigatório para a pesquisa." },
        { status: 400 }
      );
    }

    const customApiKey = req.headers.get("x-google-api-key");
    const results = await searchGooglePlaces(query, customApiKey);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erro na rota /api/places/search:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao buscar lugares." },
      { status: 500 }
    );
  }
}
