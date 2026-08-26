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
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FolderGit2,
  Plus,
  Copy,
  Check,
  Compass,
  DollarSign,
  Settings,
  X,
  ShieldCheck,
  Sparkles,
  Download,
  LayoutGrid,
  List as ListIcon,
  Layers,
  ArrowRight,
} from "lucide-react";
import { CatalogItem, PlaceDetails, PlaceSearchResult } from "@/lib/types";

const QUICK_SEARCH_CHIPS = [
  "🏛️ Museus em Curitiba",
  "☕ Cafés especiais",
  "🌳 Parques e praças",
  "🍕 Restaurantes",
  "🎭 Teatros",
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"search" | "catalog">("search");
  const [catalogViewMode, setCatalogViewMode] = useState<"grid" | "list">("grid");

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
    setTimeout(() => {
      loadCatalog(trimmedToken);
    }, 100);
  };

  // Headers helper
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

  // Filtros & Clipboard
  const [catalogFilter, setCatalogFilter] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Carregar catálogo do GitHub
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

  // Busca no Google Places
  const executeSearch = async (queryText: string) => {
    const text = queryText.trim();
    if (!text) return;

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
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar o Google Places.");
      }

      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchError("Nenhum resultado encontrado para a busca.");
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

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(searchQuery);
  };

  // Selecionar um lugar
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

  // Salvar no GitHub
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

      if (selectedPlaceDetails.place_id) {
        setExistingIds((prev) => new Set([...prev, selectedPlaceDetails.place_id]));
      }

      loadCatalog();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSavingToGitHub(false);
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
    a.download = `lugares-catalogo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Categorias únicas no catálogo
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => {
      (item.types || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const q = catalogFilter.toLowerCase();
      const matchesText =
        item.name?.toLowerCase().includes(q) ||
        item.formatted_address?.toLowerCase().includes(q) ||
        item.types?.some((t) => t.toLowerCase().includes(q));

      const matchesCategory =
        selectedCategoryFilter === "all" ||
        item.types?.includes(selectedCategoryFilter);

      return matchesText && matchesCategory;
    });
  }, [catalog, catalogFilter, selectedCategoryFilter]);

  const isSelectedPlaceAlreadyInCatalog = selectedPlaceId ? existingIds.has(selectedPlaceId) : false;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Subtle Gradient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-indigo-600/15 via-sky-600/15 to-transparent blur-3xl opacity-70" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Compass className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">PlaceCache</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  GitHub Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Catálogo Google Places &bull; {catalogPath}
              </p>
            </div>
          </div>

          {/* Segmented Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "search"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Explorar</span>
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "catalog"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Catálogo</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                {catalog.length}
              </span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTempApiKey(googleApiKey);
                setTempGithubToken(githubToken);
                setShowSettingsModal(true);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
              title="Configurações & Chaves"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Banner de Erro/Aviso caso a conexão com GitHub precise de atenção */}
        {catalogError && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-md animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">Sincronização com o repositório</p>
                <p className="text-xs text-amber-200/80 mt-0.5">{catalogError}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setTempApiKey(googleApiKey);
                setTempGithubToken(githubToken);
                setShowSettingsModal(true);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shrink-0"
            >
              Ajustar Chaves
            </button>
          </div>
        )}

        {/* TAB 1: BUSCA E ADIÇÃO */}
        {activeTab === "search" && (
          <div className="space-y-6 animate-fade-in">
            {/* Search Box Card */}
            <div className="relative rounded-3xl bg-slate-900/90 border border-slate-800/80 p-6 shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-3xl">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Buscar lugares para o catálogo</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Digite o nome do estabelecimento, museu, parque ou endereço para consultar a Google Places API.
                </p>

                <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ex: Museu Oscar Niemeyer Curitiba, Café do Mercado..."
                      className="w-full pl-11 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={searching || !searchQuery.trim()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition shadow-lg shadow-indigo-500/20 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {searching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Pesquisando...</span>
                      </>
                    ) : (
                      <>
                        <span>Buscar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Quick Search Chips */}
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-1">Sugestões:</span>
                  {QUICK_SEARCH_CHIPS.map((chip, idx) => {
                    const queryClean = chip.replace(/^[^\w\s]+/, "").trim();
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(queryClean);
                          executeSearch(queryClean);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80 transition"
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>

                {searchError && (
                  <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{searchError}</span>
                    </div>
                    {searchError.includes("Chave do Google Places") && (
                      <button
                        onClick={() => setShowSettingsModal(true)}
                        className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl shrink-0 transition"
                      >
                        Inserir Chave
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Results Grid / Split Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Results List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Resultados Encontrados {searchResults.length > 0 && `(${searchResults.length})`}
                  </span>
                  {searchResults.length > 0 && (
                    <span className="text-[11px] text-slate-500">Clique para inspecionar</span>
                  )}
                </div>

                {searching && (
                  <div className="bg-slate-900/50 rounded-2xl border border-slate-800/80 p-8 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-400 mb-2" />
                    <p className="text-xs">Consultando Google Places API...</p>
                  </div>
                )}

                {!searching && searchResults.length === 0 && (
                  <div className="bg-slate-900/30 rounded-2xl border border-slate-800/50 p-10 text-center text-slate-500">
                    <Compass className="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-700" />
                    <p className="text-xs">Faça uma busca acima para listar os estabelecimentos.</p>
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
                    {searchResults.map((place) => {
                      const isSelected = selectedPlaceId === place.place_id;
                      const isAlreadyInCatalog = existingIds.has(place.place_id);

                      return (
                        <div
                          key={place.place_id}
                          onClick={() => handleSelectPlace(place.place_id)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/5"
                              : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-slate-100 leading-snug">
                              {place.name}
                            </h3>
                            {isAlreadyInCatalog ? (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
                                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                                No Catálogo
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md">
                                Disponível
                              </span>
                            )}
                          </div>

                          {place.formatted_address && (
                            <p className="text-xs text-slate-400 mt-1.5 flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{place.formatted_address}</span>
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-xs">
                            {place.rating !== undefined ? (
                              <div className="flex items-center gap-1 text-amber-400 font-semibold text-xs">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                <span>{place.rating.toFixed(1)}</span>
                                {place.user_ratings_total !== undefined && (
                                  <span className="text-slate-500 text-[11px] font-normal">
                                    ({place.user_ratings_total})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px]">Sem avaliações</span>
                            )}

                            {place.types && place.types[0] && (
                              <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                {place.types[0].replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Place Full Details */}
              <div className="lg:col-span-7">
                <div className="bg-slate-900/80 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl p-6 sticky top-24">
                  {!selectedPlaceId && (
                    <div className="py-20 text-center text-slate-500">
                      <Compass className="w-12 h-12 mx-auto stroke-1 mb-3 text-slate-700" />
                      <h3 className="text-sm font-semibold text-slate-300">Nenhum lugar selecionado</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Selecione um dos resultados da pesquisa para inspecionar fotos, horários, coordenadas e salvar no repositório.
                      </p>
                    </div>
                  )}

                  {loadingDetails && (
                    <div className="py-20 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
                      <p className="text-xs font-medium">Buscando metadados completos na Place Details API...</p>
                    </div>
                  )}

                  {detailsError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs">
                      <p className="font-semibold">Erro ao carregar detalhes:</p>
                      <p className="mt-1">{detailsError}</p>
                    </div>
                  )}

                  {!loadingDetails && selectedPlaceDetails && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Place Header */}
                      <div className="border-b border-slate-800 pb-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                              {selectedPlaceDetails.name}
                            </h2>
                            <p className="text-xs font-mono text-slate-500 mt-1">
                              place_id: {selectedPlaceDetails.place_id}
                            </p>
                          </div>

                          {/* Status Badge */}
                          {isSelectedPlaceAlreadyInCatalog ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              <CheckCircle2 className="w-4 h-4 text-amber-400" />
                              Já Cadastrado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <Plus className="w-4 h-4 text-emerald-400" />
                              Disponível para Salvar
                            </span>
                          )}
                        </div>

                        {/* Ratings, Price & Status row */}
                        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
                          {selectedPlaceDetails.rating !== undefined && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 font-semibold">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{selectedPlaceDetails.rating.toFixed(1)}</span>
                              {selectedPlaceDetails.user_ratings_total !== undefined && (
                                <span className="text-amber-300/70 font-normal">
                                  ({selectedPlaceDetails.user_ratings_total} reviews)
                                </span>
                              )}
                            </div>
                          )}

                          {selectedPlaceDetails.price_level !== undefined && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-mono">
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Preço: {"$".repeat(selectedPlaceDetails.price_level + 1)}</span>
                            </div>
                          )}

                          {selectedPlaceDetails.business_status && (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono text-[11px]">
                              {selectedPlaceDetails.business_status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Tiles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Address */}
                        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 sm:col-span-2">
                          <span className="text-slate-500 font-medium block mb-1 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            Endereço Completo
                          </span>
                          <p className="text-slate-200 font-medium">
                            {selectedPlaceDetails.formatted_address || "Não informado"}
                          </p>
                        </div>

                        {/* Coordinates */}
                        {selectedPlaceDetails.geometry?.location && (
                          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="text-slate-500 font-medium block mb-0.5">Coordenadas</span>
                              <span className="font-mono text-slate-300">
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
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition"
                              title="Copiar coordenadas"
                            >
                              {copiedId === "coord" ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Phone */}
                        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 font-medium block mb-0.5 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            Telefone
                          </span>
                          <span className="text-slate-300">
                            {selectedPlaceDetails.formatted_phone_number ||
                              selectedPlaceDetails.international_phone_number ||
                              "Não informado"}
                          </span>
                        </div>

                        {/* Website */}
                        {selectedPlaceDetails.website && (
                          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <span className="text-slate-500 font-medium block mb-0.5 flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-slate-400" />
                                Site Oficial
                              </span>
                              <a
                                href={selectedPlaceDetails.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:underline truncate block"
                              >
                                {selectedPlaceDetails.website}
                              </a>
                            </div>
                            <a
                              href={selectedPlaceDetails.website}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}

                        {/* Google Maps Link */}
                        {selectedPlaceDetails.url && (
                          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <span className="text-slate-500 font-medium block mb-0.5">Google Maps</span>
                              <span className="text-slate-300 truncate block">Abrir rota e localização</span>
                            </div>
                            <a
                              href={selectedPlaceDetails.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-sky-400"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Opening Hours */}
                      {selectedPlaceDetails.opening_hours?.weekday_text &&
                        selectedPlaceDetails.opening_hours.weekday_text.length > 0 && (
                          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                            <span className="text-slate-300 font-semibold block mb-2.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              Horário de Funcionamento
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-400">
                              {selectedPlaceDetails.opening_hours.weekday_text.map((dia, idx) => (
                                <div key={idx} className="text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                                  {dia}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Category Tags */}
                      {selectedPlaceDetails.types && selectedPlaceDetails.types.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-500 font-medium block mb-2">Categorias & Tags</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPlaceDetails.types.map((type, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-slate-950 text-slate-400 border border-slate-800 text-[11px] rounded-lg font-mono"
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sample Photos Gallery */}
                      {selectedPlaceDetails.photos && selectedPlaceDetails.photos.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-500 font-medium block mb-2">
                            Fotos do Estabelecimento ({selectedPlaceDetails.photos.length})
                          </span>
                          <div className="grid grid-cols-3 gap-2.5">
                            {selectedPlaceDetails.photos.slice(0, 3).map((photo, idx) => (
                              <div
                                key={idx}
                                className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/places/photo?ref=${encodeURIComponent(photo.photo_reference)}&maxwidth=400${
                                    googleApiKey ? `&key=${encodeURIComponent(googleApiKey)}` : ""
                                  }`}
                                  alt={`${selectedPlaceDetails.name} photo ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alerts (Success / Error / Duplicate) */}
                      {saveSuccess && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 space-y-1.5 animate-fade-in">
                          <div className="flex items-center gap-2 font-bold text-emerald-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            {saveSuccess.message}
                          </div>
                          {saveSuccess.fileUrl && (
                            <p className="text-emerald-400/80">
                              Visualizar no repositório:{" "}
                              <a
                                href={saveSuccess.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-mono inline-flex items-center gap-1 hover:text-emerald-200"
                              >
                                {catalogPath} <ExternalLink className="w-3 h-3" />
                              </a>
                            </p>
                          )}
                        </div>
                      )}

                      {saveError && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300 flex items-start gap-2 animate-fade-in">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">{saveError}</p>
                          </div>
                        </div>
                      )}

                      {/* Commit Action Button */}
                      <div className="pt-2">
                        {isSelectedPlaceAlreadyInCatalog ? (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                              Esse lugar já está catalogado no repositório.
                            </span>
                            <button
                              disabled
                              className="px-4 py-2 bg-slate-800 text-slate-500 text-xs font-semibold rounded-xl cursor-not-allowed shrink-0"
                            >
                              Já Cadastrado
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleSaveToGitHub}
                            disabled={savingToGitHub}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-2xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {savingToGitHub ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Gravando commit no GitHub...</span>
                              </>
                            ) : (
                              <>
                                <FolderGit2 className="w-4 h-4" />
                                <span>Salvar no Catálogo GitHub ({catalogPath})</span>
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
          <div className="space-y-6 animate-fade-in">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-indigo-400" />
                  Total de Lugares Salvos
                </span>
                <p className="text-3xl font-bold text-white mt-2">{catalog.length}</p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Arquivo: <code className="font-mono text-slate-400">{catalogPath}</code>
                </span>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Categorias Únicas
                </span>
                <p className="text-3xl font-bold text-white mt-2">{uniqueCategories.length}</p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Classificações do Google Places
                </span>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Repositório Conectado
                  </span>
                  <p className="text-sm font-semibold text-slate-200 mt-2 truncate">
                    MaisOuMenos170/CacheGoogleMaps
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={handleDownloadJSON}
                    disabled={catalog.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar JSON</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(catalog, null, 2), "json")}
                    disabled={catalog.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition disabled:opacity-40"
                  >
                    {copiedId === "json" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter and View Bar */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={catalogFilter}
                    onChange={(e) => setCatalogFilter(e.target.value)}
                    placeholder="Filtrar por nome, endereço..."
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Category Filter Select */}
                {uniqueCategories.length > 0 && (
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
                  >
                    <option value="all">Todas as categorias</option>
                    {uniqueCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => setCatalogViewMode("grid")}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      catalogViewMode === "grid"
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Visualização em Grade"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCatalogViewMode("list")}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      catalogViewMode === "list"
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Visualização em Lista"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => loadCatalog()}
                  disabled={loadingCatalog}
                  className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center gap-1.5"
                >
                  {loadingCatalog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sincronizar"}
                </button>
              </div>
            </div>

            {/* Catalog Items Display */}
            {loadingCatalog ? (
              <div className="p-16 rounded-3xl bg-slate-900/50 border border-slate-800 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
                <p className="text-xs">Baixando arquivo JSON do repositório GitHub...</p>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="p-16 rounded-3xl bg-slate-900/30 border border-slate-800 text-center text-slate-500">
                <FolderGit2 className="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-300">Nenhum lugar encontrado</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {catalog.length === 0
                    ? "O catálogo ainda está vazio. Use a aba Explorar para adicionar o primeiro lugar!"
                    : "Nenhum lugar corresponde aos filtros selecionados."}
                </p>
              </div>
            ) : catalogViewMode === "grid" ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((item, idx) => (
                  <div
                    key={item.place_id || idx}
                    className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/90 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm text-slate-100 group-hover:text-white transition">
                          {item.name}
                        </h3>
                        {item.rating !== undefined && (
                          <div className="flex items-center text-amber-400 font-semibold text-xs shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                            {item.rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      {item.formatted_address && (
                        <p className="text-xs text-slate-400 mt-2 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{item.formatted_address}</span>
                        </p>
                      )}

                      {item.geometry?.location && (
                        <div className="mt-2 text-[11px] font-mono text-slate-500">
                          Lat: {item.geometry.location.lat.toFixed(4)}, Lng: {item.geometry.location.lng.toFixed(4)}
                        </div>
                      )}

                      {item.types && item.types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.types.slice(0, 3).map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 bg-slate-950 text-slate-400 rounded-md text-[10px] font-mono border border-slate-800/80"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span className="text-[11px]">
                        {item.added_at
                          ? `Salvo em ${new Date(item.added_at).toLocaleDateString("pt-BR")}`
                          : ""}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium text-xs"
                        >
                          Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* COMPACT LIST VIEW */
              <div className="rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Nome do Lugar</th>
                        <th className="py-3 px-4">Endereço</th>
                        <th className="py-3 px-4">Avaliação</th>
                        <th className="py-3 px-4">Categorias</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredCatalog.map((item, idx) => (
                        <tr key={item.place_id || idx} className="hover:bg-slate-800/30 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">{item.name}</td>
                          <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                            {item.formatted_address}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.rating !== undefined ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                                <Star className="w-3 h-3 fill-amber-400" />
                                {item.rating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                            {item.types?.slice(0, 2).join(", ")}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                Maps <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2 text-base">
                <Settings className="w-5 h-5 text-indigo-400" />
                Configurações & Chaves
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* GitHub Token */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={tempGithubToken}
                  onChange={(e) => setTempGithubToken(e.target.value)}
                  placeholder="github_pat_..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Permissão necessária: <strong>Contents: Read and write</strong> no repositório.
                </p>
              </div>

              {/* Google Places API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  Google Places API Key
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-300 space-y-1">
                <p className="font-semibold">💡 Dica de Segurança:</p>
                <p>As chaves ficam salvas de forma segura no seu navegador e são enviadas apenas para as Serverless Functions do backend.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-indigo-400 to-sky-400 hover:from-indigo-300 hover:to-sky-300 rounded-xl transition shadow-lg shadow-indigo-500/20"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-600">
          PlaceCache &bull; Google Places API &bull; GitHub REST API
        </div>
      </footer>
    </div>
  );
}
