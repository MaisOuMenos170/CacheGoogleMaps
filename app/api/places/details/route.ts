import { NextRequest, NextResponse } from "next/server";
import { getFreePlaceDetails } from "@/lib/free-places";

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

    const details = await getFreePlaceDetails(placeId);
    return NextResponse.json({ place: details });
  } catch (error) {
    console.error("Erro na rota /api/places/details:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao buscar detalhes do lugar." },
      { status: 500 }
    );
  }
}
