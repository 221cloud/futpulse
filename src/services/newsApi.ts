export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string;
}

interface NewsRow {
  row_id?: string | number;
  created_at?: string;
  titre?: string;
  contenu?: string;
  categorie?: string;
  image_url?: string | null;
  source?: string;
  date_publication?: string;
  statut?: string;
}

interface NewsResponse {
  rows?: NewsRow[];
}

const NEWS_API_URL =
  "https://221cloud-platform.elhadjidame-sall.workers.dev/api/public/applications/futpulse-7ffb77c9/tables/ddf4f9ce-ffc1-4361-be6b-00b7a129aeb8/rows";

function isPublished(status?: string): boolean {
  const normalized = (status ?? "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ["publie", "published", "public", "en ligne", "en_ligne", "online"].includes(normalized);
}

export async function getNewsArticles(): Promise<NewsArticle[]> {
  const response = await fetch(NEWS_API_URL, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Impossible de charger les actualités (HTTP ${response.status}).`);
  }

  const payload = await response.json() as NewsResponse;
  if (!Array.isArray(payload.rows)) {
    throw new Error("La réponse du service actualités est invalide.");
  }

  return payload.rows
    .filter((row) => isPublished(row.statut) && Boolean(row.titre?.trim()))
    .map((row, index) => ({
      id: String(row.row_id ?? index),
      title: row.titre!.trim(),
      content: (row.contenu ?? "").trim(),
      category: (row.categorie ?? "FOOTBALL").trim(),
      imageUrl: row.image_url?.trim() || null,
      source: (row.source ?? "").trim(),
      publishedAt: (row.date_publication || row.created_at || "").trim()
    }))
    .sort((a, b) => {
      const dateA = Date.parse(a.publishedAt);
      const dateB = Date.parse(b.publishedAt);
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });
}
