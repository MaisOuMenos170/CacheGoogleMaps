import { NextRequest, NextResponse } from "next/server";
import { fetchCatalogFromGitHub, commitCatalogToGitHub } from "@/lib/github";
import { getGooglePlaceDetails } from "@/lib/google-places";
import { CatalogItem, PlaceDetails } from "@/lib/types";

// GET /api/catalog - Lista todos os lugares do catálogo e metadados
export async function GET(req: NextRequest) {
  try {
    const customToken = req.headers.get("x-github-token");
    const catalog = await fetchCatalogFromGitHub(customToken);
    const existingIds = catalog.items.map((item) => item.place_id).filter(Boolean);

    return NextResponse.json({
      items: catalog.items,
      existingIds,
      count: catalog.items.length,
      path: catalog.path,
      branch: catalog.branch,
      sha: catalog.sha,
    });
  } catch (error) {
    console.error("Erro na rota GET /api/catalog:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar catálogo no GitHub." },
      { status: 500 }
    );
  }
}

// POST /api/catalog - Adiciona um novo lugar ao catálogo no GitHub
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { place_id, place: providedPlace } = body;

    if (!place_id && !providedPlace?.place_id) {
      return NextResponse.json(
        { error: "place_id é obrigatório para adicionar ao catálogo." },
        { status: 400 }
      );
    }

    const targetPlaceId = place_id || providedPlace.place_id;

    const customToken = req.headers.get("x-github-token");

    // 1. Obter o catálogo atual do GitHub
    const currentCatalog = await fetchCatalogFromGitHub(customToken);

    // 2. Verificação de duplicidade por place_id
    const existingPlace = currentCatalog.items.find((item) => item.place_id === targetPlaceId);
    if (existingPlace) {
      return NextResponse.json(
        {
          error: "Esse lugar já está na lista!",
          alreadyExists: true,
          place: existingPlace,
        },
        { status: 409 }
      );
    }

    // 3. Obter detalhes completos se não fornecidos ou para garantir integridade máxima
    let fullDetails: PlaceDetails;
    if (providedPlace && providedPlace.formatted_address && providedPlace.geometry) {
      fullDetails = providedPlace;
    } else {
      const customApiKey = req.headers.get("x-google-api-key");
      fullDetails = await getGooglePlaceDetails(targetPlaceId, customApiKey);
    }

    // 4. Montar o novo item do catálogo
    const newItem: CatalogItem = {
      ...fullDetails,
      added_at: new Date().toISOString(),
    };

    const updatedItems = [...currentCatalog.items, newItem];

    // 5. Salvar / Fazer commit no GitHub
    const commitMessage = `Adiciona "${newItem.name}" ao catálogo de lugares`;
    const commitResult = await commitCatalogToGitHub(
      updatedItems,
      currentCatalog.sha,
      commitMessage,
      customToken
    );

    return NextResponse.json({
      success: true,
      message: `"${newItem.name}" foi adicionado com sucesso ao GitHub!`,
      item: newItem,
      totalItems: updatedItems.length,
      commitSha: commitResult.commitSha,
      fileUrl: commitResult.fileUrl,
    });
  } catch (error) {
    console.error("Erro na rota POST /api/catalog:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao salvar lugar no GitHub." },
      { status: 500 }
    );
  }
}
