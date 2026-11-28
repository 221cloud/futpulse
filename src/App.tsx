import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { getFootballFixtures } from "./services/footballApi";
import { getMatchDetails } from "./services/footballDetailsApi";
import type { MatchDetailsData } from "./services/footballDetailsApi";
import type { FootballFixture } from "./types/football";
import { getNewsArticles } from "./services/newsApi";
import type { NewsArticle } from "./services/newsApi";
import { getCurrentUser, loginAccount, logoutAccount, registerAccount, requestPasswordReset, resetAccountPassword, updateAccountProfile, getPublicProfile, getUserPosts, getCommunityMembers, getPublicCommunityPosts, followUser, unfollowUser, getCommunityFeed, getMyPosts, createCommunityPost, likeCommunityPost, unlikeCommunityPost, getCommunityPostComments, createCommunityComment, deleteCommunityComment, getNotifications, markNotificationRead, markAllNotificationsRead, getMyStats, getAdminStatus, bootstrapAdmin, getAdminStats, reportCommunityPost, getAdminReports, reviewAdminReport, getAdminManualFixtures, createAdminManualFixture, updateAdminManualFixture } from "./services/authApi";
import type { FutPulsePublicProfile, FutPulseUser, FutPulsePost, FutPulseCommunityMember, FutPulsePostCategory, FutPulseComment, FutPulseNotification, FutPulseReportReason, FutPulseModerationReport, FutPulseManualFixture, ManualFixtureStatus } from "./services/authApi";

type Language = "FR" | "EN";
type Tab = "home" | "matches" | "news" | "featured" | "community" | "favorites" | "profile";

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
  source?: string;
};

const copy = {
  FR: {
    home: "Accueil", matches: "Matchs", news: "Actualités", featured: "À la une", community: "Communauté", favorites: "Favoris", profile: "Profil",
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
    home: "Home", matches: "Matches", news: "News", featured: "Featured", community: "Community", favorites: "Favorites", profile: "Profile",
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
  { id: "featured", icon: "✦" },
  { id: "community", icon: "◎" },
  { id: "favorites", icon: "☆" },
  { id: "profile", icon: "◉" }
];

function App() {
  const [language, setLanguage] = useState<Language>("FR");
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(window.location.search).has("resetToken") ? "profile" : "home");
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
          kickoffAt: fixture.kickoffAt,
          source: fixture.source
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
    let loading = false;

    const refreshNews = async () => {
      if (loading) return;
      loading = true;
      try {
        const articles = await getNewsArticles();
        if (cancelled) return;
        setNewsArticles(articles);
        setNewsStatus("ready");
      } catch {
        if (!cancelled) {
          setNewsStatus((current) => current === "loading" ? "error" : current);
        }
      } finally {
        loading = false;
      }
    };

    void refreshNews();
    const refreshInterval = window.setInterval(() => {
      void refreshNews();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((match) =>
      (statusFilter === "all" || match.status === statusFilter) &&
      (competitionFilter === "all" || match.competition === competitionFilter) &&
      (!q || [match.competition, match.home, match.away].some((value) => value.toLowerCase().includes(q)))
    );
  }, [query, matches, statusFilter, competitionFilter]);

  const competitions = useMemo(() => [...new Set(matches.map((match) => match.competition))].sort(), [matches]);
  const publicProfileMatch = window.location.pathname.match(/^\/profile\/([0-9a-f-]{36})\/?$/i);
  if (publicProfileMatch) return <PublicProfilePage userId={publicProfileMatch[1]} language={language} />;

  const toggleFavorite = (name: string) => {
    setFavorites((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  const title = tab === "home" ? t.home : tab === "matches" ? t.matches : tab === "news" ? t.news : tab === "featured" ? t.featured : tab === "community" ? t.community : tab === "favorites" ? t.favorites : t.profile;

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
          <NotificationCenter language={language} onNavigate={() => setTab("featured")} />
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

          {tab === "featured" && <CommunityPage language={language} />}
          {tab === "community" && <CommunityDiscoveryPage language={language} />}
          
          {tab === "favorites" && (
            <section className="page-section"><div className="page-heading"><div className="eyebrow">YOUR GAME</div><h1>{t.favorites}</h1><p>{t.favoriteHint}</p></div>
              {favorites.length ? <div className="favorite-chips">{favorites.map((name) => <button key={name} className="favorite-chip" onClick={() => toggleFavorite(name)}>{name}<span>×</span></button>)}</div> : <div className="empty-state">{t.empty}</div>}
              <div className="section-heading compact-heading"><h2>{t.today}</h2></div><div className="match-grid">{matches.map((match) => <MatchCard key={match.id} match={match} favorite={favorites.includes(match.home)} onFavorite={() => toggleFavorite(match.home)} onOpen={() => setSelectedMatch(match)} />)}</div>
            </section>
          )}

          {tab === "profile" && <ProfileAccount language={language} /> }

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




function NotificationCenter({ language, onNavigate }: { language: Language; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FutPulseNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fr = language === "FR";

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      setError(fr ? "Notifications indisponibles." : "Notifications unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void refresh();
  };

  const markRead = async (item: FutPulseNotification) => {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, readAt: Math.floor(Date.now() / 1000) } : entry));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        setError(fr ? "Impossible de marquer comme lue." : "Could not mark as read.");
        return;
      }
    }
    setOpen(false);
    onNavigate();
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const now = Math.floor(Date.now() / 1000);
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0);
    } catch {
      setError(fr ? "Impossible de tout marquer comme lu." : "Could not mark all as read.");
    }
  };

  const notificationText = (item: FutPulseNotification) => item.type === "follow"
    ? (fr ? "a commencé à vous suivre." : "started following you.")
    : item.type === "like"
      ? (fr ? "a aimé votre publication." : "liked your post.")
      : (fr ? "a commenté votre publication." : "commented on your post.");

  return <div className="notification-center">
    <button type="button" className="notification-bell" onClick={toggle} aria-label={fr ? "Notifications" : "Notifications"} aria-expanded={open}>
      <span aria-hidden="true">♧</span>
      {unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}
    </button>
    {open && <div className="notification-panel">
      <div className="notification-panel-head">
        <strong>{fr ? "Notifications" : "Notifications"}</strong>
        {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()}>{fr ? "Tout lire" : "Mark all read"}</button>}
      </div>
      {loading && <p className="notification-empty">{fr ? "Chargement…" : "Loading…"}</p>}
      {!loading && notifications.length === 0 && <p className="notification-empty">{fr ? "Aucune notification pour le moment." : "No notifications yet."}</p>}
      {!loading && notifications.map((item) => <button type="button" key={item.id} className={item.readAt ? "notification-item" : "notification-item unread"} onClick={() => void markRead(item)}>
        <span className="notification-avatar">{item.actorAvatar ? <img src={item.actorAvatar} alt="" /> : item.actorName.slice(0, 2).toUpperCase()}</span>
        <span className="notification-copy"><strong>{item.actorName}</strong> {notificationText(item)}<small>{new Date(item.createdAt * 1000).toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></span>
        {!item.readAt && <i aria-label={fr ? "Non lue" : "Unread"} />}
      </button>)}
      {error && <p className="notification-error" role="alert">{error}</p>}
    </div>}
  </div>;
}

function PostReactions({ post, language }: { post: FutPulsePost; language: Language }) {
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fr = language === "FR";

  useEffect(() => {
    setLikeCount(post.likeCount ?? 0);
    setLiked(Boolean(post.likedByMe));
  }, [post.likeCount, post.likedByMe]);

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = liked ? await unlikeCommunityPost(post.id) : await likeCommunityPost(post.id);
      setLikeCount(result.likeCount);
      setLiked(result.likedByMe);
    } catch {
      setError(fr ? "Impossible de modifier le J’aime. Réessaie." : "Could not update your like. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="community-post-actions">
    <button type="button" className={liked ? "community-like-button liked" : "community-like-button"} onClick={toggleLike} disabled={busy} aria-pressed={liked}>
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {liked ? (fr ? "J’aime" : "Liked") : (fr ? "J’aime" : "Like")} <strong>{likeCount}</strong>
    </button>
    {error && <small className="community-like-error" role="alert">{error}</small>}
  </div>;
}

function PostComments({ post, language }: { post: FutPulsePost; language: Language }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<FutPulseComment[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fr = language === "FR";

  const toggleComments = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true); setLoading(true); setError("");
    try {
      const [items, viewer] = await Promise.all([getCommunityPostComments(post.id), getCurrentUser()]);
      setComments(items); setViewerId(viewer?.id ?? "");
    } catch { setError(fr ? "Impossible de charger les commentaires." : "Could not load comments."); }
    finally { setLoading(false); }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const created = await createCommunityComment(post.id, content);
      setComments((current) => [...current, created]); setContent("");
      if (!viewerId) { const viewer = await getCurrentUser(); setViewerId(viewer?.id ?? ""); }
    } catch { setError(fr ? "Impossible d’envoyer le commentaire. Réessaie." : "Could not send comment. Try again."); }
    finally { setBusy(false); }
  };

  const removeComment = async (commentId: string) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await deleteCommunityComment(commentId); setComments((current) => current.filter((item) => item.id !== commentId)); }
    catch { setError(fr ? "Impossible de supprimer ce commentaire." : "Could not delete this comment."); }
    finally { setBusy(false); }
  };

  return <div className="community-comments">
    <button type="button" className="community-comments-toggle" onClick={toggleComments}>
      {open ? (fr ? "Masquer les commentaires" : "Hide comments") : (fr ? "Commentaires" : "Comments")} <span>{open ? comments.length : "＋"}</span>
    </button>
    {open && <div className="community-comments-panel">
      {loading && <small className="community-status">{fr ? "Chargement…" : "Loading…"}</small>}
      {!loading && comments.length === 0 && <small className="community-status">{fr ? "Aucun commentaire pour le moment." : "No comments yet."}</small>}
      {comments.map((comment) => <div className="community-comment" key={comment.id}>
        <div className="community-comment-avatar">{comment.authorAvatar ? <img src={comment.authorAvatar} alt="" /> : comment.authorName.slice(0, 2).toUpperCase()}</div>
        <div className="community-comment-body">
          <div className="community-comment-meta"><strong>{comment.authorName}</strong><time>{new Date(comment.createdAt * 1000).toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></div>
          <p>{comment.content}</p>
          {comment.userId === viewerId && <button type="button" className="community-comment-delete" onClick={() => void removeComment(comment.id)} disabled={busy}>{fr ? "Supprimer" : "Delete"}</button>}
        </div>
      </div>)}
      <form className="community-comment-form" onSubmit={submitComment}>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} placeholder={fr ? "Écrire un commentaire…" : "Write a comment…"} />
        <div><small>{content.length}/500</small><button className="account-submit" type="submit" disabled={busy || !content.trim()}>{busy ? (fr ? "Envoi…" : "Sending…") : (fr ? "Commenter" : "Comment")}</button></div>
      </form>
      {error && <small className="community-like-error" role="alert">{error}</small>}
    </div>}
  </div>;
}

function PostReport({ post, language }: { post: FutPulsePost; language: Language }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FutPulseReportReason>("inappropriate_content");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fr = language === "FR";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await reportCommunityPost(post.id, reason, description);
      setMessage(fr ? "Signalement envoyé. Merci." : "Report submitted. Thank you.");
      setOpen(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "already_reported"
        ? (fr ? "Tu as déjà signalé cette publication." : "You have already reported this post.")
        : (fr ? "Impossible d'envoyer le signalement." : "Could not submit the report."));
    } finally { setBusy(false); }
  };
  return <div className="community-report">
    {!open ? <button type="button" className="community-comments-toggle" onClick={() => setOpen(true)}>{fr ? "Signaler" : "Report"}</button> :
      <form className="community-comment-form" onSubmit={submit}>
        <select value={reason} onChange={(event) => setReason(event.target.value as FutPulseReportReason)} aria-label={fr ? "Motif du signalement" : "Report reason"}>
          <option value="spam">{fr ? "Spam" : "Spam"}</option>
          <option value="harassment">{fr ? "Harcèlement" : "Harassment"}</option>
          <option value="hate_speech">{fr ? "Discours haineux" : "Hate speech"}</option>
          <option value="false_information">{fr ? "Fausse information" : "False information"}</option>
          <option value="inappropriate_content">{fr ? "Contenu inapproprié" : "Inappropriate content"}</option>
          <option value="other">{fr ? "Autre" : "Other"}</option>
        </select>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder={fr ? "Précisions (facultatif)" : "Details (optional)"} />
        <div><button className="account-submit" type="submit" disabled={busy}>{busy ? (fr ? "Envoi…" : "Sending…") : (fr ? "Envoyer le signalement" : "Submit report")}</button><button type="button" className="account-secondary" onClick={() => setOpen(false)}>{fr ? "Annuler" : "Cancel"}</button></div>
      </form>}
    {message && <small role="status">{message}</small>}
  </div>;
}

function AdminReportsQueue({ language }: { language: Language }) {
  const [reports, setReports] = useState<FutPulseModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const fr = language === "FR";
  const refresh = async () => setReports(await getAdminReports());
  useEffect(() => { refresh().catch(() => setMessage(fr ? "Impossible de charger les signalements." : "Could not load reports.")).finally(() => setLoading(false)); }, []);
  const act = async (report: FutPulseModerationReport, action: "dismiss" | "delete_post") => {
    const prompt = action === "delete_post"
      ? (fr ? "Supprimer définitivement cette publication ?" : "Permanently delete this post?")
      : (fr ? "Classer ce signalement sans supprimer la publication ?" : "Dismiss this report without deleting the post?");
    if (!window.confirm(prompt)) return;
    setBusyId(report.id); setMessage("");
    try { await reviewAdminReport(report.id, action); await refresh(); }
    catch { setMessage(fr ? "Action impossible. Réessaie." : "Action failed. Try again."); }
    finally { setBusyId(""); }
  };
  const reasonLabels: Record<FutPulseReportReason, string> = {
    spam: "Spam", harassment: fr ? "Harcèlement" : "Harassment", hate_speech: fr ? "Discours haineux" : "Hate speech",
    false_information: fr ? "Fausse information" : "False information",
    inappropriate_content: fr ? "Contenu inapproprié" : "Inappropriate content", other: fr ? "Autre" : "Other"
  };
  return <div className="admin-reports">
    <div className="section-heading"><div><div className="eyebrow">MODERATION</div><h3>{fr ? "Signalements en attente" : "Pending reports"} ({reports.length})</h3></div><button type="button" className="account-secondary" onClick={() => void refresh()}>{fr ? "Actualiser" : "Refresh"}</button></div>
    {loading ? <p className="community-status">{fr ? "Chargement…" : "Loading…"}</p> : reports.length === 0 ? <p className="community-status">{fr ? "Aucun signalement en attente." : "No pending reports."}</p> :
      reports.map((report) => <article className="community-post" key={report.id}>
        <div className="community-post-head"><strong>{fr ? "Signalé par" : "Reported by"} {report.reporterName}</strong><small>{new Date(report.createdAt).toLocaleString(fr ? "fr-FR" : "en-GB")}</small></div>
        <p><strong>{fr ? "Auteur :" : "Author:"}</strong> {report.postAuthorName}</p>
        <p><strong>{fr ? "Motif :" : "Reason:"}</strong> {reasonLabels[report.reason]}</p>
        {report.description && <p>{report.description}</p>}
        <blockquote>{report.postContent}</blockquote>
        <div className="community-composer-meta"><button type="button" className="account-secondary" disabled={busyId === report.id} onClick={() => void act(report, "dismiss")}>{fr ? "Ignorer le signalement" : "Dismiss report"}</button><button type="button" className="account-submit" disabled={busyId === report.id} onClick={() => void act(report, "delete_post")}>{fr ? "Supprimer la publication" : "Delete post"}</button></div>
      </article>)}
    {message && <p className="account-error" role="alert">{message}</p>}
  </div>;
}

function CommunityPage({ language }: { language: Language }) {
  const [posts, setPosts] = useState<FutPulsePost[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<FutPulsePostCategory>("opinion");
  const [matchLabel, setMatchLabel] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fr = language === "FR";

  const refresh = async () => {
    try {
      const current = await getCurrentUser();
      setSignedIn(Boolean(current));
      if (!current) { setPosts([]); setStatus("ready"); return; }
      const result = await getCommunityFeed();
      setPosts(result);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const post = await createCommunityPost(content, category, matchLabel);
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
      setContent("");
      setMatchLabel("");
      setMessage(fr ? "Publication partagée." : "Post published.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "not_authenticated"
        ? (fr ? "Connecte-toi pour publier." : "Sign in to publish.")
        : (fr ? "La publication n'a pas pu être envoyée. Réessaie." : "Could not publish. Please try again."));
    } finally { setBusy(false); }
  };

  const categoryName = (value: FutPulsePostCategory) => value === "opinion"
    ? (fr ? "Opinion" : "Opinion")
    : value === "analysis" ? (fr ? "Analyse" : "Analysis") : (fr ? "Actualité" : "News");

  return <section className="page-section community-page">
    <div className="page-heading"><div className="eyebrow">FUTPULSE COMMUNITY</div><h1>{fr ? "À la une" : "Community"}</h1><p>{fr ? "Les idées et les analyses des supporters de football." : "Ideas and analysis from football fans."}</p></div>
    {signedIn === false && <div className="empty-state">{fr ? "Connecte-toi depuis ton Profil pour publier et suivre les publications de la communauté." : "Sign in from your Profile to publish and follow community posts."}</div>}
    {signedIn && <form className="community-composer" onSubmit={publish}>
      <label>{fr ? "Ta publication" : "Your post"}
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} rows={4} placeholder={fr ? "Que penses-tu de l'actualité du football ?" : "What do you think about football today?"} required />
      </label>
      <div className="community-composer-meta">
        <select value={category} onChange={(event) => setCategory(event.target.value as FutPulsePostCategory)} aria-label={fr ? "Catégorie" : "Category"}>
          <option value="opinion">{fr ? "Opinion" : "Opinion"}</option>
          <option value="analysis">{fr ? "Analyse" : "Analysis"}</option>
          <option value="news">{fr ? "Actualité" : "News"}</option>
        </select>
        <input value={matchLabel} onChange={(event) => setMatchLabel(event.target.value)} maxLength={100} placeholder={fr ? "Match associé (facultatif)" : "Related match (optional)"} />
        <span>{content.length}/500</span>
        <button className="account-submit" type="submit" disabled={busy || !content.trim()}>{busy ? (fr ? "Publication…" : "Publishing…") : (fr ? "Publier" : "Publish")}</button>
      </div>
      {message && <p className="account-message" role="status">{message}</p>}
    </form>}
    {status === "loading" && <p className="community-status">{fr ? "Chargement du fil…" : "Loading feed…"}</p>}
    {status === "error" && <div className="empty-state">{fr ? "Le fil d'actualité est momentanément indisponible." : "The feed is temporarily unavailable."}<button className="account-secondary" onClick={() => { setStatus("loading"); void refresh(); }}>{fr ? "Réessayer" : "Retry"}</button></div>}
    {status === "ready" && signedIn && posts.length === 0 && <div className="empty-state">{fr ? "Aucune publication pour le moment. Tu peux être le premier à partager une analyse !" : "No posts yet. Be the first to share your analysis!"}</div>}
    <div className="community-post-list">
      {posts.map((post) => <article className="community-post" key={post.id}>
        <div className="community-post-head">
          <div className="community-post-avatar">{post.authorAvatar ? <img src={post.authorAvatar} alt="" /> : post.authorName.slice(0, 2).toUpperCase()}</div>
          <div><strong>{post.authorName}</strong><small>{new Date(post.createdAt * 1000).toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>
          <span className="community-category">{categoryName(post.category)}</span>
        </div>
        {post.matchLabel && <div className="community-match-label">⚽ {post.matchLabel}</div>}
        <p>{post.content}</p>
        <PostReactions post={post} language={language} />
        <PostComments post={post} language={language} />
        <PostReport post={post} language={language} />
      </article>)}
    </div>
  </section>;
}


function CommunityDiscoveryPage({ language }: { language: Language }) {
  const [members, setMembers] = useState<FutPulseCommunityMember[]>([]);
  const [posts, setPosts] = useState<FutPulsePost[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | FutPulsePostCategory>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [memberSearch, setMemberSearch] = useState("");
  const fr = language === "FR";

  const refresh = async () => {
    try {
      const [result, communityPosts, viewer] = await Promise.all([
        getCommunityMembers(),
        getPublicCommunityPosts(),
        getCurrentUser()
      ]);
      setMembers(result);
      setPosts(communityPosts);
      setViewerId(viewer?.id ?? "");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const toggleFollow = async (member: FutPulseCommunityMember) => {
    if (busyId) return;
    setBusyId(member.id);
    setMessage("");
    try {
      const result = member.isFollowing
        ? await unfollowUser(member.id)
        : await followUser(member.id);
      setMembers((current) => current.map((item) => item.id === member.id
        ? { ...item, isFollowing: result.isFollowing, followerCount: result.followerCount }
        : item));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "not_authenticated"
        ? (fr ? "Connecte-toi pour suivre un membre." : "Sign in to follow a member.")
        : (fr ? "Impossible de modifier cet abonnement." : "Could not update this follow."));
    } finally {
      setBusyId("");
    }
  };

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return posts
      .filter((post) => categoryFilter === "all" || post.category === categoryFilter)
      .filter((post) => !term || [post.authorName, post.content, post.matchLabel ?? ""].some((value) => value.toLocaleLowerCase().includes(term)))
      .sort((a, b) => sortOrder === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
  }, [posts, search, categoryFilter, sortOrder]);

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLocaleLowerCase();
    return members.filter((member) => !term || [member.displayName, member.bio].some((value) => value.toLocaleLowerCase().includes(term)));
  }, [members, memberSearch]);

  return <section className="page-section community-page">
    <div className="page-heading">
      <div className="eyebrow">FUTPULSE COMMUNITY</div>
      <h1>{fr ? "Communauté" : "Community"}</h1>
      <p>{fr ? "Découvre les supporters, recherche des membres et explore leurs publications." : "Discover supporters, search for members and explore their posts."}</p>
    </div>
    {message && <p className="account-message" role="status">{message}</p>}
    {status === "loading" && <p className="community-status">{fr ? "Chargement des membres…" : "Loading members…"}</p>}
    {status === "error" && <div className="empty-state">
      {fr ? "La liste des membres est momentanément indisponible." : "The member list is temporarily unavailable."}
      <button className="account-secondary" onClick={() => { setStatus("loading"); void refresh(); }}>{fr ? "Réessayer" : "Retry"}</button>
    </div>}
    <div className="section-heading compact-heading"><div><div className="eyebrow">{fr ? "LE FIL PUBLIC" : "PUBLIC FEED"}</div><h2>{fr ? "Publications récentes" : "Recent posts"}</h2></div></div>
    <div className="match-filters community-filters">
      <input className="profile-edit-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={fr ? "Rechercher une publication, un auteur, un match…" : "Search posts, authors or matches…"} aria-label={fr ? "Rechercher dans les publications" : "Search posts"} />
      <select className="competition-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | FutPulsePostCategory)} aria-label={fr ? "Filtrer par catégorie" : "Filter by category"}>
        <option value="all">{fr ? "Toutes les catégories" : "All categories"}</option>
        <option value="news">{fr ? "Actualités" : "News"}</option>
        <option value="analysis">{fr ? "Analyses" : "Analysis"}</option>
        <option value="opinion">{fr ? "Opinions" : "Opinions"}</option>
      </select>
      <select className="competition-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")} aria-label={fr ? "Trier les publications" : "Sort posts"}>
        <option value="newest">{fr ? "Plus récentes" : "Newest first"}</option>
        <option value="oldest">{fr ? "Plus anciennes" : "Oldest first"}</option>
      </select>
    </div>
    {status === "ready" && filteredPosts.length === 0 && <div className="empty-state">{posts.length === 0 ? (fr ? "Aucune publication publique pour le moment." : "No public posts yet.") : (fr ? "Aucune publication ne correspond à ta recherche ou à ce filtre." : "No posts match your search or filter.")}</div>}
    <div className="community-post-list">
      {filteredPosts.map((post) => <article className="community-post" key={post.id}>
        <div className="community-post-head">
          <div className="community-post-avatar">{post.authorAvatar ? <img src={post.authorAvatar} alt="" /> : post.authorName.slice(0, 2).toUpperCase()}</div>
          <div><strong>{post.authorName}</strong><small>{new Date(post.createdAt * 1000).toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>
          <span className="community-category">{post.category === "opinion" ? "Opinion" : post.category === "analysis" ? (fr ? "Analyse" : "Analysis") : (fr ? "Actualité" : "News")}</span>
        </div>
        {post.matchLabel && <div className="community-match-label">⚽ {post.matchLabel}</div>}
        <p>{post.content}</p>
        <PostReactions post={post} language={language} />
        <PostComments post={post} language={language} />
        {viewerId && post.authorId !== viewerId && <PostReport post={post} language={language} />}
      </article>)}
    </div>
    <div className="section-heading compact-heading"><div><div className="eyebrow">{fr ? "MEMBRES" : "MEMBERS"}</div><h2>{fr ? "Découvrir les supporters" : "Discover members"}</h2></div></div>
    <div className="match-filters community-filters">
      <input className="profile-edit-input" type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder={fr ? "Rechercher un membre…" : "Search members…"} aria-label={fr ? "Rechercher un membre" : "Search members"} />
    </div>
    {status === "ready" && filteredMembers.length === 0 && <div className="empty-state">{members.length === 0 ? (fr ? "Aucun profil public pour le moment." : "No public profiles yet.") : (fr ? "Aucun membre ne correspond à ta recherche." : "No members match your search.")}</div>}
    <div className="community-post-list">
      {filteredMembers.map((member) => <article className="community-post" key={member.id}>
        <div className="community-post-head">
          <div className="community-post-avatar">{member.avatarData ? <img src={member.avatarData} alt="" /> : member.displayName.slice(0, 2).toUpperCase()}</div>
          <div><strong>{member.displayName}</strong><small>{member.followerCount} {fr ? "abonné(s)" : "followers"} · {member.postCount} {fr ? "publication(s)" : "posts"}</small></div>
        </div>
        <p>{member.bio || (fr ? "Passionné(e) de football." : "Football enthusiast.")}</p>
        <div className="community-composer-meta">
          <a className="account-secondary" href={`/profile/${member.id}`}>{fr ? "Voir le profil" : "View profile"} ↗</a>
          <button className="account-submit" type="button" disabled={busyId === member.id} onClick={() => void toggleFollow(member)}>
            {busyId === member.id ? (fr ? "Patiente…" : "Please wait…") : member.isFollowing ? (fr ? "Ne plus suivre" : "Unfollow") : (fr ? "Suivre" : "Follow")}
          </button>
        </div>
      </article>)}
    </div>
  </section>;
}

function ProfileAccount({ language }: { language: Language }) {
  const [user, setUser] = useState<FutPulseUser | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [editing, setEditing] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState("");
  const [profilePublic, setProfilePublic] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("resetToken");
    if (token) { setResetToken(token); setMode("reset"); }
    getCurrentUser().then((current) => {
      setUser(current);
      if (current) { setProfileName(current.displayName); setAvatarData(current.avatarData ?? null); setProfileBio(current.bio ?? ""); setProfilePublic(current.profilePublic ?? false); }
    }).catch(() => setUser(null));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "register") {
        const created = await registerAccount(displayName, email, password);
        setUser(created); setProfileName(created.displayName); setAvatarData(created.avatarData ?? null); setProfileBio(created.bio ?? ""); setProfilePublic(created.profilePublic ?? false);
        setPassword("");
      } else if (mode === "login") {
        const signedIn = await loginAccount(email, password);
        setUser(signedIn); setProfileName(signedIn.displayName); setAvatarData(signedIn.avatarData ?? null); setProfileBio(signedIn.bio ?? ""); setProfilePublic(signedIn.profilePublic ?? false);
        setPassword("");
      } else if (mode === "forgot") {
        await requestPasswordReset(email);
        setMessage(language === "FR" ? "Si cette adresse possède un compte, un lien de réinitialisation a été envoyé." : "If this address has an account, a reset link has been sent.");
      } else {
        await resetAccountPassword(resetToken, password);
        setMode("login"); setPassword(""); setResetToken("");
        window.history.replaceState({}, "", window.location.pathname);
        setMessage(language === "FR" ? "Mot de passe modifié. Tu peux maintenant te connecter." : "Password updated. You can now sign in.");
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "auth_request_failed";
      const messages: Record<string, string> = {
        invalid_credentials: language === "FR" ? "Adresse e-mail ou mot de passe incorrect." : "Incorrect email or password.",
        account_already_exists: language === "FR" ? "Un compte existe déjà avec cette adresse." : "An account already exists with this email.",
        password_reset_email_unavailable: language === "FR" ? "La récupération par e-mail sera disponible lorsque le domaine FutPulse sera vérifié." : "Email recovery will be available once the FutPulse domain is verified.",
        reset_email_not_sent: language === "FR" ? "Le lien de réinitialisation n'a pas pu être envoyé." : "The reset email could not be sent.",
        invalid_or_expired_token: language === "FR" ? "Ce lien est invalide ou a expiré." : "This link is invalid or has expired.",
        password_must_be_10_to_128_characters: language === "FR" ? "Le mot de passe doit contenir entre 10 et 128 caractères." : "Password must be between 10 and 128 characters."
      };
      setError(messages[code] ?? (language === "FR" ? "Une erreur est survenue. Réessaie plus tard." : "Something went wrong. Please try again."));
    } finally { setBusy(false); }
  };

  const saveProfile = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await updateAccountProfile(profileName, avatarData ?? "", profileBio, profilePublic);
      setUser(updated); setProfileName(updated.displayName); setAvatarData(updated.avatarData ?? null); setProfileBio(updated.bio ?? ""); setProfilePublic(updated.profilePublic ?? false);
      setEditing(false);
      setMessage(fr ? "Ton profil a été mis à jour." : "Your profile has been updated.");
    } catch (err) {
      const code = err instanceof Error ? err.message : "profile_update_failed";
      setError(code === "avatar_too_large"
        ? (fr ? "La photo est trop volumineuse. Choisis une image plus légère." : "The photo is too large. Choose a smaller image.")
        : code === "invalid_avatar"
          ? (fr ? "Format de photo invalide. Utilise JPEG, PNG ou WebP." : "Invalid photo format. Use JPEG, PNG or WebP.")
          : (fr ? "La mise à jour a échoué. Réessaie." : "Update failed. Please try again."));
    } finally { setBusy(false); }
  };

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(fr ? "Choisis une image JPEG, PNG ou WebP." : "Choose a JPEG, PNG or WebP image.");
      return;
    }
    const image = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 400 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) { setError(fr ? "Impossible de traiter cette image." : "Could not process this image."); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL("image/webp", 0.78);
        if (result.length > 200000) { setError(fr ? "Cette image reste trop volumineuse. Essaie une autre photo." : "This image is still too large. Try another photo."); return; }
        setAvatarData(result); setError(""); setMessage("");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const signOut = async () => {
    setBusy(true); setError("");
    try { await logoutAccount(); setUser(null); setAvatarData(null); setEditing(false); setMessage(language === "FR" ? "Tu es déconnecté." : "You are signed out."); }
    catch { setError(language === "FR" ? "La déconnexion a échoué." : "Sign out failed."); }
    finally { setBusy(false); }
  };

  const fr = language === "FR";
  const initials = (user?.displayName ?? "FP").slice(0, 2).toUpperCase();
  return <section className="page-section profile-page account-page">
    <div className="profile-avatar">{user?.avatarData ? <img src={user.avatarData} alt={fr ? "Photo de profil" : "Profile photo"} /> : initials}</div>
    <div className="eyebrow">YOUR SPACE</div>
    <h1>{fr ? "Ton compte FutPulse" : "Your FutPulse account"}</h1>
    {user ? <div className="account-card">
      {editing ? <>
        <h2>{fr ? "Modifier ton profil" : "Edit your profile"}</h2>
        <label className="profile-edit-label">{fr ? "Nom affiché" : "Display name"}
          <input className="profile-edit-input" value={profileName} minLength={2} maxLength={70} onChange={(event) => setProfileName(event.target.value)} />
        </label>
        <label className="profile-edit-label">{fr ? "Photo de profil" : "Profile photo"}
          <input className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
        </label>
        <label className="profile-edit-label">{fr ? "Biographie (280 caractères maximum)" : "Bio (280 characters maximum)"}
          <textarea className="profile-edit-input profile-bio-input" value={profileBio} maxLength={280} rows={4} onChange={(event) => setProfileBio(event.target.value)} placeholder={fr ? "Présente-toi aux autres supporters…" : "Introduce yourself to other fans…"} />
        </label>
        <label className="profile-public-toggle">
          <input type="checkbox" checked={profilePublic} onChange={(event) => setProfilePublic(event.target.checked)} />
          <span><strong>{fr ? "Rendre mon profil public" : "Make my profile public"}</strong><small>{fr ? "Ton nom, ta photo et ta biographie seront visibles par toute personne disposant du lien." : "Your name, photo and bio will be visible to anyone with the link."}</small></span>
        </label>
        <p className="account-hint">{fr ? "JPEG, PNG ou WebP. La photo sera redimensionnée automatiquement (maximum 150 Ko)." : "JPEG, PNG or WebP. The photo will be resized automatically (150 KB maximum)."}</p>
        <div className="profile-edit-actions">
          <button className="account-submit" onClick={saveProfile} disabled={busy || profileName.trim().length < 2}>{busy ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer" : "Save changes")}</button>
          <button className="account-secondary" onClick={() => { setEditing(false); setProfileName(user.displayName); setAvatarData(user.avatarData ?? null); setProfileBio(user.bio ?? ""); setProfilePublic(user.profilePublic ?? false); setError(""); }}> {fr ? "Annuler" : "Cancel"} </button>
        </div>
      </> : <>
        <h2>{user.displayName}</h2><p>{user.email}</p>
        <span className={user.profilePublic ? "account-verified" : "account-unverified"}>{user.profilePublic ? (fr ? "Profil public" : "Public profile") : (fr ? "Profil privé" : "Private profile")}</span>
        {user.profilePublic && <div className="public-profile-share"><p>{fr ? "Ton profil peut être partagé avec ce lien :" : "Your profile can be shared with this link:"}</p><code>{window.location.origin}/profile/{user.id}</code><button className="account-secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/profile/${user.id}`).then(() => setMessage(fr ? "Lien copié." : "Link copied.")).catch(() => setError(fr ? "Copie impossible sur cet appareil." : "Could not copy on this device."))}>{fr ? "Copier le lien public" : "Copy public link"}</button></div>}
        <span className={user.emailVerified ? "account-verified" : "account-unverified"}>{user.emailVerified ? (fr ? "E-mail vérifié" : "Email verified") : (fr ? "E-mail non vérifié" : "Email not verified")}</span>
        {!user.emailVerified && <p className="account-hint">{fr ? "Ton compte est actif. La vérification de l'adresse et la récupération du mot de passe par e-mail seront activées dès que FutPulse disposera d'un domaine vérifié. Utilise une adresse e-mail valide." : "Your account is active. Email verification and password recovery will be enabled once FutPulse has a verified domain. Use a valid email address."}</p>}
        <button className="account-submit" onClick={() => { setEditing(true); setProfileName(user.displayName); setAvatarData(user.avatarData ?? null); setError(""); setMessage(""); }}>{fr ? "Modifier mon profil" : "Edit my profile"}</button>
        <button className="account-secondary" onClick={signOut} disabled={busy}>{fr ? "Se déconnecter" : "Sign out"}</button>
      </>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
    </div> : <>
      <p>{fr ? "Connecte-toi pour retrouver ton espace personnel." : "Sign in to access your personal space."}</p>
      {mode !== "reset" && <div className="account-mode-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>{fr ? "Connexion" : "Sign in"}</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>{fr ? "Créer un compte" : "Create account"}</button>
      </div>}
      <form className="account-form" onSubmit={submit}>
        {mode === "register" && <label>{fr ? "Nom affiché" : "Display name"}<input required minLength={2} maxLength={70} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
        {mode !== "reset" && <label>{fr ? "Adresse e-mail" : "Email address"}<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {(mode === "login" || mode === "register" || mode === "reset") && <label>{fr ? "Mot de passe" : "Password"}<input required type="password" minLength={10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
        {mode === "forgot" && <p className="account-hint">{fr ? "La récupération par e-mail est temporairement indisponible. Elle sera activée après la vérification du domaine FutPulse." : "Email recovery is temporarily unavailable. It will be enabled after the FutPulse domain is verified."}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        {message && <p className="account-message" role="status">{message}</p>}
        <button className="account-submit" type="submit" disabled={busy}>{busy ? (fr ? "Patiente…" : "Please wait…") : mode === "register" ? (fr ? "Créer mon compte" : "Create account") : mode === "forgot" ? (fr ? "Envoyer le lien" : "Send link") : mode === "reset" ? (fr ? "Modifier le mot de passe" : "Update password") : (fr ? "Se connecter" : "Sign in")}</button>
      </form>
      {mode === "login" && <button className="account-link" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>{fr ? "Mot de passe oublié ?" : "Forgot password?"}</button>}
      {(mode === "forgot" || mode === "reset") && <button className="account-link" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>{fr ? "Retour à la connexion" : "Back to sign in"}</button>}
    </>}
    {user && <StatsDashboard language={language} />}
    {user && <AdminDashboard language={language} />}
    {user && <MyPosts language={language} />}
    <div className="account-notice">{fr ? "Tes informations sont protégées. Ton mot de passe n'est jamais stocké en clair." : "Your information is protected. Your password is never stored in plain text."}</div>
  </section>;
}

function AdminDashboard({ language }: { language: Language }) {
  const [status, setStatus] = useState<{ isAdmin: boolean; bootstrapAvailable: boolean } | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAdminStats>> | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fr = language === "FR";

  const refresh = async () => {
    const next = await getAdminStatus();
    setStatus(next);
    if (next.isAdmin) setStats(await getAdminStats());
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminStatus()]).then(async ([next]) => {
      if (cancelled) return;
      setStatus(next);
      if (next.isAdmin) {
        const result = await getAdminStats();
        if (!cancelled) setStats(result);
      }
    }).catch(() => {
      if (!cancelled) setError(fr ? "Espace administration indisponible." : "Admin area unavailable.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const activate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await bootstrapAdmin(token);
      setToken("");
      await refresh();
      setMessage(fr ? "Ton compte est maintenant administrateur." : "Your account is now an administrator.");
    } catch (err) {
      const code = err instanceof Error ? err.message : "admin_activation_failed";
      setError(code === "invalid_bootstrap_token"
        ? (fr ? "Code d'activation incorrect." : "Incorrect activation code.")
        : code === "admin_already_configured"
          ? (fr ? "Un administrateur est déjà configuré." : "An administrator is already configured.")
          : (fr ? "Activation impossible. Réessaie." : "Activation failed. Please try again."));
    } finally { setBusy(false); }
  };

  if (loading || !status || (!status.isAdmin && !status.bootstrapAvailable && !error)) return null;

  return <section className="admin-dashboard">
    <div className="section-heading"><div><div className="eyebrow">FUTPULSE CONTROL</div><h2>{fr ? "Administration" : "Administration"}</h2></div></div>
    {status.isAdmin && stats ? <>
      <p className="admin-access-label">{fr ? "Accès administrateur actif" : "Administrator access active"}</p>
      <div className="stats-grid">
        {[
          { label: fr ? "Utilisateurs" : "Users", value: stats.users },
          { label: fr ? "Profils publics" : "Public profiles", value: stats.publicProfiles },
          { label: fr ? "Publications" : "Posts", value: stats.posts },
          { label: "J’aime", value: stats.likes },          { label: fr ? "Commentaires" : "Comments", value: stats.comments },
          { label: fr ? "Abonnements" : "Follows", value: stats.follows }
        ].map((item) => <article className="stats-card" key={item.label}><small>{item.label}</small><strong>{item.value.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></article>)}
      </div>
      <div className="stats-period">
        <div><span>{fr ? "Nouveaux utilisateurs (30 jours)" : "New users (30 days)"}</span><strong>{stats.newUsersLast30Days.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></div>
        <div><span>{fr ? "Publications (30 jours)" : "Posts (30 days)"}</span><strong>{stats.postsLast30Days.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></div>
        <div><span>{fr ? "Interactions (30 jours)" : "Interactions (30 days)"}</span><strong>{stats.interactionsLast30Days.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></div>
      </div>
      <AdminManualFixtures language={language} />
      <AdminReportsQueue language={language} />
    </> : status.bootstrapAvailable ? <div className="account-card admin-bootstrap-card">
      <h3>{fr ? "Activer le premier administrateur" : "Activate the first administrator"}</h3>
      <p>{fr ? "Cette activation est réservée au propriétaire de FutPulse. Saisis le code temporaire configuré sur le Worker Cloudflare." : "This activation is reserved for the FutPulse owner. Enter the temporary code configured in the Cloudflare Worker."}</p>
      <form className="admin-bootstrap-form" onSubmit={activate}>
        <label>{fr ? "Code d’activation" : "Activation code"}
          <input type="password" autoComplete="off" required minLength={32} value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <button className="account-submit" type="submit" disabled={busy || token.length < 32}>{busy ? (fr ? "Activation…" : "Activating…") : (fr ? "Activer mon compte administrateur" : "Activate my administrator account")}</button>
      </form>
    </div> : null}
    {error && <p className="account-error" role="alert">{error}</p>}
    {message && <p className="account-message" role="status">{message}</p>}
  </section>;
}

function AdminManualFixtures({ language }: { language: Language }) {
  const fr = language === "FR";
  const [fixtures, setFixtures] = useState<FutPulseManualFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [competitionName, setCompetitionName] = useState("Ligue 1 Sénégal");
  const [season, setSeason] = useState("2026-2027");
  const [roundLabel, setRoundLabel] = useState("");
  const [kickoffAt, setKickoffAt] = useState("");
  const [homeTeamName, setHomeTeamName] = useState("");
  const [awayTeamName, setAwayTeamName] = useState("");
  const [venue, setVenue] = useState("");

  const refresh = async () => setFixtures(await getAdminManualFixtures());
  useEffect(() => {
    let cancelled = false;
    getAdminManualFixtures().then((items) => { if (!cancelled) setFixtures(items); })
      .catch(() => { if (!cancelled) setError(fr ? "Impossible de charger les rencontres." : "Could not load fixtures."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const createFixture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await createAdminManualFixture({
        competitionName, season, roundLabel,
        kickoffAt: new Date(kickoffAt).toISOString(),
        homeTeamName, awayTeamName, venue
      });
      setHomeTeamName(""); setAwayTeamName(""); setVenue(""); setRoundLabel(""); setKickoffAt("");
      await refresh();
      setMessage(fr ? "Rencontre créée." : "Fixture created.");
    } catch (err) {
      setError(err instanceof Error && err.message === "invalid_fixture_data"
        ? (fr ? "Vérifie les informations de la rencontre." : "Please check the fixture details.")
        : (fr ? "Création impossible. Réessaie." : "Could not create fixture. Please retry."));
    } finally { setBusy(false); }
  };

  const updateFixture = async (event: FormEvent<HTMLFormElement>, fixtureId: string) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await updateAdminManualFixture({
        fixtureId,
        status: String(data.get("status")) as ManualFixtureStatus,
        homeScore: String(data.get("homeScore") ?? ""),
        awayScore: String(data.get("awayScore") ?? "")
      });
      await refresh();
      setMessage(fr ? "Rencontre mise à jour." : "Fixture updated.");
    } catch {
      setError(fr ? "Mise à jour impossible. Vérifie les scores." : "Update failed. Check the scores.");
    } finally { setBusy(false); }
  };

  return <section className="admin-manual-fixtures">
    <div className="section-heading"><div><div className="eyebrow">FOOTBALL DATA</div><h3>{fr ? "Gestion des rencontres manuelles" : "Manual fixture management"}</h3></div></div>
    <form className="account-form" onSubmit={createFixture}>
      <label>{fr ? "Compétition" : "Competition"}<input required maxLength={100} value={competitionName} onChange={(e) => setCompetitionName(e.target.value)} /></label>
      <label>{fr ? "Saison" : "Season"}<input required maxLength={20} value={season} onChange={(e) => setSeason(e.target.value)} /></label>
      <label>{fr ? "Journée / Tour" : "Round"}<input maxLength={50} value={roundLabel} onChange={(e) => setRoundLabel(e.target.value)} placeholder="Ex. Journée 4" /></label>
      <label>{fr ? "Date et heure" : "Date and time"}<input required type="datetime-local" value={kickoffAt} onChange={(e) => setKickoffAt(e.target.value)} /></label>
      <label>{fr ? "Équipe à domicile" : "Home team"}<input required maxLength={100} value={homeTeamName} onChange={(e) => setHomeTeamName(e.target.value)} /></label>
      <label>{fr ? "Équipe à l'extérieur" : "Away team"}<input required maxLength={100} value={awayTeamName} onChange={(e) => setAwayTeamName(e.target.value)} /></label>
      <label>{fr ? "Stade (facultatif)" : "Venue (optional)"}<input maxLength={120} value={venue} onChange={(e) => setVenue(e.target.value)} /></label>
      <button className="account-submit" type="submit" disabled={busy}>{busy ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Ajouter la rencontre" : "Add fixture")}</button>
    </form>
    {loading ? <p className="community-status">{fr ? "Chargement des rencontres…" : "Loading fixtures…"}</p> : fixtures.length === 0
      ? <p className="community-status">{fr ? "Aucune rencontre manuelle pour le moment." : "No manual fixtures yet."}</p>
      : <div className="admin-fixture-list">{fixtures.map((fixture) => <form className="admin-fixture-row" key={fixture.id} onSubmit={(event) => updateFixture(event, fixture.id)}>
        <div><strong>{fixture.homeTeamName} – {fixture.awayTeamName}</strong><small>{fixture.competitionName} · {fixture.season}{fixture.roundLabel ? " · " + fixture.roundLabel : ""}</small><small>{new Date(fixture.kickoffAt).toLocaleString(fr ? "fr-FR" : "en-GB")}</small></div>
        <label>{fr ? "Statut" : "Status"}<select name="status" defaultValue={fixture.status}><option value="scheduled">{fr ? "Programmé" : "Scheduled"}</option><option value="live">{fr ? "En direct" : "Live"}</option><option value="finished">{fr ? "Terminé" : "Finished"}</option><option value="postponed">{fr ? "Reporté" : "Postponed"}</option><option value="cancelled">{fr ? "Annulé" : "Cancelled"}</option></select></label>
        <label>{fr ? "Score domicile" : "Home score"}<input name="homeScore" type="number" min="0" max="99" defaultValue={fixture.homeScore ?? ""} /></label>
        <label>{fr ? "Score extérieur" : "Away score"}<input name="awayScore" type="number" min="0" max="99" defaultValue={fixture.awayScore ?? ""} /></label>
        <button className="account-secondary" type="submit" disabled={busy}>{fr ? "Enregistrer" : "Save"}</button>
      </form>)}</div>}
    {error && <p className="account-error" role="alert">{error}</p>}
    {message && <p className="account-message" role="status">{message}</p>}
  </section>;
}

function StatsDashboard({ language }: { language: Language }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getMyStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fr = language === "FR";

  useEffect(() => {
    let cancelled = false;
    getMyStats().then((result) => {
      if (!cancelled) setStats(result);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const cards = stats ? [
    { label: fr ? "Abonnés" : "Followers", value: stats.followers, icon: "♙" },
    { label: fr ? "Abonnements" : "Following", value: stats.following, icon: "↗" },
    { label: fr ? "Publications" : "Posts", value: stats.posts, icon: "▤" },
    { label: fr ? "J’aime reçus" : "Likes received", value: stats.likesReceived, icon: "♥" },
    { label: fr ? "Commentaires reçus" : "Comments received", value: stats.commentsReceived, icon: "▢" },
    { label: fr ? "Interactions totales" : "Total interactions", value: stats.interactionsReceived, icon: "✦" }
  ] : [];

  return <section className="stats-dashboard">
    <div className="section-heading"><div><div className="eyebrow">YOUR PERFORMANCE</div><h2>{fr ? "Mes statistiques" : "My statistics"}</h2></div></div>
    {loading && <p className="community-status">{fr ? "Chargement des statistiques…" : "Loading statistics…"}</p>}
    {!loading && error && <p className="community-status">{fr ? "Les statistiques sont momentanément indisponibles." : "Statistics are temporarily unavailable."}</p>}
    {!loading && !error && stats && <>
      <div className="stats-grid">
        {cards.map((card) => <article className="stats-card" key={card.label}>
          <span aria-hidden="true">{card.icon}</span>
          <small>{card.label}</small>
          <strong>{card.value.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong>
        </article>)}
      </div>
      <div className="stats-period">
        <div><span>{fr ? "Interactions sur les 30 derniers jours" : "Interactions in the last 30 days"}</span><strong>{stats.interactionsLast30Days.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></div>
        <small>{fr ? "Total des J’aime et commentaires reçus sur tes publications." : "Total likes and comments received on your posts."}</small>
      </div>
    </>}
  </section>;
}

function MyPosts({ language }: { language: Language }) {
  const [posts, setPosts] = useState<FutPulsePost[]>([]);
  const [loading, setLoading] = useState(true);
  const fr = language === "FR";
  useEffect(() => {
    getMyPosts().then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  }, []);
  return <section className="my-posts-section">
    <div className="section-heading"><div><div className="eyebrow">YOUR VOICE</div><h2>{fr ? "Mes publications" : "My posts"}</h2></div></div>
    {loading ? <p className="community-status">{fr ? "Chargement…" : "Loading…"}</p> : posts.length === 0
      ? <p className="community-status">{fr ? "Tu n'as pas encore publié." : "You have not posted yet."}</p>
      : posts.map((post) => <article className="community-post" key={post.id}>
        <div className="community-post-head"><div className="community-post-avatar">{post.authorAvatar ? <img src={post.authorAvatar} alt="" /> : post.authorName.slice(0,2).toUpperCase()}</div><div><strong>{post.authorName}</strong><small>{new Date(post.createdAt * 1000).toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div><span className="community-category">{post.category === "analysis" ? (fr ? "Analyse" : "Analysis") : post.category === "news" ? (fr ? "Actualité" : "News") : "Opinion"}</span></div>
        {post.matchLabel && <div className="community-match-label">⚽ {post.matchLabel}</div>}<p>{post.content}</p><PostReactions post={post} language={language} /><PostComments post={post} language={language} />
      </article>)}
  </section>;
}

function PublicProfilePage({ userId, language }: { userId: string; language: Language }) {
  const [profile, setProfile] = useState<FutPulsePublicProfile | null>(null);
  const [posts, setPosts] = useState<FutPulsePost[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [viewer, setViewer] = useState<FutPulseUser | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState("");
  const fr = language === "FR";
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [result, current] = await Promise.all([getPublicProfile(userId), getCurrentUser()]);
        if (cancelled) return;
        setProfile(result);
        setViewer(current);
        if (current) {
          const userPosts = await getUserPosts(userId);
          if (cancelled) return;
          setPosts(userPosts);
        } else {
          setPosts([]);
        }
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [userId]);
  const toggleFollow = async () => {
    if (!profile || !viewer || followBusy) return;
    setFollowBusy(true);
    setFollowError("");
    try {
      const result = profile.isFollowing ? await unfollowUser(profile.id) : await followUser(profile.id);
      setProfile({ ...profile, ...result });
    } catch (error) {
      setFollowError(error instanceof Error ? error.message : (fr ? "Action impossible." : "Action failed."));
    } finally {
      setFollowBusy(false);
    }
  };
  const categoryName = (value: FutPulsePostCategory) => value === "opinion"
    ? "Opinion"
    : value === "analysis" ? (fr ? "Analyse" : "Analysis") : (fr ? "Actualité" : "News");
  const joined = profile?.createdAt ? new Date(profile.createdAt * 1000).toLocaleDateString(fr ? "fr-FR" : "en-GB", { month: "long", year: "numeric" }) : "";
  return <main className="app-shell public-profile-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">FP</span><span className="brand-title">FUT<span className="brand-light">PULSE</span></span></a></header>
    <section className="page-section account-page public-profile-page">
      {status === "loading" && <p>{fr ? "Chargement du profil…" : "Loading profile…"}</p>}
      {status === "error" && <><h1>{fr ? "Profil introuvable" : "Profile not found"}</h1><p>{fr ? "Ce profil n'existe pas ou son propriétaire ne l'a pas rendu public." : "This profile does not exist or its owner has not made it public."}</p></>}
      {profile && <>
        <div className="profile-avatar">{profile.avatarData ? <img src={profile.avatarData} alt={fr ? "Photo de profil" : "Profile photo"} /> : profile.displayName.slice(0, 2).toUpperCase()}</div>
        <div className="eyebrow">FUTPULSE COMMUNITY</div>
        <h1>{profile.displayName}</h1>
        <p className="public-profile-bio">{profile.bio || (fr ? "Passionné(e) de football." : "Football enthusiast.")}</p>
        <div className="public-profile-joined">{profile.followerCount} {fr ? "abonné(s)" : "follower(s)"} · {profile.followingCount} {fr ? "abonnement(s)" : "following"}</div>
        <div className="stats-grid public-profile-stats">
          <article className="stats-card"><small>{fr ? "Publications" : "Posts"}</small><strong>{profile.postCount.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></article>
          <article className="stats-card"><small>{fr ? "J’aime reçus" : "Likes received"}</small><strong>{profile.likesReceived.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></article>
          <article className="stats-card"><small>{fr ? "Commentaires reçus" : "Comments received"}</small><strong>{profile.commentsReceived.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></article>
          <article className="stats-card"><small>{fr ? "Interactions" : "Interactions"}</small><strong>{profile.interactionsReceived.toLocaleString(fr ? "fr-FR" : "en-GB")}</strong></article>
        </div>
        {viewer && viewer.id !== profile.id && <button className="account-submit" type="button" onClick={toggleFollow} disabled={followBusy}>{followBusy ? (fr ? "Patiente…" : "Please wait…") : profile.isFollowing ? (fr ? "Ne plus suivre" : "Unfollow") : (fr ? "Suivre" : "Follow")}</button>}
        {followError && <p className="account-message" role="alert">{followError}</p>}
        {joined && <p className="public-profile-joined">{fr ? "Membre depuis " : "Member since "}{joined}</p>}
        <section className="section-block public-profile-posts">
          <div className="section-heading"><div><div className="eyebrow">FUTPULSE COMMUNITY</div><h2>{fr ? "Publications" : "Posts"} ({posts.length})</h2></div></div>
          {!viewer && <p className="community-status">{fr ? "Connecte-toi pour consulter les publications de ce membre." : "Sign in to view this member's posts."}</p>}
          {viewer && posts.length === 0 && <p className="community-status">{fr ? "Aucune publication pour le moment." : "No posts yet."}</p>}
          <div className="community-post-list">
            {posts.map((post) => <article className="community-post" key={post.id}>
              <div className="community-post-head">
                <div className="community-post-avatar">{post.authorAvatar ? <img src={post.authorAvatar} alt="" /> : post.authorName.slice(0, 2).toUpperCase()}</div>
                <div><strong>{post.authorName}</strong><small>{new Date(post.createdAt * 1000).toLocaleString(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>
                <span className="community-category">{categoryName(post.category)}</span>
              </div>
              {post.matchLabel && <div className="community-match-label">⚽ {post.matchLabel}</div>}
              <p>{post.content}</p>
              <PostReactions post={post} language={language} />
              <PostComments post={post} language={language} />
              {viewer && viewer.id !== post.authorId && <PostReport post={post} language={language} />}
            </article>)}
          </div>
        </section>
      </>}
      <a className="account-link public-profile-home" href="/">{fr ? "← Retour à FutPulse" : "← Back to FutPulse"}</a>
    </section>
  </main>;
}

function MatchDetails({ match, onClose }: { match: Match; onClose: () => void }) {
  const [details, setDetails] = useState<MatchDetailsData | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeSection, setActiveSection] = useState<"resume" | "compositions" | "statistiques" | "evenements">("resume");
  const kickoff = match.kickoffAt ? new Date(match.kickoffAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) : match.time;

  useEffect(() => {
    let cancelled = false;
    if (match.source === "manual") {
      setDetails(null);
      setDetailsStatus("ready");
      return () => { cancelled = true; };
    }
    setDetailsStatus("loading");
    getMatchDetails(match.id).then((data) => {
      if (cancelled) return;
      setDetails(data);
      setDetailsStatus("ready");
    }).catch(() => {
      if (!cancelled) setDetailsStatus("error");
    });
    return () => { cancelled = true; };
  }, [match.id]);

  const lineups = details?.lineups ?? [];
  const stats = details?.statistics ?? [];
  const events = details?.events ?? [];
  const statisticTypes = [...new Set(stats.flatMap((team) => (team.statistics ?? []).map((item) => item.type ?? "")))].filter(Boolean);
  const formatValue = (value: string | number | null | undefined) => value == null ? "—" : String(value);
  const numberValue = (value: string | number | null | undefined) => {
    if (value == null) return null;
    const found = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return found ? Number(found[0]) : null;
  };
  const eventMinute = (event: MatchDetailsData["events"][number]) =>
    event.time?.elapsed == null ? "—" : `${event.time.elapsed}${event.time.extra ? "+" + event.time.extra : ""}'`;
  const eventIcon = (event: MatchDetailsData["events"][number]) => {
    const type = `${event.type ?? ""} ${event.detail ?? ""}`.toLowerCase();
    if (type.includes("goal")) return "⚽";
    if (type.includes("yellow")) return "🟨";
    if (type.includes("red")) return "🟥";
    if (type.includes("subst")) return "🔁";
    if (type.includes("var")) return "▣";
    return "•";
  };
  const getPlayerPosition = (
    entry: NonNullable<MatchDetailsData["lineups"][number]["startXI"]>[number],
    lineup: MatchDetailsData["lineups"][number],
    teamIndex: number
  ) => {
    const starters = lineup.startXI ?? [];
    const validGrid = starters.map((player) => {
      const parts = player.player?.grid?.split(":").map(Number) ?? [];
      return { player, row: parts[0], col: parts[1], valid: parts.length === 2 && parts.every((value) => Number.isFinite(value) && value > 0) };
    });
    const current = validGrid.find((item) => item.player === entry);
    let rowIndex = 0;
    let rowCount = 4;
    let colIndex = 0;
    let playersInRow = 1;

    if (current?.valid) {
      const rows = [...new Set(validGrid.filter((item) => item.valid).map((item) => item.row))].sort((a, b) => (a ?? 0) - (b ?? 0));
      const row = rows.indexOf(current.row);
      const sameRow = validGrid.filter((item) => item.valid && item.row === current.row).sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
      rowIndex = Math.max(0, row);
      rowCount = Math.max(1, rows.length);
      colIndex = sameRow.findIndex((item) => item.player === entry);
      playersInRow = sameRow.length;
    } else {
      const pos = (entry.player?.pos ?? "").toUpperCase();
      const role = pos === "G" ? 0 : pos === "D" ? 1 : pos === "M" ? 2 : 3;
      const rolePlayers = starters.filter((player) => (player.player?.pos ?? "").toUpperCase() === pos);
      rowIndex = role;
      rowCount = 4;
      colIndex = rolePlayers.indexOf(entry);
      playersInRow = rolePlayers.length;
    }

    const depth = 8 + ((rowIndex + 0.5) / rowCount) * 42;
    const top = teamIndex === 0 ? 100 - depth : depth;
    const left = ((colIndex + 0.5) / Math.max(1, playersInRow)) * 100;
    return { top: `${top}%`, left: `${left}%` };
  };
  const homeTeamName = stats[0]?.team?.name ?? lineups[0]?.team?.name ?? match.home;
  const awayTeamName = stats[1]?.team?.name ?? lineups[1]?.team?.name ?? match.away;
  const topStats = ["Ball Possession", "Total Shots", "Shots on Goal", "Shots on Target", "Expected Goals", "Corner Kicks"];
  const keyStats = statisticTypes.filter((type) => topStats.some((key) => type.toLowerCase().replace(/[_-]/g, " ").includes(key.toLowerCase()))).slice(0, 4);
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
      <div className="modal-scoreline">
        <div><span className="modal-crest">{match.home.slice(0,1)}</span><strong>{match.home}</strong></div>
        <b>{match.status === "upcoming" ? "VS" : `${match.homeScore ?? "–"} : ${match.awayScore ?? "–"}`}</b>
        <div><span className="modal-crest">{match.away.slice(0,1)}</span><strong>{match.away}</strong></div>
      </div>
      <div className="modal-kickoff">{kickoff}</div>
      {match.source === "manual" ? (
        <p className="modal-note">Rencontre saisie manuellement par l’administration. Les compositions, statistiques et événements ne sont pas encore disponibles dans le centre de match.</p>
      ) : <>
        <nav className="match-detail-tabs" aria-label="Rubriques du match">
          {tabs.map((tab) => <button key={tab.id} className={activeSection === tab.id ? "match-detail-tab active" : "match-detail-tab"} onClick={() => setActiveSection(tab.id)}>{tab.label}</button>)}
        </nav>
        {detailsStatus === "loading" && <p className="modal-note">Chargement des informations du match…</p>}
        {detailsStatus === "error" && <p className="modal-note">Impossible de charger les détails pour le moment. Réessaie dans quelques instants.</p>}
      </>}
      {detailsStatus === "ready" && details && <>
        {activeSection === "resume" && <div className="match-resume">
          <div className="resume-section-title"><h3>Temps forts</h3><span>{events.length} événement(s)</span></div>
          {!details.availability.events || events.length === 0
            ? <p className="detail-empty">Aucun temps fort disponible pour cette rencontre.</p>
            : <div className="resume-timeline">{events.map((event, index) => {
              const isHome = (event.team?.name ?? "") === homeTeamName;
              return <div className={isHome ? "resume-event home-event" : "resume-event away-event"} key={index}>
                <time>{eventMinute(event)}</time><span className="resume-event-icon">{eventIcon(event)}</span>
                <div className="resume-event-copy"><strong>{event.player?.name ?? event.detail ?? event.type ?? "Événement"}</strong><small>{event.detail && event.player?.name ? event.detail : event.type ?? ""}{event.assist?.name ? ` · Passe décisive : ${event.assist.name}` : ""}</small></div>
                <span className="resume-event-team">{isHome ? match.home : match.away}</span>
              </div>;
            })}</div>}
          {details.availability.statistics && keyStats.length > 0 && <div className="resume-key-stats">
            <div className="resume-section-title"><h3>Chiffres clés</h3><button onClick={() => setActiveSection("statistiques")}>Toutes les stats ↗</button></div>
            {keyStats.map((type) => {
              const home = stats[0]?.statistics?.find((item) => item.type === type)?.value;
              const away = stats[1]?.statistics?.find((item) => item.type === type)?.value;
              const a = numberValue(home); const b = numberValue(away);
              const total = (a ?? 0) + (b ?? 0);
              const left = total > 0 && a !== null ? a / total * 100 : 50;
              return <div className="resume-stat" key={type}>
                <div><strong>{formatValue(home)}</strong><span>{type}</span><strong>{formatValue(away)}</strong></div>
                <div className="resume-stat-bar"><i style={{ width: `${left}%` }} /><i style={{ width: `${100-left}%` }} /></div>
              </div>;
            })}
          </div>}
        </div>}

        {activeSection === "compositions" && <div className="detail-section lineup-section">
          <div className="lineup-section-heading"><div><h3>Onze de départ</h3><p>Disposition officielle des joueurs sur le terrain</p></div></div>
          {!details.availability.lineups || lineups.length === 0
            ? <p className="detail-empty">Les compositions ne sont pas encore publiées pour cette rencontre.</p>
            : <>
              <div className="lineup-team-strip">
                <div><strong>{lineups[0]?.team?.name ?? match.home}</strong><span>{lineups[0]?.formation ?? "Formation non renseignée"}</span></div>
                <b>VS</b>
                <div><strong>{lineups[1]?.team?.name ?? match.away}</strong><span>{lineups[1]?.formation ?? "Formation non renseignée"}</span></div>
              </div>
              <div className="real-pitch">
                <div className="real-pitch-area real-pitch-area-away"><div className="real-pitch-goal" /><div className="real-pitch-penalty-spot" /></div>
                <div className="real-pitch-area real-pitch-area-home"><div className="real-pitch-goal" /><div className="real-pitch-penalty-spot" /></div>
                <div className="real-pitch-centre-circle" /><div className="real-pitch-centre-spot" />
                <div className="real-pitch-halfway-line" />
                {lineups.map((lineup, teamIndex) => (lineup.startXI ?? []).map((entry, playerIndex) => {
                  const position = getPlayerPosition(entry, lineup, teamIndex);
                  return <div className={teamIndex === 0 ? "pitch-player pitch-home-player" : "pitch-player pitch-away-player"} key={entry.player?.id ?? `${teamIndex}-${playerIndex}`} style={position}>
                    <span className="pitch-player-avatar" aria-hidden="true">{(entry.player?.name ?? "J").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><b className="pitch-player-number">{entry.player?.number ?? "—"}</b><small>{entry.player?.name ?? "Joueur"}</small><em>{entry.player?.pos ?? ""}</em>
                  </div>;
                }))}
              </div>
              <div className="bench-heading"><h3>Remplaçants</h3><span>Effectif disponible</span></div>
              <div className="bench-teams">{lineups.map((lineup, teamIndex) => <div className="bench-team" key={lineup.team?.name ?? teamIndex}>
                <strong>{lineup.team?.name ?? (teamIndex === 0 ? match.home : match.away)}</strong>
                {(lineup.substitutes ?? []).length === 0 ? <p className="detail-empty">Aucun remplaçant renseigné.</p> : (lineup.substitutes ?? []).map((entry, playerIndex) => <div className="bench-player" key={entry.player?.id ?? playerIndex}>
                  <span className="bench-player-avatar" aria-hidden="true">{(entry.player?.name ?? "J").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <span className="bench-player-number">{entry.player?.number ?? "—"}</span>
                  <strong>{entry.player?.name ?? "Joueur"}</strong>
                  <small>{entry.player?.pos ?? "Poste non renseigné"}</small>
                </div>)}
              </div>)}</div>
            </>}
        </div>}

        {activeSection === "statistiques" && <div className="detail-section">
          <div className="resume-section-title"><h3>Statistiques du match</h3><span>Comparaison des deux équipes</span></div>
          {!details.availability.statistics ? <p className="detail-empty">Les statistiques ne sont pas encore disponibles.</p> : <div className="visual-statistics">
            <div className="visual-stat-head"><strong>{homeTeamName}</strong><strong>{awayTeamName}</strong></div>
            {statisticTypes.map((type) => {
              const home = stats[0]?.statistics?.find((item) => item.type === type)?.value;
              const away = stats[1]?.statistics?.find((item) => item.type === type)?.value;
              const a = numberValue(home); const b = numberValue(away); const total = (a ?? 0) + (b ?? 0);
              const left = total > 0 && a !== null ? a / total * 100 : 50;
              return <div className="visual-stat-row" key={type}>
                <div className="visual-stat-values"><strong>{formatValue(home)}</strong><span>{type}</span><strong>{formatValue(away)}</strong></div>
                <div className="visual-stat-track"><span className="visual-stat-home" style={{ width: `${left}%` }} /><span className="visual-stat-away" style={{ width: `${100-left}%` }} /></div>
              </div>;
            })}
          </div>}
        </div>}

        {activeSection === "evenements" && <div className="detail-section">
          <div className="resume-section-title"><h3>Chronologie complète</h3><span>{events.length} événement(s)</span></div>
          {!details.availability.events || events.length === 0 ? <p className="detail-empty">Aucun événement détaillé disponible pour le moment.</p> : <div className="resume-timeline">
            {events.map((event, index) => <div className="resume-event" key={index}><time>{eventMinute(event)}</time><span className="resume-event-icon">{eventIcon(event)}</span><div className="resume-event-copy"><strong>{event.player?.name ?? event.detail ?? event.type ?? "Événement"}</strong><small>{event.detail ?? event.type ?? ""}{event.assist?.name ? ` · Passe décisive : ${event.assist.name}` : ""}</small></div><span className="resume-event-team">{event.team?.name ?? ""}</span></div>)}
          </div>}
        </div>}
        <p className="detail-attribution">Données fournies par API-Football. Certaines rubriques varient selon la couverture du match.</p>
      </>}
    </section>
  </div>;
}
function MatchRow({ match, onOpen }: { match: Match; onOpen: () => void }) {
  return <div className="match-row match-row-open" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}><span className="row-competition">{match.competition}</span><strong>{match.home}</strong><span className="row-vs">—</span><strong>{match.away}</strong><span className="row-time">{match.time}</span></div>;
}

function formatNewsDate(value: string, language: Language): string {
  if (!value) return "";
  const trimmed = value.trim();
  const normalized = /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}(:\\d{2})?$/.test(trimmed)
    ? trimmed.replace(" ", "T")
    : /^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)
      ? `${trimmed}T00:00:00`
      : trimmed;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
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