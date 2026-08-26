"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  MapPin,
  Star,
  Globe,
  Phone,
  Clock,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  Settings,
  X,
  Plus,
  Compass,
  Download,
  CheckCircle,
  Trash2,
  Pencil,
  Tag,
} from "lucide-react";
import { CatalogItem, PlaceDetails, PlaceSearchResult } from "@/lib/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"search" | "catalog">("search");

  // Credenciais
  const [googleApiKey, setGoogleApiKey] = useState<string>("");
  const [githubToken, setGithubToken] = useState<string>("");
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>("");
  const [tempGithubToken, setTempGithubToken] = useState<string>("");

  useEffect(() => {
    const savedApiKey = localStorage.getItem("google_places_api_key") || "";
    const savedGithubToken = localStorage.getItem("github_token") || "";
    if (savedApiKey) {
      setGoogleApiKey(savedApiKey);
      setTempApiKey(savedApiKey);
    }
    if (savedGithubToken) {
      setGithubToken(savedGithubToken);
      setTempGithubToken(savedGithubToken);
    }
  }, []);

  const handleSaveSettings = () => {
    const trimmedApiKey = tempApiKey.trim();
    setGoogleApiKey(trimmedApiKey);
    if (trimmedApiKey) {
      localStorage.setItem("google_places_api_key", trimmedApiKey);
    } else {
      localStorage.removeItem("google_places_api_key");
    }

    const trimmedToken = tempGithubToken.trim();
    setGithubToken(trimmedToken);
    if (trimmedToken) {
      localStorage.setItem("github_token", trimmedToken);
    } else {
      localStorage.removeItem("github_token");
    }

    setShowSettingsModal(false);
    setTimeout(() => {
      loadCatalog(trimmedToken);
    }, 100);
  };

  const getCustomHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (googleApiKey) headers["x-google-api-key"] = googleApiKey;
    if (githubToken) headers["x-github-token"] = githubToken;
    return headers;
  }, [googleApiKey, githubToken]);

  // Catálogo do GitHub
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [catalogPath, setCatalogPath] = useState<string>("data/lugares.json");
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Busca
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Detalhes Selecionados
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetails | null>(null);
  const [newPlaceNickname, setNewPlaceNickname] = useState<string>("");
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Ações de Salvar / Excluir / Renomear
  const [savingToGitHub, setSavingToGitHub] = useState(false);
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  const [updatingPlaceId, setUpdatingPlaceId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{ message: string; fileUrl?: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal de Exclusão
  const [itemToDelete, setItemToDelete] = useState<{ place_id: string; name: string } | null>(null);

  // Modal de Edição de Apelido / Nome
  const [itemToRename, setItemToRename] = useState<{
    place_id: string;
    originalName: string;
    currentNickname?: string;
  } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState<string>("");

  // Filtro do Catálogo & Cópia
  const [catalogFilter, setCatalogFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Carregar Catálogo
  const loadCatalog = useCallback(async (customToken?: string) => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const headers: Record<string, string> = {};
      const tokenToUse = customToken !== undefined ? customToken : githubToken;
      if (tokenToUse) headers["x-github-token"] = tokenToUse;

      const res = await fetch("/api/catalog", { headers, cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar catálogo.");

      setCatalog(data.items || []);
      setExistingIds(new Set(data.existingIds || []));
      if (data.path) setCatalogPath(data.path);
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setLoadingCatalog(false);
    }
  }, [githubToken]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Executar Busca
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelectedPlaceId(null);
    setSelectedPlaceDetails(null);
    setNewPlaceNickname("");
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: getCustomHeaders(),
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao buscar lugares.");
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchError("Nenhum resultado encontrado.");
      }
    } catch (err) {
      const msg = (err as Error).message;
      setSearchError(msg);
      if (msg.includes("Chave do Google Places")) setShowSettingsModal(true);
    } finally {
      setSearching(false);
    }
  };

  // Selecionar Local
  const handleSelectPlace = async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setLoadingDetails(true);
    setDetailsError(null);
    setSelectedPlaceDetails(null);
    setNewPlaceNickname("");
    setActionSuccess(null);
    setActionError(null);

    try {
      const headers: Record<string, string> = {};
      if (googleApiKey) headers["x-google-api-key"] = googleApiKey;

      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao obter detalhes.");

      setSelectedPlaceDetails(data.place);

      // Se já estiver no catálogo, preencher nickname existente
      const existingInCatalog = catalog.find((c) => c.place_id === placeId);
      if (existingInCatalog?.nickname) {
        setNewPlaceNickname(existingInCatalog.nickname);
      }
    } catch (err) {
      setDetailsError((err as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Salvar no GitHub
  const handleSaveToGitHub = async () => {
    if (!selectedPlaceDetails) return;

    setSavingToGitHub(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: getCustomHeaders(),
        body: JSON.stringify({
          place_id: selectedPlaceDetails.place_id,
          place: selectedPlaceDetails,
          nickname: newPlaceNickname.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setActionError("Esse lugar já está salvo no catálogo!");
        return;
      }

      if (!res.ok) throw new Error(data.error || "Erro ao salvar no GitHub.");

      setActionSuccess({
        message: data.message || "Lugar salvo com sucesso!",
        fileUrl: data.fileUrl,
      });

      if (selectedPlaceDetails.place_id) {
        setExistingIds((prev) => new Set([...prev, selectedPlaceDetails.place_id]));
      }

      loadCatalog();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setSavingToGitHub(false);
    }
  };

  // Salvar Atualização de Apelido / Nome
  const handleSaveNickname = async () => {
    if (!itemToRename) return;

    setUpdatingPlaceId(itemToRename.place_id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/catalog", {
        method: "PATCH",
        headers: getCustomHeaders(),
        body: JSON.stringify({
          place_id: itemToRename.place_id,
          nickname: renameInputValue.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao atualizar apelido.");

      setActionSuccess({
        message: data.message || "Apelido atualizado com sucesso!",
        fileUrl: data.fileUrl,
      });

      setItemToRename(null);
      loadCatalog();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setUpdatingPlaceId(null);
    }
  };

  // Excluir do GitHub
  const handleDeletePlace = async (placeId: string) => {
    setDeletingPlaceId(placeId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/catalog?place_id=${encodeURIComponent(placeId)}`, {
        method: "DELETE",
        headers: getCustomHeaders(),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover lugar do GitHub.");

      setActionSuccess({
        message: data.message || "Lugar removido com sucesso!",
        fileUrl: data.fileUrl,
      });

      setExistingIds((prev) => {
        const updated = new Set(prev);
        updated.delete(placeId);
        return updated;
      });

      setItemToDelete(null);
      loadCatalog();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDeletingPlaceId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(catalog, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lugares-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const q = catalogFilter.toLowerCase();
      return (
        item.name?.toLowerCase().includes(q) ||
        item.nickname?.toLowerCase().includes(q) ||
        item.formatted_address?.toLowerCase().includes(q) ||
        item.types?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [catalog, catalogFilter]);

  const isSelectedPlaceAlreadyInCatalog = selectedPlaceId ? existingIds.has(selectedPlaceId) : false;
  const existingCatalogItemForSelected = selectedPlaceId ? catalog.find((c) => c.place_id === selectedPlaceId) : null;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 leading-none">PlaceCache</h1>
              <span className="text-[11px] text-zinc-500 font-medium">Catálogo Google Places &bull; GitHub</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200/60">
              <button
                onClick={() => setActiveTab("search")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeTab === "search"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Buscar Lugares
              </button>
              <button
                onClick={() => setActiveTab("catalog")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeTab === "catalog"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <span>Catálogo Salvo</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-200 text-zinc-700">
                  {catalog.length}
                </span>
              </button>
            </div>

            {/* Configurações */}
            <button
              onClick={() => {
                setTempApiKey(googleApiKey);
                setTempGithubToken(githubToken);
                setShowSettingsModal(true);
              }}
              className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition"
              title="Configurações"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Banner de Erro/Aviso se houver problema no GitHub */}
        {catalogError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{catalogError}</span>
            </div>
            <button
              onClick={() => {
                setTempApiKey(googleApiKey);
                setTempGithubToken(githubToken);
                setShowSettingsModal(true);
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shrink-0 transition"
            >
              Configurar Token
            </button>
          </div>
        )}

        {/* Notificação de Sucesso Global */}
        {actionSuccess && (
          <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{actionSuccess.message}</span>
            </div>
            {actionSuccess.fileUrl && (
              <a
                href={actionSuccess.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-mono text-[11px] text-emerald-800"
              >
                Ver no GitHub
              </a>
            )}
          </div>
        )}

        {/* TAB 1: BUSCA E LISTAGEM */}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Search Input Box */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 shadow-sm">
              <form onSubmit={handleSearch} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Digite o nome de um lugar ou endereço (ex: Museu Oscar Niemeyer Curitiba)..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 rounded-xl border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <span>Buscar</span>
                  )}
                </button>
              </form>

              {searchError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs flex items-center justify-between">
                  <span>{searchError}</span>
                  {searchError.includes("Chave do Google Places") && (
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="text-xs font-bold underline"
                    >
                      Inserir Chave
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Main Split View: Resultados & Detalhes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Lista de Resultados */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Resultados {searchResults.length > 0 && `(${searchResults.length})`}
                  </h2>
                </div>

                {searching && (
                  <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-800 mb-2" />
                    <p className="text-xs font-medium">Buscando na Google Places API...</p>
                  </div>
                )}

                {!searching && searchResults.length === 0 && (
                  <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center text-zinc-400">
                    <Compass className="w-8 h-8 mx-auto stroke-1 mb-2 text-zinc-300" />
                    <p className="text-xs">Digite uma busca para ver os locais disponíveis.</p>
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {searchResults.map((place) => {
                      const isSelected = selectedPlaceId === place.place_id;
                      const catalogItem = catalog.find((c) => c.place_id === place.place_id);
                      const isAlreadyInCatalog = Boolean(catalogItem);

                      return (
                        <div
                          key={place.place_id}
                          onClick={() => handleSelectPlace(place.place_id)}
                          className={`p-4 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                              : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className={`text-sm font-semibold leading-snug ${isSelected ? "text-white" : "text-zinc-900"}`}>
                                {catalogItem?.nickname || place.name}
                              </h3>
                              {catalogItem?.nickname && (
                                <p className={`text-[11px] mt-0.5 ${isSelected ? "text-zinc-400" : "text-zinc-500"}`}>
                                  Oficial: {place.name}
                                </p>
                              )}
                            </div>

                            {isAlreadyInCatalog ? (
                              <span
                                className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  isSelected
                                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}
                              >
                                No Catálogo
                              </span>
                            ) : (
                              <span
                                className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? "bg-zinc-800 text-zinc-300"
                                    : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                Disponível
                              </span>
                            )}
                          </div>

                          {place.formatted_address && (
                            <p className={`text-xs mt-1.5 flex items-start gap-1 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
                              <span className="line-clamp-2">{place.formatted_address}</span>
                            </p>
                          )}

                          {place.rating !== undefined && (
                            <div className="flex items-center gap-1 mt-2.5 text-xs">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span className={`font-semibold ${isSelected ? "text-white" : "text-zinc-800"}`}>
                                {place.rating.toFixed(1)}
                              </span>
                              {place.user_ratings_total !== undefined && (
                                <span className={`text-[11px] ${isSelected ? "text-zinc-400" : "text-zinc-400"}`}>
                                  ({place.user_ratings_total})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Detalhes do Local Selecionado */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm sticky top-20">
                  {!selectedPlaceId && (
                    <div className="py-20 text-center text-zinc-400">
                      <Compass className="w-10 h-10 mx-auto stroke-1 mb-2 text-zinc-300" />
                      <h3 className="text-sm font-semibold text-zinc-700">Selecione um lugar</h3>
                      <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                        Clique em um item da lista para visualizar as informações completas e salvar no GitHub.
                      </p>
                    </div>
                  )}

                  {loadingDetails && (
                    <div className="py-20 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-800 mb-2" />
                      <p className="text-xs font-medium">Carregando detalhes do local...</p>
                    </div>
                  )}

                  {detailsError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs">
                      <p className="font-semibold">Erro ao carregar detalhes:</p>
                      <p className="mt-0.5">{detailsError}</p>
                    </div>
                  )}

                  {!loadingDetails && selectedPlaceDetails && (
                    <div className="space-y-5">
                      {/* Top Header */}
                      <div className="border-b border-zinc-100 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-bold text-zinc-900">
                              {existingCatalogItemForSelected?.nickname || selectedPlaceDetails.name}
                            </h2>
                            {existingCatalogItemForSelected?.nickname && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Nome Oficial: {selectedPlaceDetails.name}
                              </p>
                            )}
                            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                              ID: {selectedPlaceDetails.place_id}
                            </p>
                          </div>

                          {isSelectedPlaceAlreadyInCatalog ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Check className="w-3.5 h-3.5 text-amber-600" />
                              Já Cadastrado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Plus className="w-3.5 h-3.5 text-emerald-600" />
                              Novo Lugar
                            </span>
                          )}
                        </div>

                        {/* Rating & Preço */}
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                          {selectedPlaceDetails.rating !== undefined && (
                            <div className="flex items-center gap-1 text-zinc-800 font-semibold bg-zinc-100 px-2 py-0.5 rounded-md">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>{selectedPlaceDetails.rating.toFixed(1)}</span>
                              {selectedPlaceDetails.user_ratings_total !== undefined && (
                                <span className="text-zinc-400 font-normal">
                                  ({selectedPlaceDetails.user_ratings_total} avaliações)
                                </span>
                              )}
                            </div>
                          )}

                          {selectedPlaceDetails.price_level !== undefined && (
                            <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md font-medium">
                              Preço: {"$".repeat(selectedPlaceDetails.price_level + 1)}
                            </span>
                          )}

                          {selectedPlaceDetails.business_status && (
                            <span className="text-zinc-500 text-[11px]">
                              Status: {selectedPlaceDetails.business_status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Campo opcional de Nickname ao adicionar novo */}
                      {!isSelectedPlaceAlreadyInCatalog && (
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Apelido ou Nome Personalizado (opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={newPlaceNickname}
                            onChange={(e) => setNewPlaceNickname(e.target.value)}
                            placeholder="Ex: MON, Café do Zé..."
                            className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-400"
                          />
                        </div>
                      )}

                      {/* Detailed Grid Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Endereço */}
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 sm:col-span-2">
                          <span className="text-zinc-400 text-[11px] font-medium block mb-0.5">Endereço Completo</span>
                          <p className="text-zinc-800 font-medium leading-relaxed">
                            {selectedPlaceDetails.formatted_address || "Não informado"}
                          </p>
                        </div>

                        {/* Coordenadas */}
                        {selectedPlaceDetails.geometry?.location && (
                          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                            <div>
                              <span className="text-zinc-400 text-[11px] font-medium block mb-0.5">Coordenadas</span>
                              <span className="font-mono text-zinc-800 text-[11px]">
                                {selectedPlaceDetails.geometry.location.lat.toFixed(5)}, {selectedPlaceDetails.geometry.location.lng.toFixed(5)}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  `${selectedPlaceDetails.geometry?.location.lat}, ${selectedPlaceDetails.geometry?.location.lng}`,
                                  "coord"
                                )
                              }
                              className="p-1.5 hover:bg-zinc-200 rounded-md text-zinc-500 transition"
                              title="Copiar coordenadas"
                            >
                              {copiedId === "coord" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Telefone */}
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                          <span className="text-zinc-400 text-[11px] font-medium block mb-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-400" />
                            Telefone
                          </span>
                          <span className="text-zinc-800 font-medium">
                            {selectedPlaceDetails.formatted_phone_number ||
                              selectedPlaceDetails.international_phone_number ||
                              "Não informado"}
                          </span>
                        </div>

                        {/* Site Oficial */}
                        {selectedPlaceDetails.website && (
                          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <span className="text-zinc-400 text-[11px] font-medium block mb-0.5 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-zinc-400" />
                                Site Oficial
                              </span>
                              <a
                                href={selectedPlaceDetails.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline truncate block"
                              >
                                {selectedPlaceDetails.website}
                              </a>
                            </div>
                            <a
                              href={selectedPlaceDetails.website}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-zinc-200 rounded-md text-zinc-500"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}

                        {/* Link Google Maps */}
                        {selectedPlaceDetails.url && (
                          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <span className="text-zinc-400 text-[11px] font-medium block mb-0.5">Google Maps</span>
                              <span className="text-zinc-700 truncate block">Abrir rota e local</span>
                            </div>
                            <a
                              href={selectedPlaceDetails.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-zinc-200 rounded-md text-blue-600"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Horário de Funcionamento */}
                      {selectedPlaceDetails.opening_hours?.weekday_text &&
                        selectedPlaceDetails.opening_hours.weekday_text.length > 0 && (
                          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-xs">
                            <span className="text-zinc-700 font-semibold block mb-2 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-zinc-500" />
                              Horários de Funcionamento
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-zinc-600 text-[11px]">
                              {selectedPlaceDetails.opening_hours.weekday_text.map((dia, idx) => (
                                <div key={idx}>{dia}</div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Categorias */}
                      {selectedPlaceDetails.types && selectedPlaceDetails.types.length > 0 && (
                        <div>
                          <span className="text-xs text-zinc-400 font-medium block mb-1.5">Categorias</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedPlaceDetails.types.map((type, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-md text-[11px] font-mono"
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fotos */}
                      {selectedPlaceDetails.photos && selectedPlaceDetails.photos.length > 0 && (
                        <div>
                          <span className="text-xs text-zinc-400 font-medium block mb-1.5">Fotos</span>
                          <div className="grid grid-cols-3 gap-2">
                            {selectedPlaceDetails.photos.slice(0, 3).map((photo, idx) => (
                              <div key={idx} className="rounded-lg overflow-hidden bg-zinc-100 aspect-video">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/places/photo?ref=${encodeURIComponent(photo.photo_reference)}&maxwidth=400${
                                    googleApiKey ? `&key=${encodeURIComponent(googleApiKey)}` : ""
                                  }`}
                                  alt={`${selectedPlaceDetails.name} foto`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {actionError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                          {actionError}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2">
                        {isSelectedPlaceAlreadyInCatalog ? (
                          <div className="p-3 bg-zinc-100 rounded-xl text-xs text-zinc-600 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                            <span>Lugar já salvo no catálogo.</span>
                            <div className="flex items-center gap-2">
                              {/* Botão de Editar Apelido */}
                              <button
                                onClick={() => {
                                  const catItem = catalog.find((c) => c.place_id === selectedPlaceDetails.place_id);
                                  setItemToRename({
                                    place_id: selectedPlaceDetails.place_id,
                                    originalName: selectedPlaceDetails.name,
                                    currentNickname: catItem?.nickname,
                                  });
                                  setRenameInputValue(catItem?.nickname || "");
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-300 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                                <span>{existingCatalogItemForSelected?.nickname ? "Editar Apelido" : "Adicionar Apelido"}</span>
                              </button>

                              {/* Botão de Remover */}
                              <button
                                onClick={() =>
                                  setItemToDelete({
                                    place_id: selectedPlaceDetails.place_id,
                                    name: existingCatalogItemForSelected?.nickname || selectedPlaceDetails.name,
                                  })
                                }
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                <span>Remover</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleSaveToGitHub}
                            disabled={savingToGitHub}
                            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            {savingToGitHub ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Gravando no GitHub...</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                <span>Adicionar ao Catálogo ({catalogPath})</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CATÁLOGO SALVO NO GITHUB */}
        {activeTab === "catalog" && (
          <div className="space-y-5">
            {/* Header com busca e ações */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Catálogo Salvo no GitHub</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Arquivo: <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700">{catalogPath}</code> &bull; Total: {catalog.length} lugares
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={catalogFilter}
                    onChange={(e) => setCatalogFilter(e.target.value)}
                    placeholder="Filtrar por nome ou apelido..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 rounded-lg border border-zinc-200 focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleDownloadJSON}
                  disabled={catalog.length === 0}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-700 text-xs font-semibold rounded-lg transition flex items-center gap-1"
                  title="Baixar arquivo JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>

                <button
                  onClick={() => loadCatalog()}
                  disabled={loadingCatalog}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition"
                >
                  {loadingCatalog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Atualizar"}
                </button>
              </div>
            </div>

            {/* Listagem do Catálogo */}
            {loadingCatalog ? (
              <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-800 mb-2" />
                <p className="text-xs">Buscando dados do repositório...</p>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center text-zinc-400">
                <Compass className="w-8 h-8 mx-auto stroke-1 mb-2 text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-700">Nenhum lugar no catálogo</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {catalog.length === 0
                    ? "O arquivo ainda não possui itens. Use a aba de busca para cadastrar!"
                    : "Nenhum lugar encontrado para o filtro."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((item, idx) => (
                  <div
                    key={item.place_id || idx}
                    className="bg-white p-4 rounded-xl border border-zinc-200 flex flex-col justify-between hover:border-zinc-300 transition shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-zinc-900 text-sm leading-snug">
                              {item.nickname || item.name}
                            </h3>
                            {item.nickname && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                Apelido
                              </span>
                            )}
                          </div>
                          {item.nickname && (
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Oficial: {item.name}
                            </p>
                          )}
                        </div>

                        {item.rating !== undefined && (
                          <div className="flex items-center text-amber-500 font-semibold text-xs shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                            {item.rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      {item.formatted_address && (
                        <p className="text-xs text-zinc-500 mt-2 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                          <span className="line-clamp-2">{item.formatted_address}</span>
                        </p>
                      )}

                      {item.types && item.types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.types.slice(0, 3).map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-mono"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                      <span className="text-[10px]">
                        {item.added_at ? new Date(item.added_at).toLocaleDateString("pt-BR") : ""}
                      </span>

                      <div className="flex items-center gap-2">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium text-xs mr-1"
                          >
                            Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {/* Botão de Editar Apelido */}
                        <button
                          onClick={() => {
                            setItemToRename({
                              place_id: item.place_id,
                              originalName: item.name,
                              currentNickname: item.nickname,
                            });
                            setRenameInputValue(item.nickname || "");
                          }}
                          className="p-1 hover:bg-zinc-100 hover:text-zinc-700 rounded text-zinc-400 transition"
                          title="Editar apelido / renomear"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Botão de Excluir */}
                        <button
                          onClick={() => setItemToDelete({ place_id: item.place_id, name: item.nickname || item.name })}
                          disabled={deletingPlaceId === item.place_id}
                          className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-zinc-400 transition"
                          title="Remover do catálogo"
                        >
                          {deletingPlaceId === item.place_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Edição de Apelido / Renomear */}
      {itemToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-zinc-600" />
                <span>Apelido / Nome do Lugar</span>
              </h3>
              <button
                onClick={() => setItemToRename(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-[11px] text-zinc-400 block mb-0.5">Nome Oficial do Google:</span>
                <p className="text-xs font-semibold text-zinc-700">{itemToRename.originalName}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Apelido Personalizado:
                </label>
                <input
                  type="text"
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  placeholder="Ex: MON, Café do Mercado..."
                  className="w-full px-3 py-2 text-xs bg-zinc-50 rounded-lg border border-zinc-300 focus:bg-white focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Deixe vazio para utilizar o nome oficial original.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setItemToRename(null)}
                disabled={Boolean(updatingPlaceId)}
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNickname}
                disabled={Boolean(updatingPlaceId)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition flex items-center gap-1.5"
              >
                {updatingPlaceId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-zinc-200">
            <h3 className="font-bold text-zinc-900 text-sm">Remover do Catálogo?</h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Tem certeza que deseja remover <strong>&quot;{itemToDelete.name}&quot;</strong>? Um novo commit será gerado no repositório do GitHub.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={Boolean(deletingPlaceId)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePlace(itemToDelete.place_id)}
                disabled={Boolean(deletingPlaceId)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition flex items-center gap-1.5"
              >
                {deletingPlaceId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <span>Confirmar Remoção</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-sm">Configurações & Chaves</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={tempGithubToken}
                  onChange={(e) => setTempGithubToken(e.target.value)}
                  placeholder="github_pat_..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Google Places API Key
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-4 mt-auto bg-white text-center text-xs text-zinc-400">
        PlaceCache &bull; Google Places API &bull; GitHub REST API
      </footer>
    </div>
  );
}
