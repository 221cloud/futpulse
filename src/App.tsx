import { useEffect, useMemo, useState } from "react";
import { getFootballFixtures } from "./services/footballApi";
import { getMatchDetails } from "./services/footballDetailsApi";
import type { MatchDetailsData } from "./services/footballDetailsApi";
import type { FootballFixture } from "./types/football";
import { getNewsArticles } from "./services/newsApi";
import type { NewsArticle } from "./services/newsApi";

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

const copy = {
  FR: {
    home: "Accueil", matches: "Matchs", news: "Actualités", favorites: "Favoris", profile: "Profil",
    greeting: "Le football en temps réel.", subtitle: "Toute l’actualité du jeu. Au même endroit.",
    live: "EN DIRECT", today: "À la une", seeAll: "Tout voir", upcoming: "À venir",
    latest: "Dernières actualités", competitions: "Compétitions suivies", demo: "Version de démonstration",
    demoText: "Aucun match du jour n’est disponible via le fournisseur. Les rencontres de démonstration sont fictives.",
    search: "Rechercher un club, un joueur, une compétition…", favoriteHint: "Ajoutez vos équipes et compétitions préférées pour les retrouver ici.",
    profileText: "Votre espace personnel arrivera dans une prochaine version.", profileNote: "La création de compte et les paramètres seront ajoutés lors d’une prochaine étape.", empty: "Aucun favori pour le moment.",
    explore: "Explorer les matchs", read: "Lire l’article", allMatches: "Tous les matchs",
    newsTitle: "Le jeu ne s’arrête jamais", newsBody: "Analyses, informations et histoires qui font vibrer le football.",
    newsLoading: "Chargement des actualités…", newsError: "Les actualités sont momentanément indisponibles.", newsEmpty: "Aucun article publié pour le moment.", newsSource: "Source"
  },
  EN: {
    home: "Home", matches: "Matches", news: "News", favorites: "Favorites", profile: "Profile",
    greeting: "Football, in real time.", subtitle: "Everything happening in the game. All in one place.",
    live: "LIVE", today: "Featured", seeAll: "See all", upcoming: "Upcoming",
    latest: "Latest news", competitions: "Followed competitions", demo: "Demo version",
    demoText: "No matches are currently available from the provider. Demo fixtures are fictional.",
    search: "Search for a club, player, competition…", favoriteHint: "Add your favorite teams and competitions to find them here.",
    profileText: "Your personal space is coming in a future release.", profileNote: "Account creation and settings will be added in a later stage.", empty: "No favorites yet.",
    explore: "Explore matches", read: "Read article", allMatches: "All matches",
    newsTitle: "The game never stops", newsBody: "Stories, insight and updates from the world of football.",
    newsLoading: "Loading news…", newsError: "News is temporarily unavailable.", newsEmpty: "No published articles yet.", newsSource: "Source"
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
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [newsStatus, setNewsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataMode, setDataMode] = useState<"loading" | "live" | "upcoming" | "empty">("loading");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "upcoming" | "finished">("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const t = copy[language];
  const sourceMatches = apiMatches;
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
      .then(async (todayResult) => {
        if (cancelled) return;
        const usingUpcoming = todayResult.data.length === 0;
        const fixtures = usingUpcoming ? (await getFootballFixtures()).data : todayResult.data;
        if (cancelled) return;
        const formatted: Match[] = fixtures.map((fixture: FootballFixture, index) => ({
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
        setDataMode(formatted.length === 0 ? "empty" : usingUpcoming ? "upcoming" : "live");
      })
      .catch(() => {
        if (!cancelled) setDataMode("empty");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getNewsArticles()
      .then((articles) => {
        if (cancelled) return;
        setNewsArticles(articles);
        setNewsStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setNewsStatus("error");
      });
    return () => { cancelled = true; };
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
      <div className="demo-strip"><span className="demo-dot" />{dataMode === "live" ? "Matchs du jour chargés depuis API-Football." : dataMode === "upcoming" ? "Aucun match aujourd’hui : les prochaines rencontres réelles sont affichées." : dataMode === "loading" ? "Connexion au service football…" : "Aucune rencontre disponible pour le moment."}</div>
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setTab("home"); }}>
          <span className="brand-mark">DS</span>
          <span className="brand-title">FUT<span className="brand-light">PULSE</span></span>
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
                  <div className="eyebrow"><span className="eyebrow-line" /> FUTPULSE</div>
                  <h1>{language === "FR" ? <>Le football<br /><span>en temps réel.</span></> : <>Football<br /><span>in real time.</span></>}</h1>
                  <p>{t.subtitle}</p>
                  <button className="primary-button" onClick={() => setTab("matches")}>{t.explore}<span>↗</span></button>
                </div>
                <div className="hero-ball" aria-hidden="true">⚽</div>
                <div className="hero-index"><span>01</span> / 05</div>
              </section>

              <section className="section-block">
                <div className="section-heading"><div><div className="eyebrow">{matches.some((match) => match.status === "live") && <span className="live-pulse" />}{matches.some((match) => match.status === "live") ? t.live : (language === "FR" ? "MATCHS DU JOUR" : "TODAY’S MATCHES")}</div><h2>{t.today}</h2></div><button className="text-button" onClick={() => setTab("matches")}>{t.seeAll} <span>↗</span></button></div>
                <div className="match-grid">
                  {matches.filter((match) => match.featured).map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} onOpen={() => setSelectedMatch(match)} />)}
                </div>
                {matches.length === 0 && <div className="empty-state">Aucune rencontre réelle n’est disponible actuellement.</div>}
              </section>

              <section className="section-block">
                <div className="section-heading"><div><div className="eyebrow">{language === "FR" ? "PROCHAINS MATCHS" : "UPCOMING FIXTURES"}</div><h2>{t.upcoming}</h2></div><button className="text-button" onClick={() => setTab("matches")}>{t.seeAll} <span>↗</span></button></div>
                <div className="upcoming-list">
                  {matches.filter((match) => match.status === "upcoming").slice(0, 6).map((match) => <MatchRow key={match.id} match={match} onOpen={() => setSelectedMatch(match)} />)}
                </div>
              </section>

              <NewsSection language={language} articles={newsArticles} status={newsStatus} onOpen={() => setTab("news")} onArticleOpen={setSelectedArticle} />
            </>
          )}

          {tab === "matches" && (
            <section className="page-section">
              <div className="page-heading"><div className="eyebrow">THE PITCH</div><h1>{t.allMatches}</h1><p>{dataMode === "live" ? "Rencontres du jour fournies par API-Football." : dataMode === "upcoming" ? "Prochaines rencontres fournies par API-Football." : dataMode === "loading" ? "Chargement des rencontres…" : "Aucune rencontre disponible pour le moment."}</p></div>
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
              {filteredMatches.length === 0 && <div className="empty-state">{dataMode === "empty" ? "Aucune rencontre réelle n’est disponible actuellement." : "Aucun résultat pour « " + query + " »."}</div>}
            </section>
          )}

          {tab === "news" && <section className="page-section"><div className="page-heading"><div className="eyebrow">THE TOUCHLINE</div><h1>{t.latest}</h1><p>{t.newsBody}</p></div><NewsSection language={language} articles={newsArticles} status={newsStatus} expanded onArticleOpen={setSelectedArticle} /></section>}

          {tab === "favorites" && (
            <section className="page-section"><div className="page-heading"><div className="eyebrow">YOUR GAME</div><h1>{t.favorites}</h1><p>{t.favoriteHint}</p></div>
              {favorites.length ? <div className="favorite-chips">{favorites.map((name) => <button key={name} className="favorite-chip" onClick={() => toggleFavorite(name)}>{name}<span>×</span></button>)}</div> : <div className="empty-state">{t.empty}</div>}
              <div className="section-heading compact-heading"><h2>{t.today}</h2></div><div className="match-grid">{matches.map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} onOpen={() => setSelectedMatch(match)} />)}</div>
            </section>
          )}

          {tab === "profile" && <section className="page-section profile-page"><div className="profile-avatar">DS</div><div className="eyebrow">YOUR SPACE</div><h1>{t.profile}</h1><p>{t.profileText}</p><div className="profile-note">{t.profileNote}</div></section>}

          <footer className="footer"><span>© 2026 FUTPULSE</span><span>BUILT FOR THE LOVE OF FOOTBALL <b>✦</b></span></footer>
        </main>
      </div>

      {selectedMatch && <MatchDetails match={selectedMatch} onClose={() => setSelectedMatch(null)} />}
      {selectedArticle && <NewsArticleModal article={selectedArticle} language={language} onClose={() => setSelectedArticle(null)} />}

      <nav className="mobile-nav">
        {navItems.map((item) => <button key={item.id} className={tab === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{t[item.id]}</small></button>)}
      </nav>
    </div>
  );
}

function MatchCard({ match, favorite, onFavorite, onOpen }: { match: Match; favorite: boolean; onFavorite: () => void; onOpen: () => void }) {
  return (
    <article className="match-card match-card-open" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}>
      <div className="match-card-top"><span className="competition-name">{match.competition}</span><button className={favorite ? "star-button selected" : "star-button"} onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label="Ajouter aux favoris">★</button></div>
      <div className="teams">
        <div className="team"><span className="team-crest">{match.home.slice(0, 1)}</span><strong>{match.home}</strong></div>
        <div className="score-block">{match.status === "upcoming" ? <span className="versus">VS</span> : <strong>{match.homeScore ?? "–"} <i>:</i> {match.awayScore ?? "–"}</strong>}<small className={match.status === "live" ? "match-time live-time" : "match-time"}>{match.status === "live" && <span className="live-pulse" />}{match.time}</small></div>
        <div className="team"><span className="team-crest">{match.away.slice(0, 1)}</span><strong>{match.away}</strong></div>
      </div>
      <div className="match-card-bottom"><span>{match.status === "live" ? "● EN COURS" : match.status === "finished" ? "RENCONTRE TERMINÉE" : "PROCHAIN MATCH"}</span><span className="match-open-hint">Voir le match ↗</span></div>
    </article>
  );
}

function MatchDetails({ match, onClose }: { match: Match; onClose: () => void }) {
  const [details, setDetails] = useState<MatchDetailsData | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeSection, setActiveSection] = useState<"resume" | "compositions" | "statistiques" | "evenements">("resume");
  const kickoff = match.kickoffAt ? new Date(match.kickoffAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) : match.time;

  useEffect(() => {
    let cancelled = false;
    setDetailsStatus("loading");
    getMatchDetails(match.id)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setDetailsStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setDetailsStatus("error");
      });
    return () => { cancelled = true; };
  }, [match.id]);

  const statisticTypes = [...new Set((details?.statistics ?? []).flatMap((team) => (team.statistics ?? []).map((item) => item.type ?? "")))].filter(Boolean);
  const formatStatistic = (value: string | number | null | undefined) => value === null || value === undefined ? "—" : String(value);
  const numericStatistic = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return null;
    const found = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return found ? Number(found[0]) : null;
  };
  const eventTime = (elapsed?: number | null, extra?: number | null) => elapsed == null ? "—" : `${elapsed}${extra ? "+" + extra : ""}'`;
  const lineups = details?.lineups ?? [];
  const getPlayerPosition = (entry: NonNullable<MatchDetailsData["lineups"][number]["startXI"]>[number], lineup: MatchDetailsData["lineups"][number], teamIndex: number, playerIndex: number) => {
    const starters = lineup.startXI ?? [];
    const grid = entry.player?.grid?.split(":").map(Number);
    const maxRow = Math.max(1, ...starters.map((player) => Number(player.player?.grid?.split(":")[0]) || 0));
    const maxCol = Math.max(1, ...starters.map((player) => Number(player.player?.grid?.split(":")[1]) || 0));
    if (grid && grid.length === 2 && grid.every((value) => Number.isFinite(value) && value > 0)) {
      const rawTop = (((grid[0] ?? 1) - 0.5) / maxRow) * 100;
      return { top: `${teamIndex === 0 ? 100 - rawTop : rawTop}%`, left: `${(((grid[1] ?? 1) - 0.5) / maxCol) * 100}%` };
    }
    const pos = (entry.player?.pos ?? "").toUpperCase();
    const role = pos === "G" ? 0 : pos === "D" ? 1 : pos === "M" ? 2 : 3;
    const sameRole = starters.filter((player) => (player.player?.pos ?? "").toUpperCase() === pos);
    const indexInRole = sameRole.indexOf(entry);
    const rawTop = ((role + 0.5) / 4) * 100;
    return { top: `${teamIndex === 0 ? 100 - rawTop : rawTop}%`, left: `${((indexInRole + 0.5) / Math.max(1, sameRole.length)) * 100}%` };
  };
  const tabs = [
    { id: "resume" as const, label: "Résumé" },
    { id: "compositions" as const, label: "Compositions" },
    { id: "statistiques" as const, label: "Statistiques" },
    { id: "evenements" as const, label: "Événements" }
  ];

  return <div className="match-modal-backdrop" onClick={onClose} role="presentation">
    <section className="match-modal match-centre-modal" role="dialog" aria-modal="true" aria-label="Centre du match" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
      <span className="modal-competition">{match.competition}</span>
      <div className="modal-status">{match.status === "live" ? "● EN DIRECT" : match.status === "finished" ? "RENCONTRE TERMINÉE" : "À VENIR"}</div>
      <div className="modal-scoreline"><div><span className="modal-crest">{match.home.slice(0,1)}</span><strong>{match.home}</strong></div><b>{match.status === "upcoming" ? "VS" : `${match.homeScore ?? "–"} : ${match.awayScore ?? "–"}`}</b><div><span className="modal-crest">{match.away.slice(0,1)}</span><strong>{match.away}</strong></div></div>
      <div className="modal-kickoff">{kickoff}</div>
      <nav className="match-detail-tabs" aria-label="Rubriques du match">
        {tabs.map((tab) => <button key={tab.id} className={activeSection === tab.id ? "match-detail-tab active" : "match-detail-tab"} onClick={() => setActiveSection(tab.id)}>{tab.label}</button>)}
      </nav>
      {detailsStatus === "loading" && <p className="modal-note">Chargement des compositions, statistiques et événements…</p>}
      {detailsStatus === "error" && <p className="modal-note">Impossible de charger les détails pour le moment. Réessaie dans quelques instants.</p>}
      {detailsStatus === "ready" && details && <>
        {(activeSection === "resume" || activeSection === "compositions") && <div className="detail-section">
          <h3>Compositions · {lineups.map((lineup) => lineup.formation).filter(Boolean).join(" — ")}</h3>
          {!details.availability.lineups ? <p className="detail-empty">Les compositions ne sont pas encore publiées pour cette rencontre.</p> : <>
            <div className="single-lineup-pitch">
              <div className="pitch-team-label pitch-away-label">{lineups[1]?.team?.name ?? match.away} <small>{lineups[1]?.formation ?? ""}</small></div>
              {lineups.map((lineup, teamIndex) => (lineup.startXI ?? []).map((entry, playerIndex) => {
                const position = getPlayerPosition(entry, lineup, teamIndex, playerIndex);
                return <div className={teamIndex === 0 ? "pitch-player pitch-home-player" : "pitch-player pitch-away-player"} key={entry.player?.id ?? `${teamIndex}-${playerIndex}`} style={position}>
                  <span>{entry.player?.number ?? "—"}</span><small>{entry.player?.name ?? "Joueur"}</small>
                </div>;
              }))}
              <div className="pitch-midline" />
              <div className="pitch-team-label pitch-home-label">{lineups[0]?.team?.name ?? match.home} <small>{lineups[0]?.formation ?? ""}</small></div>
            </div>
            <div className="bench-heading"><h3>Banc des remplaçants</h3><span>{lineups.reduce((total, lineup) => total + (lineup.substitutes?.length ?? 0), 0)} joueurs</span></div>
            <div className="bench-teams">{lineups.map((lineup, teamIndex) => <div className="bench-team" key={lineup.team?.name ?? teamIndex}>
              <strong>{lineup.team?.name ?? "Équipe"}</strong>
              {(lineup.substitutes ?? []).length === 0 ? <p className="detail-empty">Aucun remplaçant renseigné.</p> : (lineup.substitutes ?? []).map((entry, playerIndex) => <div className="bench-player" key={entry.player?.id ?? playerIndex}>
                <span>{entry.player?.number ?? "—"}</span><strong>{entry.player?.name ?? "Joueur"}</strong><small>{entry.player?.pos ?? ""}</small>
              </div>)}
            </div>)}</div>
          </>}
        </div>}
        {(activeSection === "resume" || activeSection === "statistiques") && <div className="detail-section">
          <h3>Statistiques du match</h3>
          {!details.availability.statistics ? <p className="detail-empty">Les statistiques ne sont pas encore disponibles.</p> :
            <div className="visual-statistics">
              <div className="visual-stat-head"><strong>{details.statistics[0]?.team?.name ?? match.home}</strong><strong>{details.statistics[1]?.team?.name ?? match.away}</strong></div>
              {statisticTypes.map((type) => {
                const homeValue = details.statistics[0]?.statistics?.find((item) => item.type === type)?.value;
                const awayValue = details.statistics[1]?.statistics?.find((item) => item.type === type)?.value;
                const homeNumber = numericStatistic(homeValue);
                const awayNumber = numericStatistic(awayValue);
                const total = (homeNumber ?? 0) + (awayNumber ?? 0);
                const homeWidth = total > 0 && homeNumber !== null ? (homeNumber / total) * 100 : 50;
                const awayWidth = total > 0 && awayNumber !== null ? (awayNumber / total) * 100 : 50;
                return <div className="visual-stat-row" key={type}>
                  <div className="visual-stat-values"><strong>{formatStatistic(homeValue)}</strong><span>{type}</span><strong>{formatStatistic(awayValue)}</strong></div>
                  <div className="visual-stat-track"><span className="visual-stat-home" style={{ width: `${homeWidth}%` }} /><span className="visual-stat-away" style={{ width: `${awayWidth}%` }} /></div>
                </div>;
              })}
            </div>}
        </div>}
        {(activeSection === "resume" || activeSection === "evenements") && <div className="detail-section">
          <h3>Chronologie du match</h3>
          {!details.availability.events ? <p className="detail-empty">Aucun événement détaillé disponible pour le moment.</p> :
            <div className="events-list">{details.events.map((event, index) => <div className="event-row" key={index}><time>{eventTime(event.time?.elapsed, event.time?.extra)}</time><strong>{event.type ?? "Événement"} · {event.detail ?? ""}</strong><span>{event.player?.name ?? ""}{event.assist?.name ? ` · Passe : ${event.assist.name}` : ""}</span><small>{event.team?.name ?? ""}</small></div>)}</div>}
        </div>}
        <p className="detail-attribution">Données fournies par API-Football. Leur disponibilité dépend de la rencontre.</p>
      </>}
    </section>
  </div>;
}
function MatchRow({ match, onOpen }: { match: Match; onOpen: () => void }) {
  return <div className="match-row match-row-open" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}><span className="row-competition">{match.competition}</span><strong>{match.home}</strong><span className="row-vs">—</span><strong>{match.away}</strong><span className="row-time">{match.time}</span></div>;
}

function formatNewsDate(value: string, language: Language): string {
  if (!value) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === "FR" ? "fr-FR" : "en-GB", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function NewsSection({ language, articles, status, onOpen, onArticleOpen, expanded = false }: {
  language: Language;
  articles: NewsArticle[];
  status: "loading" | "ready" | "error";
  onOpen?: () => void;
  onArticleOpen: (article: NewsArticle) => void;
  expanded?: boolean;
}) {
  const t = copy[language];
  const visibleArticles = expanded ? articles : articles.slice(0, 2);

  return <section className="section-block news-block">
    <div className="section-heading">
      <div><div className="eyebrow">BEYOND THE SCORE</div><h2>{t.latest}</h2></div>
      {!expanded && onOpen && <button className="text-button" onClick={onOpen}>{t.seeAll} <span>↗</span></button>}
    </div>
    {status === "loading" && <div className="empty-state">{t.newsLoading}</div>}
    {status === "error" && <div className="empty-state">{t.newsError}</div>}
    {status === "ready" && articles.length === 0 && <div className="empty-state">{t.newsEmpty}</div>}
    {status === "ready" && visibleArticles.length > 0 && <div className="news-grid">
      {visibleArticles.map((article, index) => <article className="news-card news-card-clickable" key={article.id} onClick={() => onArticleOpen(article)}>
        <div className="news-art">
          {article.imageUrl
            ? <img className="news-image" src={article.imageUrl} alt="" loading="lazy" />
            : <span className="news-symbol">✦</span>}
          <span className="news-number">{String(index + 1).padStart(2, "0")}</span>
          <span className="news-category">{article.category}</span>
        </div>
        <div className="news-copy">
          <span>{article.category}{article.publishedAt ? ` · ${formatNewsDate(article.publishedAt, language)}` : ""}</span>
          <h3>{article.title}</h3>
          {article.content && <p className="news-excerpt">{article.content}</p>}
          {article.source && <span className="news-source">{t.newsSource} : {article.source}</span>}
          <button className="news-read-button" onClick={(event) => { event.stopPropagation(); onArticleOpen(article); }}>{t.read} ↗</button>
        </div>
      </article>)}
    </div>}
  </section>;
}

function NewsArticleModal({ article, language, onClose }: { article: NewsArticle; language: Language; onClose: () => void }) {
  const date = article.publishedAt ? formatNewsDate(article.publishedAt, language) : "";
  return <div className="news-modal-backdrop" onClick={onClose} role="presentation">
    <article className="news-modal" role="dialog" aria-modal="true" aria-label={article.title} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
      {article.imageUrl && <img className="news-modal-image" src={article.imageUrl} alt="" />}
      <div className="news-modal-body">
        <div className="eyebrow">{article.category}</div>
        <h2>{article.title}</h2>
        {(date || article.source) && <p className="news-modal-meta">{[date, article.source].filter(Boolean).join(" · ")}</p>}
        <div className="news-modal-content">{article.content || "Aucun contenu supplémentaire pour cet article."}</div>
      </div>
    </article>
  </div>;
}

export default App;