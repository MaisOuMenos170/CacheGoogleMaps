import { NextRequest, NextResponse } from "next/server";
import { getGooglePlaceDetails } from "@/lib/google-places";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("place_id");

    if (!placeId) {
      return NextResponse.json(
        { error: "O parâmetro 'place_id' é obrigatório." },
        { status: 400 }
      );
    }

    const customApiKey = req.headers.get("x-google-api-key");
    const details = await getGooglePlaceDetails(placeId, customApiKey);
    return NextResponse.json({ place: details });
  } catch (error) {
    console.error("Erro na rota /api/places/details:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao buscar detalhes do lugar." },
      { status: 500 }
    );
  }
}
