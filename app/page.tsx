"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MapPin,
  Star,
  Globe,
  Phone,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FolderGit2,
  PlusCircle,
  Copy,
  Check,
  Building2,
  Compass,
  DollarSign,
  Image as ImageIcon,
  Key,
  Settings,
  X,
  ShieldCheck,
} from "lucide-react";
import { CatalogItem, PlaceDetails, PlaceSearchResult } from "@/lib/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"search" | "catalog">("search");

  // Credenciais (Google Places API Key & GitHub Token)
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
    // Recarregar catálogo com as novas credenciais
    setTimeout(() => {
      loadCatalog(trimmedToken);
    }, 100);
  };

  // Helper para headers comuns
  const getCustomHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (googleApiKey) {
      headers["x-google-api-key"] = googleApiKey;
    }
    if (githubToken) {
      headers["x-github-token"] = githubToken;
    }
    return headers;
  }, [googleApiKey, githubToken]);

  // Catálogo salvo no GitHub
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [catalogPath, setCatalogPath] = useState<string>("data/lugares.json");
  const [catalogBranch, setCatalogBranch] = useState<string>("main");
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Busca no Google Places
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Seleção e Detalhes
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Ação de Salvar no GitHub
  const [savingToGitHub, setSavingToGitHub] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ message: string; fileUrl?: string; commitSha?: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filtro do catálogo
  const [catalogFilter, setCatalogFilter] = useState("");
  const [copiedCoord, setCopiedCoord] = useState<string | null>(null);

  // Carregar catálogo do GitHub ao inicializar
  const loadCatalog = useCallback(async (customToken?: string) => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const headers: Record<string, string> = {};
      const tokenToUse = customToken !== undefined ? customToken : githubToken;
      if (tokenToUse) {
        headers["x-github-token"] = tokenToUse;
      }

      const res = await fetch("/api/catalog", { headers, cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao carregar catálogo.");
      }
      setCatalog(data.items || []);
      setExistingIds(new Set(data.existingIds || []));
      if (data.path) setCatalogPath(data.path);
      if (data.branch) setCatalogBranch(data.branch);
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setLoadingCatalog(false);
    }
  }, [githubToken]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Executar busca no Google Places
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelectedPlaceId(null);
    setSelectedPlaceDetails(null);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: getCustomHeaders(),
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar o Google Places.");
      }

      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchError("Nenhum resultado encontrado para o termo pesquisado.");
      }
    } catch (err) {
      const msg = (err as Error).message;
      setSearchError(msg);
      if (msg.includes("Chave do Google Places")) {
        setShowSettingsModal(true);
      }
    } finally {
      setSearching(false);
    }
  };

  // Selecionar um lugar da lista e buscar detalhes completos
  const handleSelectPlace = async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setLoadingDetails(true);
    setDetailsError(null);
    setSelectedPlaceDetails(null);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const headers: Record<string, string> = {};
      if (googleApiKey) {
        headers["x-google-api-key"] = googleApiKey;
      }

      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`, {
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao obter detalhes do lugar.");
      }

      setSelectedPlaceDetails(data.place);
    } catch (err) {
      setDetailsError((err as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Salvar o lugar selecionado no GitHub
  const handleSaveToGitHub = async () => {
    if (!selectedPlaceDetails) return;

    setSavingToGitHub(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: getCustomHeaders(),
        body: JSON.stringify({
          place_id: selectedPlaceDetails.place_id,
          place: selectedPlaceDetails,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setSaveError("Esse lugar já está na lista salva no GitHub!");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar no GitHub.");
      }

      setSaveSuccess({
        message: data.message || "Lugar adicionado com sucesso!",
        fileUrl: data.fileUrl,
        commitSha: data.commitSha,
      });

      // Atualizar lista local de existentes
      if (selectedPlaceDetails.place_id) {
        setExistingIds((prev) => new Set([...prev, selectedPlaceDetails.place_id]));
      }

      // Recarregar catálogo
      loadCatalog();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSavingToGitHub(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCoord(id);
    setTimeout(() => setCopiedCoord(null), 2000);
  };

  const filteredCatalog = catalog.filter((item) => {
    const q = catalogFilter.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.formatted_address?.toLowerCase().includes(q) ||
      item.types?.some((t) => t.toLowerCase().includes(q))
    );
  });

  const isSelectedPlaceAlreadyInCatalog = selectedPlaceId ? existingIds.has(selectedPlaceId) : false;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Catálogo Google Places
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono">
                  GitHub JSON Sync
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Busca de estabelecimentos e persistência versionada no repositório
              </p>
            </div>
          </div>

          {/* Abas e Contadores */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "search"
                  ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Buscar & Adicionar</span>
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "catalog"
                  ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span>Catálogo no GitHub</span>
              <span className="ml-1 text-xs px-2 py-0.5 bg-slate-200 text-slate-800 rounded-full font-bold">
                {catalog.length}
              </span>
            </button>

            {/* Botão Configurações API Key & Token */}
            <button
              onClick={() => {
                setTempApiKey(googleApiKey);
                setTempGithubToken(githubToken);
                setShowSettingsModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition"
              title="Configurar Chaves e Tokens"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Configurações</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Banner de Aviso se houver erro ao carregar catálogo inicial */}
        {catalogError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Aviso de sincronização com o GitHub</p>
                <p className="text-amber-800 text-xs mt-0.5">{catalogError}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setTempApiKey(googleApiKey);
                setTempGithubToken(githubToken);
                setShowSettingsModal(true);
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0 transition shadow-sm"
            >
              Inserir Token do GitHub
            </button>
          </div>
        )}

        {/* ABA 1: BUSCA E DETALHES */}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Campo de Busca */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Digite o nome ou endereço (ex: Museu Oscar Niemeyer Curitiba, Parque Barigui...)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm text-slate-800 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition shadow-sm"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Buscar Lugares</span>
                    </>
                  )}
                </button>
              </form>

              {searchError && (
                <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{searchError}</span>
                  </div>
                  <button
                    onClick={() => {
                      setTempApiKey(googleApiKey);
                      setTempGithubToken(githubToken);
                      setShowSettingsModal(true);
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shrink-0 transition"
                  >
                    Ver Configurações
                  </button>
                </div>
              )}
            </div>

            {/* Painel Principal: Resultados da Busca + Detalhes do Local Selecionado */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda: Lista de Resultados */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Resultados da Busca {searchResults.length > 0 && `(${searchResults.length})`}
                  </h2>
                </div>

                {searching && (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="text-sm">Consultando Google Places API...</p>
                  </div>
                )}

                {!searching && searchResults.length === 0 && (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                    <Building2 className="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300" />
                    <p className="text-sm">Faça uma busca para visualizar os locais correspondentes.</p>
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                    {searchResults.map((place) => {
                      const isSelected = selectedPlaceId === place.place_id;
                      const isAlreadyInCatalog = existingIds.has(place.place_id);

                      return (
                        <div
                          key={place.place_id}
                          onClick={() => handleSelectPlace(place.place_id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-200 shadow-sm"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                              {place.name}
                            </h3>
                            {isAlreadyInCatalog ? (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                                No Catálogo
                              </span>
                            ) : (
                              <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                                Disponível
                              </span>
                            )}
                          </div>

                          {place.formatted_address && (
                            <div className="flex items-start gap-1.5 mt-1.5 text-xs text-slate-500">
                              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                              <span className="line-clamp-2">{place.formatted_address}</span>
                            </div>
                          )}

                          {place.rating !== undefined && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs">
                              <div className="flex items-center text-amber-500 font-semibold">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                                {place.rating.toFixed(1)}
                              </div>
                              {place.user_ratings_total !== undefined && (
                                <span className="text-slate-400 text-[11px]">
                                  ({place.user_ratings_total} avaliações)
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

              {/* Coluna Direita: Detalhes Completos do Local Selecionado */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-20">
                  {!selectedPlaceId && (
                    <div className="py-16 text-center text-slate-400">
                      <Compass className="w-12 h-12 mx-auto stroke-1 mb-3 text-slate-300" />
                      <h3 className="text-base font-semibold text-slate-600">Nenhum local selecionado</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Clique em um dos itens da lista de busca para carregar as informações completas via Place Details API.
                      </p>
                    </div>
                  )}

                  {loadingDetails && (
                    <div className="py-16 text-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                      <p className="text-sm font-medium">Buscando detalhes completos na Google Places API...</p>
                    </div>
                  )}

                  {detailsError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                      <p className="font-semibold">Erro ao carregar detalhes:</p>
                      <p className="mt-1">{detailsError}</p>
                    </div>
                  )}

                  {!loadingDetails && selectedPlaceDetails && (
                    <div className="space-y-5">
                      {/* Header do Detalhe */}
                      <div className="border-b border-slate-100 pb-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h2 className="text-xl font-bold text-slate-900">
                              {selectedPlaceDetails.name}
                            </h2>
                            <p className="text-xs font-mono text-slate-400 mt-0.5">
                              ID: {selectedPlaceDetails.place_id}
                            </p>
                          </div>

                          {/* Status de Duplicidade */}
                          {isSelectedPlaceAlreadyInCatalog ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg">
                              <CheckCircle2 className="w-4 h-4 text-amber-600" />
                              Já cadastrado no JSON
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg">
                              <PlusCircle className="w-4 h-4 text-emerald-600" />
                              Novo Local
                            </span>
                          )}
                        </div>

                        {/* Avaliação e Preço */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                          {selectedPlaceDetails.rating !== undefined && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-900 px-2 py-1 rounded-md border border-amber-100 font-medium">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span className="font-bold">{selectedPlaceDetails.rating.toFixed(1)}</span>
                              {selectedPlaceDetails.user_ratings_total !== undefined && (
                                <span className="text-amber-700">({selectedPlaceDetails.user_ratings_total})</span>
                              )}
                            </div>
                          )}

                          {selectedPlaceDetails.price_level !== undefined && (
                            <div className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Nível de Preço: {"$".repeat(selectedPlaceDetails.price_level + 1)}</span>
                            </div>
                          )}

                          {selectedPlaceDetails.business_status && (
                            <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded-md font-mono text-[11px]">
                              Status: {selectedPlaceDetails.business_status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Informações detalhadas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Endereço */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 sm:col-span-2">
                          <span className="text-slate-400 font-medium block mb-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            Endereço Completo
                          </span>
                          <p className="text-slate-800 font-medium">{selectedPlaceDetails.formatted_address || "Não informado"}</p>
                        </div>

                        {/* Coordenadas */}
                        {selectedPlaceDetails.geometry?.location && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-slate-400 font-medium block mb-0.5">Coordenadas</span>
                              <span className="font-mono text-slate-800">
                                {selectedPlaceDetails.geometry.location.lat.toFixed(6)}, {selectedPlaceDetails.geometry.location.lng.toFixed(6)}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  `${selectedPlaceDetails.geometry?.location.lat}, ${selectedPlaceDetails.geometry?.location.lng}`,
                                  "coord"
                                )
                              }
                              className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 transition"
                              title="Copiar coordenadas"
                            >
                              {copiedCoord === "coord" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        )}

                        {/* Telefone */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-slate-400 font-medium block mb-0.5 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            Telefone
                          </span>
                          <span className="text-slate-800">
                            {selectedPlaceDetails.formatted_phone_number || selectedPlaceDetails.international_phone_number || "Não disponível"}
                          </span>
                        </div>

                        {/* Website Oficial */}
                        {selectedPlaceDetails.website && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <span className="text-slate-400 font-medium block mb-0.5 flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 text-slate-500" />
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
                              className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}

                        {/* Link Google Maps */}
                        {selectedPlaceDetails.url && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <span className="text-slate-400 font-medium block mb-0.5">Google Maps</span>
                              <span className="text-slate-600 truncate block">Abrir localização no Maps</span>
                            </div>
                            <a
                              href={selectedPlaceDetails.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-slate-200 rounded-md text-blue-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Horário de Funcionamento */}
                      {selectedPlaceDetails.opening_hours?.weekday_text && selectedPlaceDetails.opening_hours.weekday_text.length > 0 && (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <span className="text-slate-600 font-semibold block mb-2 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            Horário de Funcionamento
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-600">
                            {selectedPlaceDetails.opening_hours.weekday_text.map((dia, idx) => (
                              <div key={idx} className="text-[11px]">{dia}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Categorias / Tipos */}
                      {selectedPlaceDetails.types && selectedPlaceDetails.types.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-400 font-medium block mb-1.5">Categorias / Tipos</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPlaceDetails.types.map((type, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded-md font-mono"
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fotos de Amostra */}
                      {selectedPlaceDetails.photos && selectedPlaceDetails.photos.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-400 font-medium block mb-2 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                            Fotos do Local ({selectedPlaceDetails.photos.length})
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {selectedPlaceDetails.photos.slice(0, 3).map((photo, idx) => (
                              <div key={idx} className="relative rounded-lg overflow-hidden bg-slate-100 aspect-video">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/places/photo?ref=${encodeURIComponent(photo.photo_reference)}&maxwidth=400${
                                    googleApiKey ? `&key=${encodeURIComponent(googleApiKey)}` : ""
                                  }`}
                                  alt={`${selectedPlaceDetails.name} foto ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alertas de Ação (Sucesso / Erro / Duplicado) */}
                      {saveSuccess && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5">
                          <div className="flex items-center gap-2 font-bold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {saveSuccess.message}
                          </div>
                          {saveSuccess.fileUrl && (
                            <p className="text-emerald-700">
                              Visualizar no repositório:{" "}
                              <a
                                href={saveSuccess.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-mono inline-flex items-center gap-1 hover:text-emerald-950"
                              >
                                {catalogPath} <ExternalLink className="w-3 h-3" />
                              </a>
                            </p>
                          )}
                        </div>
                      )}

                      {saveError && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">{saveError}</p>
                          </div>
                        </div>
                      )}

                      {/* Botão de Confirmação e Commit no GitHub */}
                      <div className="pt-2">
                        {isSelectedPlaceAlreadyInCatalog ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                            <span className="flex items-center gap-2 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-amber-600" />
                              Esse lugar já está na lista salva no GitHub.
                            </span>
                            <button
                              disabled
                              className="px-4 py-2 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed"
                            >
                              Já Adicionado
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleSaveToGitHub}
                            disabled={savingToGitHub}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                          >
                            {savingToGitHub ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Gravando commit no GitHub...</span>
                              </>
                            ) : (
                              <>
                                <FolderGit2 className="w-4 h-4" />
                                <span>Adicionar ao Catálogo no GitHub ({catalogPath})</span>
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

        {/* ABA 2: CATÁLOGO SALVO NO GITHUB */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderGit2 className="w-5 h-5 text-blue-600" />
                  Catálogo Salvo no GitHub
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Arquivo: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">{catalogPath}</code> (branch: <span className="font-mono">{catalogBranch}</span>)
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={catalogFilter}
                    onChange={(e) => setCatalogFilter(e.target.value)}
                    placeholder="Filtrar catálogo..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                  />
                </div>
                <button
                  onClick={() => loadCatalog()}
                  disabled={loadingCatalog}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  {loadingCatalog ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
                </button>
              </div>
            </div>

            {loadingCatalog ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                <p className="text-sm">Buscando arquivo JSON do repositório no GitHub...</p>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
                <FolderGit2 className="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-300" />
                <h3 className="text-base font-semibold text-slate-700">Nenhum lugar no catálogo</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {catalog.length === 0
                    ? "O arquivo ainda não possui itens cadastrados ou ainda não foi criado. Use a busca para adicionar novos lugares!"
                    : "Nenhum resultado corresponde ao filtro pesquisado."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((item, idx) => (
                  <div
                    key={item.place_id || idx}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
                        {item.rating !== undefined && (
                          <div className="flex items-center text-amber-500 font-semibold text-xs shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                            {item.rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      {item.formatted_address && (
                        <p className="text-xs text-slate-500 mt-2 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                          <span className="line-clamp-2">{item.formatted_address}</span>
                        </p>
                      )}

                      {item.geometry?.location && (
                        <div className="mt-2 text-[11px] font-mono text-slate-400">
                          Lat: {item.geometry.location.lat.toFixed(4)}, Lng: {item.geometry.location.lng.toFixed(4)}
                        </div>
                      )}

                      {item.types && item.types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.types.slice(0, 3).map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono"
                            >
                              {t}
                            </span>
                          ))}
                          {item.types.length > 3 && (
                            <span className="text-[10px] text-slate-400 px-1 py-0.5">
                              +{item.types.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[10px]">
                        {item.added_at ? `Adicionado: ${new Date(item.added_at).toLocaleDateString("pt-BR")}` : ""}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Configurações das Chaves / Tokens */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <Settings className="w-5 h-5 text-blue-600" />
                Configurações & Chaves
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* GitHub Token */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={tempGithubToken}
                  onChange={(e) => setTempGithubToken(e.target.value)}
                  placeholder="github_pat_..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Requer permissão <strong>Contents: Read and write</strong> no repositório.
                </p>
              </div>

              {/* Google Places API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  Google Places API Key
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-mono"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-[11px] text-blue-800 space-y-1">
                <p className="font-semibold">💡 Dica:</p>
                <p>Essas chaves são armazenadas localmente no seu navegador e enviadas com segurança apenas para o backend da sua aplicação.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          Catálogo Google Places Sync &bull; GitHub REST API &bull; Google Places API
        </div>
      </footer>
    </div>
  );
}
