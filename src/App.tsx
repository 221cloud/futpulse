import { useEffect, useMemo, useState } from "react";
import { getFootballFixtures } from "./services/footballApi";
import type { FootballFixture } from "./types/football";

type Language = "FR" | "EN";
type Tab = "home" | "matches" | "news" | "favorites" | "profile";

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
  kickoffAt?: string | null;
};

const demoMatches: Match[] = [
  { id: 1, competition: "Ligue 1", home: "PSG", away: "Marseille", homeScore: 2, awayScore: 1, time: "68’", status: "live", featured: true },
  { id: 2, competition: "Premier League", home: "Arsenal", away: "Liverpool", time: "20:00", status: "upcoming", featured: true },
  { id: 3, competition: "La Liga", home: "Real Madrid", away: "Barcelona", homeScore: 1, awayScore: 1, time: "Terminé", status: "finished" },
  { id: 4, competition: "Ligue 1 Sénégal", home: "Stade de Mbour", away: "Génération Foot", time: "Demain · 17:30", status: "upcoming" }
];

const copy = {
  FR: {
    home: "Accueil", matches: "Matchs", news: "Actualités", favorites: "Favoris", profile: "Profil",
    greeting: "Le football, en temps réel.", subtitle: "Toute l’actualité du jeu. Au même endroit.",
    live: "EN DIRECT", today: "À la une", seeAll: "Tout voir", upcoming: "À venir",
    latest: "Dernières actualités", competitions: "Compétitions suivies", demo: "Version de démonstration",
    demoText: "Les scores et contenus affichés sont fictifs. Aucune source de données en direct n’est encore connectée.",
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
    demoText: "Scores and content shown are fictional. No live data provider is connected yet.",
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
  const [apiMatches, setApiMatches] = useState<Match[]>([]);
  const [dataMode, setDataMode] = useState<"loading" | "live" | "demo">("loading");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "upcoming" | "finished">("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const t = copy[language];
  const sourceMatches = apiMatches.length > 0 ? apiMatches : demoMatches;
  const matches = useMemo(() => [...sourceMatches].sort((a, b) => {
    const rank = { live: 0, upcoming: 1, finished: 2 };
    return rank[a.status] - rank[b.status];
  }), [sourceMatches]);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");

    getFootballFixtures(today)
      .then((result) => {
        if (cancelled) return;
        const formatted: Match[] = result.data.map((fixture: FootballFixture, index) => ({
          id: Number(fixture.id) || index + 1,
          competition: fixture.competitionName || ("Compétition " + fixture.competitionId),
          home: fixture.homeTeam.name,
          away: fixture.awayTeam.name,
          homeScore: fixture.homeScore ?? undefined,
          awayScore: fixture.awayScore ?? undefined,
          time: fixture.status === "finished"
            ? "Terminé"
            : fixture.kickoffAt
              ? new Date(fixture.kickoffAt).toLocaleTimeString(language === "FR" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })
              : "Horaire à confirmer",
          status: fixture.status === "live" ? "live" as const : fixture.status === "finished" ? "finished" as const : "upcoming" as const,
          featured: false,
          kickoffAt: fixture.kickoffAt
        }));
        formatted.sort((a, b) => {
          const rank = { live: 0, upcoming: 1, finished: 2 };
          return rank[a.status] - rank[b.status];
        });
        formatted.forEach((match, index) => { match.featured = index < 2; });
        setApiMatches(formatted);
        setDataMode(formatted.length > 0 ? "live" : "demo");
      })
      .catch(() => {
        if (!cancelled) setDataMode("demo");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((match) =>
      (statusFilter === "all" || match.status === statusFilter) &&
      (competitionFilter === "all" || match.competition === competitionFilter) &&
      [match.competition, match.home, match.away].some((value) => value.toLowerCase().includes(q))
    );
  }, [query, matches, statusFilter, competitionFilter]);

  const competitions = useMemo(() => [...new Set(matches.map((match) => match.competition))].sort(), [matches]);

  const toggleFavorite = (name: string) => {
    setFavorites((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  const title = tab === "home" ? t.home : tab === "matches" ? t.matches : tab === "news" ? t.news : tab === "favorites" ? t.favorites : t.profile;

  return (
    <div className="app-shell">
      <div className="demo-strip"><span className="demo-dot" />{dataMode === "live" ? "Données du jour chargées depuis API-Football." : dataMode === "loading" ? "Connexion au service football…" : t.demo + " — " + t.demoText}</div>
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
                  {matches.filter((match) => match.featured).map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} onOpen={() => setSelectedMatch(match)} />)}
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading"><div><div className="eyebrow">THE NEXT KICK-OFF</div><h2>{t.upcoming}</h2></div><button className="text-button" onClick={() => setTab("matches")}>{t.seeAll} <span>↗</span></button></div>
                <div className="upcoming-list">
                  {matches.filter((match) => match.status === "upcoming").map((match) => <MatchRow key={match.id} match={match} />)}
                </div>
              </section>

              <NewsSection language={language} onOpen={() => setTab("news")} />
            </>
          )}

          {tab === "matches" && (
            <section className="page-section">
              <div className="page-heading"><div className="eyebrow">THE PITCH</div><h1>{t.allMatches}</h1><p>{dataMode === "live" ? "Rencontres du jour fournies par API-Football." : t.demoText}</p></div>
              <div className="match-filters">
                <div className="filter-tabs" role="group" aria-label="Filtrer par statut">
                  {(["all", "live", "upcoming", "finished"] as const).map((status) => <button key={status} className={statusFilter === status ? "filter-tab active" : "filter-tab"} onClick={() => setStatusFilter(status)}>{status === "all" ? "Tous" : status === "live" ? "En direct" : status === "upcoming" ? "À venir" : "Terminés"}</button>)}
                </div>
                <select className="competition-select" value={competitionFilter} onChange={(event) => setCompetitionFilter(event.target.value)} aria-label="Filtrer par compétition">
                  <option value="all">Toutes les compétitions</option>
                  {competitions.map((competition) => <option key={competition} value={competition}>{competition}</option>)}
                </select>
              </div>
              <div className="match-grid">{filteredMatches.map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} onOpen={() => setSelectedMatch(match)} />)}</div>
              {filteredMatches.length === 0 && <div className="empty-state">Aucun résultat pour « {query} ».</div>}
            </section>
          )}

          {tab === "news" && <section className="page-section"><div className="page-heading"><div className="eyebrow">THE TOUCHLINE</div><h1>{t.latest}</h1><p>{t.newsBody}</p></div><NewsSection language={language} onOpen={() => undefined} expanded /></section>}

          {tab === "favorites" && (
            <section className="page-section"><div className="page-heading"><div className="eyebrow">YOUR GAME</div><h1>{t.favorites}</h1><p>{t.favoriteHint}</p></div>
              {favorites.length ? <div className="favorite-chips">{favorites.map((name) => <button key={name} className="favorite-chip" onClick={() => toggleFavorite(name)}>{name}<span>×</span></button>)}</div> : <div className="empty-state">{t.empty}</div>}
              <div className="section-heading compact-heading"><h2>{t.today}</h2></div><div className="match-grid">{matches.map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} onOpen={() => setSelectedMatch(match)} />)}</div>
            </section>
          )}

          {tab === "profile" && <section className="page-section profile-page"><div className="profile-avatar">DS</div><div className="eyebrow">YOUR SPACE</div><h1>{t.profile}</h1><p>{t.profileText}</p><div className="profile-note">La création de compte et les paramètres seront ajoutés lors d’une prochaine étape.</div></section>}

          <footer className="footer"><span>© 2026 FUTPULSE</span><span>BUILT FOR THE LOVE OF FOOTBALL <b>✦</b></span></footer>
        </main>
      </div>

      {selectedMatch && <MatchDetails match={selectedMatch} onClose={() => setSelectedMatch(null)} />}

      <nav className="mobile-nav">
        {navItems.map((item) => <button key={item.id} className={tab === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{t[item.id]}</small></button>)}
      </nav>
    </div>
  );
}

function MatchCard({ match, favorite, onFavorite, onOpen }: { match: Match; favorite: boolean; onFavorite: () => void; onOpen: () => void }) {
  return (
    <article className="match-card">
      <div className="match-card-top"><span>{match.competition}</span><button className={favorite ? "star-button selected" : "star-button"} onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label="Ajouter aux favoris">★</button></div>
      <div className="teams">
        <div className="team"><span className="team-crest">{match.home.slice(0, 1)}</span><strong>{match.home}</strong></div>
        <div className="score-block">{match.status === "upcoming" ? <span className="versus">VS</span> : <strong>{match.homeScore} <i>:</i> {match.awayScore}</strong>}<small className={match.status === "live" ? "match-time live-time" : "match-time"}>{match.status === "live" && <span className="live-pulse" />}{match.time}</small></div>
        <div className="team"><span className="team-crest">{match.away.slice(0, 1)}</span><strong>{match.away}</strong></div>
      </div>
      <div className="match-card-bottom"><span>{match.status === "live" ? "● EN COURS" : match.status === "finished" ? "RENCONTRE TERMINÉE" : "PROCHAIN MATCH"}</span><button className="match-open-button" onClick={onOpen}>Centre du match ↗</button></div>
    </article>
  );
}

function MatchDetails({ match, onClose }: { match: Match; onClose: () => void }) {
  const kickoff = match.kickoffAt ? new Date(match.kickoffAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) : match.time;
  return <div className="match-modal-backdrop" onClick={onClose} role="presentation">
    <section className="match-modal" role="dialog" aria-modal="true" aria-label="Détails du match" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
      <span className="modal-competition">{match.competition}</span>
      <div className="modal-status">{match.status === "live" ? "● EN DIRECT" : match.status === "finished" ? "RENCONTRE TERMINÉE" : "À VENIR"}</div>
      <div className="modal-scoreline"><div><span className="modal-crest">{match.home.slice(0,1)}</span><strong>{match.home}</strong></div><b>{match.status === "upcoming" ? "VS" : `${match.homeScore ?? "–"} : ${match.awayScore ?? "–"}`}</b><div><span className="modal-crest">{match.away.slice(0,1)}</span><strong>{match.away}</strong></div></div>
      <div className="modal-kickoff">{kickoff}</div>
      <p className="modal-note">Les compositions, statistiques et événements détaillés seront disponibles dans une prochaine version du centre de match.</p>
    </section>
  </div>;
}

function MatchRow({ match }: { match: Match }) {
  return <div className="match-row"><span className="row-competition">{match.competition}</span><strong>{match.home}</strong><span className="row-vs">—</span><strong>{match.away}</strong><span className="row-time">{match.time}</span></div>;
}

function NewsSection({ language, onOpen, expanded = false }: { language: Language; onOpen: () => void; expanded?: boolean }) {
  const stories = language === "FR" ? [
    { category: "ANALYSE", title: "Les nouvelles générations redessinent le visage du football", time: "5 min de lecture", mark: "01" },
    { category: "AFRIQUE", title: "Le football africain affirme ses ambitions sur la scène mondiale", time: "4 min de lecture", mark: "02" },
    { category: "TACTIQUE", title: "Pressing, transitions : les tendances qui façonnent le jeu", time: "6 min de lecture", mark: "03" }
  ] : [
    { category: "ANALYSIS", title: "A new generation is reshaping the face of football", time: "5 min read", mark: "01" },
    { category: "AFRICA", title: "African football makes its ambitions known on the world stage", time: "4 min read", mark: "02" },
    { category: "TACTICS", title: "Pressing and transitions: trends shaping the modern game", time: "6 min read", mark: "03" }
  ];
  return <section className="section-block news-block"><div className="section-heading"><div><div className="eyebrow">BEYOND THE SCORE</div><h2>{copy[language].latest}</h2></div>{!expanded && <button className="text-button" onClick={onOpen}>{copy[language].seeAll} <span>↗</span></button>}</div><div className="news-grid">{stories.slice(0, expanded ? 3 : 2).map((story) => <article className="news-card" key={story.mark}><div className="news-art"><span className="news-number">{story.mark}</span><span className="news-symbol">✦</span><span className="news-category">{story.category}</span></div><div className="news-copy"><span>{story.category} · {story.time}</span><h3>{story.title}</h3><button onClick={onOpen}>{copy[language].read} ↗</button></div></article>)}</div></section>;
}

export default App;