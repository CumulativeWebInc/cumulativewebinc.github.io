/* CWI Label Platform — hash router + JSON-driven renderers. Vanilla JS, zero deps.
   Routes: #/ (home), #/artists, #/artist/<slug>, #/producer, #/music,
           #/clothing, #/software. Data: data/*.json. Adding an artist =
   one JSON in data/artists + entry in roster.json order. No code changes. */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var SPOT = 'https://open.spotify.com';
  var trackUrl = function (id) { return SPOT + '/track/' + id; };

  var BADGE_CLASS = { LIVE: 'live', SAMPLE: 'sample', DRAFT: 'draft', PLANNED: 'planned', NEW: 'new',
    PRE_ORDER: 'sample', WAITLIST: 'planned', DROPPING_SOON: 'planned' };
  var badge = function (status) {
    var cls = BADGE_CLASS[status] || 'planned';
    return '<span class="badge badge--' + cls + '">' + esc(status.replace(/_/g, ' ')) + '</span>';
  };

  var initials = function (name) {
    return name.split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase();
  };
  var artBlock = function (artist, kind) {
    // kind: 'card' | 'track' | 'player'
    var cls = kind === 'track' ? 'tart' : kind === 'player' ? 'part' : 'art';
    if (artist.image && artist.image !== 'placeholder') {
      return '<div class="' + cls + '"><img src="' + esc(artist.image) + '" alt="Cover art for ' + esc(artist.name) + '" loading="lazy"></div>';
    }
    return '<div class="' + cls + '" aria-hidden="true">' +
      (kind === 'card' ? '<span class="monogram">' + esc(initials(artist.name)) + '</span>' : esc(initials(artist.name))) + '</div>';
  };

  var ext = function (url, label, cls, aria) {
    return '<a class="' + (cls || '') + '" href="' + esc(url) + '" target="_blank" rel="noopener"' +
      (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + label + '</a>';
  };
  var inl = function (hash, label, cls) {
    return '<a class="' + (cls || '') + '" href="' + esc(hash) + '">' + label + '</a>';
  };

  var playCircle = function (url, label) {
    return '<a class="play-circle" href="' + esc(url) + '" target="_blank" rel="noopener" aria-label="Play ' +
      esc(label) + ' on Spotify"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></a>';
  };

  /* ---------- icons ---------- */
  var I = function (path) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>'; };
  var ICON = {
    home: I('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'),
    artists: I('M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'),
    producer: I('M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z'),
    music: I('M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z'),
    clothing: I('M12 6c-2.67 0-8 1.34-8 4v10.5h5V17h6v3.5h5V10c0-2.66-5.33-4-8-4zm0-4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'),
    software: I('M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z')
  };
  var INFO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';

  var NAV = [
    { route: '#/', key: 'home', label: 'Home', icon: ICON.home },
    { route: '#/artists', key: 'artists', label: 'Artists', icon: ICON.artists },
    { route: '#/producer', key: 'producer', label: 'Producer', icon: ICON.producer },
    { route: '#/music', key: 'music', label: 'Music', icon: ICON.music },
    { route: '#/clothing', key: 'clothing', label: 'Clothing', icon: ICON.clothing },
    { route: '#/software', key: 'software', label: 'Software', icon: ICON.software }
  ];

  /* ---------- state ---------- */
  var DB = { roster: null, producer: null, artists: {}, commerce: null };
  var playerClosed = false; // close (×) collapses to "Now on Spotify" pill; honest: playback continues in Spotify's player
  var currentFeature = null; // {type, id, title, artist} for STATE A, or null for STATE B

  /* ---------- data ---------- */
  function loadJSON(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' on ' + path);
      return r.json();
    });
  }
  function loadAll() {
    return loadJSON('data/roster.json').then(function (roster) {
      DB.roster = roster;
      return Promise.all([
        loadJSON('data/producer.json'),
        loadJSON('data/commerce.json')
      ]);
    }).then(function (res) {
      DB.producer = res[0]; DB.commerce = res[1];
      var slugs = DB.roster.order || [];
      return Promise.all(slugs.map(function (slug) {
        return loadJSON('data/artists/' + slug + '.json').then(function (a) { DB.artists[slug] = a; });
      }));
    });
  }
  var artist = function (slug) { return DB.artists[slug] || null; };
  var rosterArtists = function () {
    return (DB.roster.order || []).map(artist).filter(Boolean);
  };
  var firstVerifiedTrack = function (a) {
    var tr = (a.tracks || []).filter(function (t) { return t.spotify_track_id; })[0];
    return tr ? { type: 'track', id: tr.spotify_track_id, title: tr.title, artist: a.name } : null;
  };

  /* ---------- shared chrome ---------- */
  function lockup(prodName, prodImg) {
    return '<div class="lockup"><div class="prod">' +
      (prodImg ? '<img src="' + esc(prodImg) + '" alt="' + esc(prodName) + ' logo">' : '') +
      '<b>' + esc(prodName) + '</b></div>' +
      '<div class="cwi"><img src="assets/cwi-logo.jpg" alt="Cumulative Web Inc logo"><span>Cumulative Web Inc</span></div></div>';
  }

  function sectionHead(title, moreHref, moreLabel) {
    return '<div class="sec-head"><h2>' + esc(title) + '</h2>' +
      (moreHref ? inl(moreHref, esc(moreLabel || 'Show all'), 'more') : '') + '</div>';
  }

  // Card is one link (stretched anchor) + a sibling play link on hover — no nested <a>.
  function artistCard(a) {
    var ft = firstVerifiedTrack(a);
    return '<div class="card">' +
      '<a href="#/artist/' + esc(a.slug) + '" aria-label="Open ' + esc(a.name) + '" style="position:absolute;inset:0" tabindex="-1"></a>' +
      artBlock(a, 'card') +
      (a.status === 'LIVE' && ft ? '<span class="hover-play">' + playCircle(trackUrl(ft.id), ft.title) + '</span>' : '') +
      '<h3>' + esc(a.name) + '</h3><div class="sub">' + esc(a.tagline || '') + '</div>' +
      '<div class="badge-row">' + badge(a.status) + '</div></div>';
  }

  function trackRow(t, artistName, artForRow) {
    var live = !!t.spotify_track_id;
    var titleHtml = live ? ext(trackUrl(t.spotify_track_id), esc(t.title)) : esc(t.title);
    var stBadge = '';
    if (t.status && t.status !== 'LIVE') stBadge = badge(t.status);
    return '<li class="track">' + artBlock(artForRow || { name: artistName, image: 'placeholder' }, 'track') +
      '<span class="tmeta"><span class="t">' + titleHtml + '</span><span class="a">' + esc(artistName) +
      (t.note ? ' · ' + esc(t.note) : '') + '</span></span>' +
      '<span class="tright">' + (live ? badge('LIVE') : '') + stBadge +
      (live ? playCircle(trackUrl(t.spotify_track_id), t.title) : '') + '</span></li>';
  }

  function footer() {
    var arts = rosterArtists().map(function (a) {
      return '<li>' + inl('#/artist/' + esc(a.slug), esc(a.name)) + '</li>';
    }).join('');
    var flag = artist(DB.roster.flagship);
    return '<footer class="footer"><div class="fbrand"><img src="assets/cwi-logo.jpg" alt="Cumulative Web Inc logo">' +
      '<b>CUMULATIVE WEB INC</b></div><div class="cols">' +
      '<div><h4>Company</h4><ul>' +
      '<li>' + inl('#/', 'Home') + '</li>' +
      '<li>' + inl('#/producer', 'Producer — Black Lansky') + '</li>' +
      '<li>' + ext(DB.commerce.music[1].url, 'THE EDIT storefront') + '</li>' +
      '<li>' + ext(DB.commerce.software[1].url, 'Agent Deck') + '</li>' +
      '<li>' + ext(DB.commerce.software[3].url, 'Caravan') + '</li>' +
      '<li><a href="mailto:' + esc(DB.commerce.contact.email) + '">Contact</a></li>' +
      '</ul></div>' +
      '<div><h4>Roster</h4><ul>' + arts + '</ul></div>' +
      '<div><h4>Music</h4><ul>' +
      (flag && flag.links && flag.links.spotify_artist ? '<li>' + ext(flag.links.spotify_artist, 'Listen on Spotify') + '</li>' : '') +
      '<li>' + ext(DB.commerce.music[3].url, 'Catalog podcast') + '</li>' +
      (flag && flag.links && flag.links.ai_learning_set_playlist
        ? '<li>' + ext(SPOT + '/playlist/' + flag.links.ai_learning_set_playlist.split(':')[2], 'AI Learning Set playlist') + '</li>' : '') +
      '<li>' + ext(DB.commerce.music[0].url, 'CWI Store') + '</li>' +
      '<li>' + inl('#/music', 'All music') + '</li>' +
      '</ul></div>' +
      '<div><h4>Legal</h4><ul><li><a href="mailto:' + esc(DB.commerce.contact.email) + '">' + esc(DB.commerce.contact.email) + '</a></li></ul>' +
      '<p class="view-meta">Built with $0. No trackers.</p></div>' +
      '</div>' +
      '<div class="legal"><span>© 2026 Cumulative Web Inc. All rights reserved.</span>' +
      '<span>Music · Clothing · Software — packaged right, marketed right.</span></div></footer>';
  }

  /* ---------- player chrome (PLAYER-CHROME.md law) ---------- */
  var playerGen = 0; // bumped on every render so stale load-timers can't fire into a newer view
  function playerHTML() {
    var f = currentFeature;
    if (!f) {
      return '<div class="placeholder-bar">' + INFO_ICON +
        '<span><b>Streaming links coming soon.</b> We\u2019re verifying this artist\u2019s streaming links. No audio plays here.</span></div>';
    }
    if (playerClosed) {
      return '<button class="player-pill btn btn--secondary" id="player-reopen" aria-label="Re-open the Spotify player">Now on Spotify ↗</button>';
    }
    return '<div class="player" role="region" aria-label="Spotify player">' +
      '<div class="part" aria-hidden="true">' + esc(initials(f.artist)) + '</div>' +
      '<div class="pmeta"><div class="t">' + esc(f.title) + '</div><div class="a">' + esc(f.artist) + '</div>' +
      '<span class="badge badge--live">LIVE</span></div>' +
      '<iframe src="' + esc(SPOT + '/embed/' + f.type + '/' + f.id + '?theme=0') + '" title="Play ' + esc(f.title) +
      ' on Spotify" allow="encrypted-media" loading="lazy"></iframe>' +
      '<button class="close" id="player-close" aria-label="Collapse player">×</button></div>';
  }
  function wirePlayer() {
    var gen = ++playerGen;
    var close = document.getElementById('player-close');
    if (close) close.addEventListener('click', function () { playerClosed = true; rerenderPlayer(); });
    var reopen = document.getElementById('player-reopen');
    if (reopen) reopen.addEventListener('click', function () { playerClosed = false; rerenderPlayer(); });
    // PLAYER-CHROME.md rule 3: if the Spotify iframe fails (offline/ad-block),
    // fall back to honest STATE B wording — never an empty "player".
    var frame = document.querySelector('#player-slot .player iframe');
    if (frame) {
      var loaded = false;
      frame.addEventListener('load', function () { loaded = true; });
      var f = currentFeature;
      setTimeout(function () {
        if (gen === playerGen && !loaded && f && document.querySelector('#player-slot .player iframe')) {
          document.getElementById('player-slot').innerHTML =
            '<div class="placeholder-bar">' + INFO_ICON +
            '<span><b>Spotify player couldn\u2019t load.</b> No audio plays here — ' +
            ext(SPOT + '/' + f.type + '/' + f.id, 'open ' + f.title + ' in Spotify ↗', 'btn btn--tertiary') + '</span></div>';
        }
      }, 12000);
    }
  }
  function rerenderPlayer() {
    var slot = document.getElementById('player-slot');
    if (slot) { slot.innerHTML = playerHTML(); wirePlayer(); }
  }
  function playerSlot() { return '<div id="player-slot">' + playerHTML() + '</div>'; }

  /* ---------- views ---------- */
  function viewHome() {
    var flag = artist(DB.roster.flagship);
    var featuredTracks = (flag.tracks || []).filter(function (t) { return t.spotify_track_id; });
    currentFeature = firstVerifiedTrack(flag);
    playerClosed = false;

    var heroCta = (flag.links && flag.links.spotify_artist)
      ? ext(flag.links.spotify_artist, 'Listen on Spotify', 'btn btn--primary') : badge('PLANNED');

    var html = lockup('Cumulative Web Inc', 'assets/cwi-logo.jpg') +
      '<section class="hero"><div class="eyebrow">Label roster · Music &amp; Film · Clothing · Software &amp; AI Agents</div>' +
      '<h1>Cumulative Web Inc</h1>' +
      '<div class="meta"><span class="chip">Independent label</span><span class="chip">Frederick, MD</span>' + badge('LIVE') + '</div>' +
      '<p class="lede">The label platform for Cumulative Web Inc — the roster, the music, the apparel, and the software we sell to other independents.</p>' +
      '<div class="ctas">' + heroCta + inl('#/artists', 'Meet the roster', 'btn btn--secondary') + '</div></section>';

    html += '<section>' + sectionHead('Roster', '#/artists', 'All artists') +
      '<div class="grid">' + rosterArtists().map(artistCard).join('') + '</div></section>';

    if (featuredTracks.length) {
      html += '<section>' + sectionHead('Now streaming', '#/music', 'All music') +
        '<ol class="tracklist">' + featuredTracks.map(function (t) { return trackRow(t, flag.name); }).join('') + '</ol></section>';
    }

    var sw = DB.commerce.software.slice(0, 4);
    html += '<section>' + sectionHead('Software', '#/software', 'All software') +
      '<div class="grid">' + sw.map(function (s) {
        return '<div class="card"><h3>' + esc(s.name) + '</h3><div class="sub">' + esc(s.tagline) + '</div>' +
          '<div class="badge-row">' + badge(s.status) + '</div>' +
          '<div class="badge-row">' + ext(s.url, esc(s.cta_label || 'Open'), 'btn btn--primary') + '</div></div>';
      }).join('') + '</div></section>';

    html += '<section>' + sectionHead('The Storefront', '#/music', 'All offers') +
      '<div class="grid">' +
      '<div class="card"><h3>THE EDIT storefront</h3><div class="sub">Booth credits · content packages · The Crate · Greenlight · Call Sheet</div>' +
      '<div class="badge-row">' + badge('LIVE') + '</div>' +
      '<div class="badge-row">' + ext(DB.commerce.music[1].url, 'Try THE EDIT', 'btn btn--primary') + '</div></div>' +
      '<div class="card"><h3>Artist Services packs</h3><div class="sub">Pitch kit $19 · Evidence report $49 · Sync Readiness Pack $149</div>' +
      '<div class="badge-row">' + badge('LIVE') + '</div>' +
      '<div class="badge-row">' + ext(DB.commerce.music[0].url, 'Browse the store', 'btn btn--primary') + '</div></div>' +
      '<div class="card"><h3>CWI Apparel</h3><div class="sub">First drop incoming — waitlist only.</div>' +
      '<div class="badge-row">' + badge('DROPPING_SOON') + '</div>' +
      '<div class="badge-row">' + inl('#/clothing', 'Join the waitlist', 'btn btn--secondary') + '</div></div>' +
      '</div></section>';

    return html + footer() + playerSlot();
  }

  function viewArtists() {
    currentFeature = null; playerClosed = false;
    return lockup('Artists', 'assets/cwi-logo.jpg') +
      '<section>' + sectionHead('The roster') +
      '<p class="view-meta">' + rosterArtists().length + ' artists &amp; producers. DRAFT pages are in progress — shown as-is, never presented as available.</p>' +
      '<div class="grid">' + rosterArtists().map(artistCard).join('') + '</div></section>' +
      footer() + playerSlot();
  }

  function viewArtist(slug) {
    var a = artist(slug);
    if (!a) return viewNotFound('artist');
    currentFeature = firstVerifiedTrack(a); playerClosed = false;

    var html = lockup(a.name, null) +
      '<section class="hero"><div class="eyebrow">' + (a.role === 'producer' ? 'Producer' : 'Artist') + ' · Cumulative Web Inc</div>' +
      '<h1>' + esc(a.name) + '</h1>' +
      '<div class="meta">' + (a.genres || []).map(function (g) { return '<span class="chip">' + esc(g) + '</span>'; }).join('') +
      badge(a.status) + '</div>' +
      '<p class="lede">' + esc(a.tagline || '') + '</p>' +
      '<div class="ctas">' +
      ((a.links && a.links.spotify_artist) ? ext(a.links.spotify_artist, 'Listen on Spotify', 'btn btn--primary') : badge('PLANNED')) +
      '<a class="btn btn--secondary" href="' + esc(a.booking_cta || 'mailto:hp@cumulativeweb.com') + '">Book / contact</a>' +
      '</div></section>';

    html += '<section><h2 style="font-size:var(--text-h2);margin-bottom:var(--space-4)">About</h2><p style="max-width:80ch">' +
      esc(a.bio) + '</p></section>';

    if ((a.releases || []).length) {
      html += '<section>' + sectionHead('Releases') + '<div class="grid">' + a.releases.map(function (r) {
        return '<div class="card"><h3>' + esc(r.title) + '</h3><div class="sub">' + esc(r.type || 'release') +
          (r.year && r.year !== 'PLANNED' ? ' · ' + esc(String(r.year)) : '') + '</div>' +
          '<div class="badge-row">' + badge(r.status || 'PLANNED') + '</div>' +
          (r.note ? '<div class="sub" style="margin-top:var(--space-2)">' + esc(r.note) + '</div>' : '') + '</div>';
      }).join('') + '</div></section>';
    }

    if ((a.tracks || []).length) {
      html += '<section>' + sectionHead('Tracks') +
        '<ol class="tracklist">' + a.tracks.map(function (t) { return trackRow(t, a.name); }).join('') + '</ol></section>';
    }

    var links = a.links || {};
    var linkRows = [];
    if (links.spotify_artist) linkRows.push(['Spotify artist page', links.spotify_artist]);
    if (links.ai_learning_set_playlist) linkRows.push(['AI Learning Set playlist', SPOT + '/playlist/' + links.ai_learning_set_playlist.split(':')[2]]);
    if (links.eric_alper_playlist) linkRows.push(['Zooted Zone on Eric Alper\u2019s "360° : The Best Indie Music"', SPOT + '/playlist/' + links.eric_alper_playlist.split(':')[2]]);
    if (links.podcast_rss) linkRows.push(['Catalog podcast RSS feed', links.podcast_rss]);
    if (links.podcast_note) linkRows.push(['Podcast note', null, links.podcast_note]);
    if (linkRows.length) {
      html += '<section>' + sectionHead('Links') + '<ul class="tracklist">' +
        linkRows.map(function (r) {
          return '<li class="track"><span class="tmeta"><span class="t">' + esc(r[0]) + '</span>' +
            (r[2] ? '<span class="a">' + esc(r[2]) + '</span>' : '') + '</span>' +
            (r[1] ? '<span class="tright">' + ext(r[1], 'Open ↗', 'btn btn--tertiary') + '</span>' : '') + '</li>';
        }).join('') + '</ul></section>';
    } else if (links.note) {
      html += '<section>' + sectionHead('Links') + '<p class="view-meta">' + esc(links.note) + '</p></section>';
    }

    var m = a.merch || {};
    html += '<section>' + sectionHead('Merch') +
      '<div class="badge-row">' + badge(m.status || 'DROPPING_SOON') + '</div>' +
      '<p class="view-meta">' + esc(m.note || 'No inventory yet.') + '</p>' +
      (m.waitlist ? '<a class="btn btn--secondary" href="' + esc(m.waitlist) + '">Join the waitlist</a>' : '') + '</section>';

    return html + footer() + playerSlot();
  }

  function viewProducer() {
    var p = DB.producer;
    currentFeature = null; playerClosed = false;
    var rows = (p.credits || []).map(function (c) {
      var yr = c.year === 'PLANNED' ? badge('PLANNED') : esc(String(c.year || ''));
      return '<tr><td><b>' + esc(c.artist) + '</b></td><td>' + esc(c.work) + '</td><td>' + esc(c.role) + '</td><td>' + yr +
        '</td>' + (c.note ? '<td class="note">' + esc(c.note) + '</td>' : '<td></td>') + '</tr>';
    }).join('');
    return lockup(p.alias, 'assets/cwi-logo.jpg') +
      '<section class="hero"><div class="eyebrow">Producer · Label founder</div>' +
      '<h1>' + esc(p.name) + '</h1><div class="meta"><span class="chip">' + esc(p.alias) + '</span>' + badge('LIVE') + '</div>' +
      '<p class="lede">' + esc(p.bio) + '</p>' +
      '<div class="ctas"><a class="btn btn--primary" href="' + esc(p.contact_cta) + '">Contact for production &amp; business</a></div></section>' +
      '<section>' + sectionHead('Production credits') +
      '<div style="overflow-x:auto"><table class="credit-table"><thead><tr><th>Artist</th><th>Work</th><th>Role</th><th>Year</th><th class="note">Note</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="view-meta" style="margin-top:var(--space-3)">Years marked PLANNED are awaiting verification — never invented.</p></section>' +
      footer() + playerSlot();
  }

  function viewMusic() {
    var C = DB.commerce;
    var flag = artist(DB.roster.flagship);
    currentFeature = { type: 'show', id: '0tOAhqiV2uwtsK2UVVI4WA', title: 'Post-Trap Futurism: The Catalog Sessions', artist: 'Cumulative Web Inc' };
    playerClosed = false;

    var html = lockup('Music', 'assets/cwi-logo.jpg') +
      '<section class="hero"><div class="eyebrow">Music · the catalog &amp; the tools</div>' +
      '<h1>Music</h1><div class="meta">' + badge('LIVE') + '</div>' +
      '<p class="lede">Independent label output from Cumulative Web Inc — the artist, the sync desk, and the tools we sell to other independents.</p>' +
      '<div class="ctas">' + ext(C.music[3].url, 'Catalog podcast on Spotify', 'btn btn--primary') +
      ext(C.music[0].url, 'Browse the store', 'btn btn--secondary') + '</div></section>';

    var featured = (flag.tracks || []).filter(function (t) { return t.spotify_track_id; });
    html += '<section>' + sectionHead(flag.name + ' — now streaming', '#/artist/' + flag.slug, 'Artist page') +
      '<ol class="tracklist">' + featured.map(function (t) { return trackRow(t, flag.name); }).join('') + '</ol></section>';

    var pod = C.music[3];
    html += '<section>' + sectionHead('Catalog podcast') +
      '<div class="offer-card"><h3>' + esc(pod.name) + '</h3><div class="sub">' + esc(pod.tagline) + '</div>' +
      '<div class="badge-row">' + badge(pod.status) + '<span class="badge badge--live">' + esc(pod.price) + '</span></div>' +
      '<div class="foot">' + ext(pod.url, 'Listen on Spotify', 'btn btn--primary') +
      ext(pod.rss, 'RSS feed', 'btn btn--tertiary') + '</div></div></section>';

    var store = C.music[0];
    html += '<section>' + sectionHead(store.name, store.url, store.cta_label) +
      '<p class="view-meta" style="max-width:80ch">' + esc(store.tagline) + ' Order by email; online checkout opens soon.</p>' +
      '<div class="offer-list">' + store.offers.map(function (o) {
        return '<div class="offer-row"><div class="or-main"><h4>' + esc(o.name) + '</h4><p>' + esc(o.note) + '</p></div>' +
          '<span class="or-price">' + esc(o.price) + '</span>' +
          '<span class="tright">' + ext(store.url, 'Order', 'btn btn--primary') + '</span></div>';
      }).join('') + '</div></section>';

    var ed = C.music[1];
    html += '<section>' + sectionHead(ed.name, ed.url, ed.cta_label) +
      '<p class="view-meta" style="max-width:80ch">' + esc(ed.tagline) + '</p>' +
      '<div class="offer-list">' + ed.sections.map(function (s) {
        return '<div class="offer-row"><div class="or-main"><h4>' + esc(s.name) + '</h4><p>' + esc(s.detail) + '</p>' +
          (s.status ? '<div class="badge-row">' + badge(s.status) + '</div>' : '') + '</div>' +
          '<span class="or-price">' + esc(s.price) + '</span>' +
          '<span class="tright">' + ext(ed.url, 'Order', 'btn btn--primary') + '</span></div>';
      }).join('') + '</div>' +
      '<p class="view-meta" style="margin-top:var(--space-3)">' + esc(ed.checkout_note) + '</p></section>';

    var cs = C.music[2];
    html += '<section>' + sectionHead('Sync licensing') +
      '<div class="offer-card"><h3>' + esc(cs.name) + '</h3><div class="sub">' + esc(cs.tagline) + '</div>' +
      '<div class="badge-row">' + badge(cs.status) + '<span class="badge badge--live">' + esc(cs.price) + '</span></div>' +
      '<div class="foot">' + ext(cs.url, esc(cs.cta_label), 'btn btn--primary') + '</div></div></section>';

    return html + footer() + playerSlot();
  }

  function viewClothing() {
    var c = DB.commerce.clothing;
    currentFeature = null; playerClosed = false;
    return lockup(c.name, 'assets/cwi-logo.jpg') +
      '<section class="hero"><div class="eyebrow">Clothing · the label you can wear</div>' +
      '<h1>CWI Apparel</h1><div class="meta">' + badge(c.status) + '</div>' +
      '<p class="lede">' + esc(c.note) + '</p>' +
      '<div class="ctas"><a class="btn btn--primary" href="' + esc(c.url) + '">Join the waitlist</a></div></section>' +
      '<section><p class="view-meta">No inventory yet, no pre-orders open, no prices invented — the waitlist hears first when the first pieces land.</p></section>' +
      footer() + playerSlot();
  }

  function viewSoftware() {
    var C = DB.commerce;
    currentFeature = null; playerClosed = false;
    var html = lockup('Software', 'assets/cwi-logo.jpg') +
      '<section class="hero"><div class="eyebrow">Software · agent infrastructure &amp; creator tools</div>' +
      '<h1>Software</h1><div class="meta">' + badge('LIVE') + '</div>' +
      '<p class="lede">Agent infrastructure and creator tools, built and shipped by Cumulative Web Inc.</p></section>';
    html += '<section><div class="grid">' + C.software.map(function (s) {
      return '<div class="card"><h3>' + esc(s.name) + '</h3><div class="sub">' + esc(s.tagline) + '</div>' +
        '<div class="sub" style="font-weight:800;color:var(--cwi-text)">' + esc(s.price) + '</div>' +
        '<div class="badge-row">' + badge(s.status) + '</div>' +
        (s.status_note ? '<div class="sub" style="margin-top:var(--space-2)">' + esc(s.status_note) + '</div>' : '') +
        '<div class="badge-row">' + ext(s.url, esc(s.cta_label || 'Open'), 'btn btn--primary') + '</div></div>';
    }).join('') + '</div></section>';
    return html + footer() + playerSlot();
  }

  function viewNotFound(what) {
    currentFeature = null; playerClosed = false;
    return '<section class="notfound"><h1>Not found</h1>' +
      '<p>The ' + esc(what || 'page') + ' you asked for doesn\u2019t exist on this label.</p>' +
      '<p>' + inl('#/', 'Back home', 'btn btn--primary') + '</p></section>' + footer() + playerSlot();
  }

  /* ---------- router ---------- */
  function render(route) {
    var view = document.getElementById('view');
    var html;
    if (route === '' || route === '/') html = viewHome();
    else if (route === '/artists') html = viewArtists();
    else if (route.indexOf('/artist/') === 0) html = viewArtist(route.slice(8));
    else if (route === '/producer') html = viewProducer();
    else if (route === '/music') html = viewMusic();
    else if (route === '/clothing') html = viewClothing();
    else if (route === '/software') html = viewSoftware();
    else html = viewNotFound('page');
    view.innerHTML = html;
    wirePlayer();
    document.getElementById('main').scrollTop = 0;
    window.scrollTo(0, 0);
    markActive(route);
  }

  function markActive(route) {
    var key = 'home';
    if (route.indexOf('/artist') === 0) key = 'artists';
    else if (route === '/artists') key = 'artists';
    else if (route === '/producer') key = 'producer';
    else if (route === '/music') key = 'music';
    else if (route === '/clothing') key = 'clothing';
    else if (route === '/software') key = 'software';
    var side = NAV.map(function (n) {
      return '<a class="nav-item' + (n.key === key ? ' active' : '') + '" href="' + n.route + '">' + n.icon + '<span>' + n.label + '</span></a>';
    }).join('');
    document.getElementById('side-nav').innerHTML =
      '<div class="nav-group">Label</div>' + side;
    document.getElementById('tabbar').innerHTML = NAV.map(function (n) {
      return '<a class="' + (n.key === key ? 'active' : '') + '" href="' + n.route + '" aria-label="' + n.label + '">' + n.icon + n.label + '</a>';
    }).join('');
  }

  function currentRoute() {
    var h = window.location.hash || '#/';
    return h.charAt(0) === '#' ? h.slice(1) : h;
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    loadAll().then(function () {
      window.addEventListener('hashchange', function () { render(currentRoute()); });
      render(currentRoute());
    }).catch(function (err) {
      document.getElementById('view').innerHTML =
        '<section class="notfound"><h1>Couldn\u2019t load the catalog</h1><p>' + esc(String(err && err.message || err)) +
        '</p><p class="view-meta">This site loads its data from data/*.json — serve it over HTTP (e.g. the deployed Pages build), not file://.</p></section>';
    });
  });
})();
