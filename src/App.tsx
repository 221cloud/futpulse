import { useEffect, useMemo, useState } from "react";

type Language = "FR" | "EN";
type Tab = "home" | "matches" | "news" | "favorites" | "profile";

type NewsArticle = { id: string; title: string; content: string; category: string; date: string; image?: string; };

type Match = {
  id: number;
  competition: string;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  time: string;
  status: "live" | "upcoming" | "finished";
  featured?: boolean;
};

const matches: Match[] = [
  { id: 1, competition: "Ligue 1", home: "PSG", away: "Marseille", homeScore: 2, awayScore: 1, time: "68’", status: "live", featured: true },
  { id: 2, competition: "Premier League", home: "Arsenal", away: "Liverpool", time: "20:00", status: "upcoming", featured: true },
  { id: 3, competition: "La Liga", home: "Real Madrid", away: "Barcelona", homeScore: 1, awayScore: 1, time: "Terminé", status: "finished" },
  { id: 4, competition: "Ligue 1 Sénégal", home: "Stade de Mbour", away: "Génération Foot", time: "Demain · 17:30", status: "upcoming" }
];

const NEWS_API = "https://221cloud-platform.elhadjidame-sall.workers.dev/api/public/applications/futpulse-7ffb77c9/tables/ddf4f9ce-ffc1-4361-be6b-00b7a129aeb8/rows?limit=20";

function readField(row: Record<string, unknown>, aliases: string[]): string {
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const wanted = aliases.map(normalize);
  const key = Object.keys(row).find((name) => wanted.includes(normalize(name)));
  const value = key ? row[key] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

const copy = {
  FR: {
    home: "Accueil", matches: "Matchs", news: "Actualités", favorites: "Favoris", profile: "Profil",
    greeting: "Le football, en temps réel.", subtitle: "Toute l’actualité du jeu. Au même endroit.",
    live: "EN DIRECT", today: "À la une", seeAll: "Tout voir", upcoming: "À venir",
    latest: "Dernières actualités", competitions: "Compétitions suivies", demo: "Version de démonstration",
    demoText: "Les scores restent en démonstration. Les actualités publiées sont chargées depuis la base FutPulse.",
    search: "Rechercher un club, un joueur, une compétition…", favoriteHint: "Ajoutez vos équipes et compétitions préférées pour les retrouver ici.",
    profileText: "Votre espace personnel arrivera dans une prochaine version.", empty: "Aucun favori pour le moment.",
    explore: "Explorer les matchs", read: "Lire l’article", allMatches: "Tous les matchs",
    newsTitle: "Le jeu ne s’arrête jamais", newsBody: "Analyses, informations et histoires qui font vibrer le football."
  },
  EN: {
    home: "Home", matches: "Matches", news: "News", favorites: "Favorites", profile: "Profile",
    greeting: "Football, in real time.", subtitle: "Everything happening in the game. All in one place.",
    live: "LIVE", today: "Featured", seeAll: "See all", upcoming: "Upcoming",
    latest: "Latest news", competitions: "Followed competitions", demo: "Demo version",
    demoText: "Match scores are still demo data. Published news is loaded from the FutPulse database.",
    search: "Search for a club, player, competition…", favoriteHint: "Add your favorite teams and competitions to find them here.",
    profileText: "Your personal space is coming in a future release.", empty: "No favorites yet.",
    explore: "Explore matches", read: "Read article", allMatches: "All matches",
    newsTitle: "The game never stops", newsBody: "Stories, insight and updates from the world of football."
  }
};

const navItems: { id: Tab; icon: string }[] = [
  { id: "home", icon: "⌂" },
  { id: "matches", icon: "◷" },
  { id: "news", icon: "▤" },
  { id: "favorites", icon: "☆" },
  { id: "profile", icon: "◉" }
];

function App() {
  const [language, setLanguage] = useState<Language>("FR");
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(["PSG", "Sénégal"]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState("");
  const t = copy[language];

  useEffect(() => {
    let active = true;
    fetch(NEWS_API, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de charger les actualités.");
        return response.json();
      })
      .then((payload: { rows?: Record<string, unknown>[] }) => {
        if (!active) return;
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        const loaded = rows.map((row, index) => ({
          id: String(row.row_id ?? index),
          title: readField(row, ["titre", "title", "headline"]) || "Actualité FutPulse",
          content: readField(row, ["contenu", "content", "body", "description", "texte"]),
          category: readField(row, ["categorie", "category", "rubrique"]) || "FOOTBALL",
          date: readField(row, ["date_publication", "published_at", "date", "created_at"]),
          image: readField(row, ["image_url", "image", "visuel", "thumbnail"]) || undefined
        }));
        setArticles(loaded);
        setNewsError("");
      })
      .catch((error: unknown) => {
        if (active) setNewsError(error instanceof Error ? error.message : "Erreur de chargement des actualités.");
      })
      .finally(() => { if (active) setNewsLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((match) =>
      [match.competition, match.home, match.away].some((value) => value.toLowerCase().includes(q))
    );
  }, [query]);

  const toggleFavorite = (name: string) => {
    setFavorites((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  const title = tab === "home" ? t.home : tab === "matches" ? t.matches : tab === "news" ? t.news : tab === "favorites" ? t.favorites : t.profile;

  return (
    <div className="app-shell">
      <div className="demo-strip"><span className="demo-dot" />{t.demo} — {t.demoText}</div>
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setTab("home"); }}>
          <span className="brand-mark">F<span>+</span></span>
          <span>FUT<span className="brand-light">PULSE</span></span>
        </a>
        <div className="header-actions">
          <label className="search-box">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
            <kbd>⌘ K</kbd>
          </label>
          <button className="language-button" onClick={() => setLanguage(language === "FR" ? "EN" : "FR")} aria-label="Change language">{language} <span>⌄</span></button>
          <button className="avatar-button" onClick={() => setTab("profile")} aria-label={t.profile}>DS</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="side-label">MENU</div>
          <nav>
            {navItems.map((item) => (
              <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => setTab(item.id)}>
                <span className="nav-icon">{item.icon}</span>{t[item.id]}
                {item.id === "matches" && <span className="nav-live" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="pulse-card"><div className="pulse-orb">✦</div><strong>Feel the game.</strong><p>Le meilleur du football, réuni dans une seule expérience.</p></div>
            <span className="version">FUTPULSE WEB · 0.1.0</span>
          </div>
        </aside>

        <main className="main-content">
          {tab === "home" && (
            <>
              <section className="hero">
                <div className="hero-glow" />
                <div className="hero-content">
                  <div className="eyebrow"><span className="eyebrow-line" /> THE WORLD OF FOOTBALL</div>
                  <h1>{t.greeting.split(",")[0]}<br /><span>{t.greeting.includes(",") ? t.greeting.split(",").slice(1).join(",").trim() : ""}</span></h1>
                  <p>{t.subtitle}</p>
                  <button className="primary-button" onClick={() => setTab("matches")}>{t.explore}<span>↗</span></button>
                </div>
                <div className="hero-ball" aria-hidden="true">⚽</div>
                <div className="hero-index"><span>01</span> / 05</div>
              </section>

              <section className="section-block">
                <div className="section-heading"><div><div className="eyebrow"><span className="live-pulse" /> {t.live}</div><h2>{t.today}</h2></div><button className="text-button" onClick={() => setTab("matches")}>{t.seeAll} <span>↗</span></button></div>
                <div className="match-grid">
                  {matches.filter((match) => match.featured).map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} />)}
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading"><div><div className="eyebrow">THE NEXT KICK-OFF</div><h2>{t.upcoming}</h2></div><button className="text-button" onClick={() => setTab("matches")}>{t.seeAll} <span>↗</span></button></div>
                <div className="upcoming-list">
                  {matches.filter((match) => match.status === "upcoming").map((match) => <MatchRow key={match.id} match={match} />)}
                </div>
              </section>

              <NewsSection language={language} onOpen={() => setTab("news")} articles={articles} loading={newsLoading} error={newsError} />
            </>
          )}

          {tab === "matches" && (
            <section className="page-section">
              <div className="page-heading"><div className="eyebrow">THE PITCH</div><h1>{t.allMatches}</h1><p>{t.demoText}</p></div>
              <div className="match-grid">{filteredMatches.map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} />)}</div>
              {filteredMatches.length === 0 && <div className="empty-state">Aucun résultat pour « {query} ».</div>}
            </section>
          )}

          {tab === "news" && <section className="page-section"><div className="page-heading"><div className="eyebrow">THE TOUCHLINE</div><h1>{t.latest}</h1><p>{t.newsBody}</p></div><NewsSection language={language} onOpen={() => undefined} articles={articles} loading={newsLoading} error={newsError} expanded /></section>}

          {tab === "favorites" && (
            <section className="page-section"><div className="page-heading"><div className="eyebrow">YOUR GAME</div><h1>{t.favorites}</h1><p>{t.favoriteHint}</p></div>
              {favorites.length ? <div className="favorite-chips">{favorites.map((name) => <button key={name} className="favorite-chip" onClick={() => toggleFavorite(name)}>{name}<span>×</span></button>)}</div> : <div className="empty-state">{t.empty}</div>}
              <div className="section-heading compact-heading"><h2>{t.today}</h2></div><div className="match-grid">{matches.map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} />)}</div>
            </section>
          )}

          {tab === "profile" && <section className="page-section profile-page"><div className="profile-avatar">DS</div><div className="eyebrow">YOUR SPACE</div><h1>{t.profile}</h1><p>{t.profileText}</p><div className="profile-note">La création de compte et les paramètres seront ajoutés lors d’une prochaine étape.</div></section>}

          <footer className="footer"><span>© 2026 FUTPULSE</span><span>BUILT FOR THE LOVE OF FOOTBALL <b>✦</b></span></footer>
        </main>
      </div>

      <nav className="mobile-nav">
        {navItems.map((item) => <button key={item.id} className={tab === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{t[item.id]}</small></button>)}
      </nav>
    </div>
  );
}

function MatchCard({ match, favorite, onFavorite }: { match: Match; favorite: boolean; onFavorite: () => void }) {
  return (
    <article className="match-card">
      <div className="match-card-top"><span>{match.competition}</span><button className={favorite ? "star-button selected" : "star-button"} onClick={onFavorite} aria-label="Ajouter aux favoris">★</button></div>
      <div className="teams">
        <div className="team"><span className="team-crest">{match.home.slice(0, 1)}</span><strong>{match.home}</strong></div>
        <div className="score-block">{match.status === "upcoming" ? <span className="versus">VS</span> : <strong>{match.homeScore} <i>:</i> {match.awayScore}</strong>}<small className={match.status === "live" ? "match-time live-time" : "match-time"}>{match.status === "live" && <span className="live-pulse" />}{match.time}</small></div>
        <div className="team"><span className="team-crest">{match.away.slice(0, 1)}</span><strong>{match.away}</strong></div>
      </div>
      <div className="match-card-bottom"><span>{match.status === "live" ? "● EN COURS" : match.status === "finished" ? "RENCONTRE TERMINÉE" : "PROCHAIN MATCH"}</span><span>Centre du match ↗</span></div>
    </article>
  );
}

function MatchRow({ match }: { match: Match }) {
  return <div className="match-row"><span className="row-competition">{match.competition}</span><strong>{match.home}</strong><span className="row-vs">—</span><strong>{match.away}</strong><span className="row-time">{match.time}</span></div>;
}

function NewsSection({ language, onOpen, expanded = false, articles, loading, error }: { language: Language; onOpen: () => void; expanded?: boolean; articles: NewsArticle[]; loading: boolean; error: string }) {
  const labels = copy[language];
  return <section className="section-block news-block">
    <div className="section-heading"><div><div className="eyebrow">BEYOND THE SCORE</div><h2>{labels.latest}</h2></div>{!expanded && <button className="text-button" onClick={onOpen}>{labels.seeAll} <span>↗</span></button>}</div>
    {loading && <div className="empty-state">{language === "FR" ? "Chargement des actualités…" : "Loading news…"}</div>}
    {!loading && error && <div className="empty-state" role="alert">{error}</div>}
    {!loading && !error && articles.length === 0 && <div className="empty-state">{language === "FR" ? "Aucune actualité publiée pour le moment." : "No published stories yet."}</div>}
    {!loading && !error && articles.length > 0 && <div className="news-grid">{articles.slice(0, expanded ? 20 : 2).map((story, index) => <article className="news-card" key={story.id}>
      <div className="news-art">{story.image ? <img src={story.image} alt="" loading="lazy" /> : <><span className="news-number">{String(index + 1).padStart(2, "0")}</span><span className="news-symbol">✦</span></>}<span className="news-category">{story.category}</span></div>
      <div className="news-copy"><span>{story.category}{story.date ? " · " + story.date : ""}</span><h3>{story.title}</h3>{story.content && <p>{story.content.length > 180 ? story.content.slice(0, 180) + "…" : story.content}</p>}<button onClick={onOpen}>{labels.read} ↗</button></div>
    </article>)}</div>}
  </section>;
}
export default App;