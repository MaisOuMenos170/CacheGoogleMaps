import { CatalogItem, GitHubCatalogResponse } from "./types";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

export function getGitHubConfig(): GitHubConfig {
  const token =
    process.env.GITHUB_TOKEN?.trim() ||
    "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";
  const owner = process.env.GITHUB_OWNER?.trim() || "MaisOuMenos170";
  const repo = process.env.GITHUB_REPO?.trim() || "CacheGoogleMaps";
  const branch = process.env.GITHUB_BRANCH?.trim() || "main";
  const filePath = (process.env.GITHUB_FILE_PATH?.trim() || "data/lugares.json").replace(/^\//, "");

  if (!token) {
    throw new Error("Variável GITHUB_TOKEN não configurada no ambiente.");
  }

  return { token, owner, repo, branch, filePath };
}

export async function fetchCatalogFromGitHub(): Promise<GitHubCatalogResponse> {
  const { token, owner, repo, branch, filePath } = getGitHubConfig();

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CacheGoogleMaps-App",
    },
    cache: "no-store",
  });

  if (res.status === 404) {
    return {
      sha: null,
      items: [],
      path: filePath,
      branch,
    };
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Erro ao buscar arquivo do GitHub (${res.status} ${res.statusText}): ${errorBody}`
    );
  }

  const data = await res.json();
  const rawContent = Buffer.from(data.content, "base64").toString("utf-8");

  let items: CatalogItem[] = [];
  try {
    const parsed = JSON.parse(rawContent);
    items = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    throw new Error(`O arquivo ${filePath} no GitHub não contém um JSON válido: ${(err as Error).message}`);
  }

  return {
    sha: data.sha,
    items,
    path: filePath,
    branch,
  };
}

export async function commitCatalogToGitHub(
  items: CatalogItem[],
  sha: string | null,
  commitMessage?: string
): Promise<{ commitSha: string; fileUrl: string }> {
  const { token, owner, repo, branch, filePath } = getGitHubConfig();

  const contentJson = JSON.stringify(items, null, 2) + "\n";
  const base64Content = Buffer.from(contentJson, "utf-8").toString("base64");

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  const bodyPayload: Record<string, unknown> = {
    message: commitMessage || `Atualiza catálogo com ${items.length} locais [skip ci]`,
    content: base64Content,
    branch,
  };

  if (sha) {
    bodyPayload.sha = sha;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "CacheGoogleMaps-App",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    if (res.status === 409) {
      throw new Error("Conflito de versão no GitHub (o arquivo foi modificado por outro processo). Tente novamente.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Permissão negada no GitHub. Verifique se o GITHUB_TOKEN tem acesso de 'Contents: Read and write' no repositório.");
    }
    throw new Error(
      `Erro ao realizar commit no GitHub (${res.status} ${res.statusText}): ${errorBody}`
    );
  }

  const data = await res.json();
  return {
    commitSha: data.commit?.sha || "",
    fileUrl: data.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
  };
}
