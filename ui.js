// ============================================================
//  ui.js – DOM rendering helpers
// ============================================================

// ── Role helpers ─────────────────────────────────────────────
function roleClass(role) {
  if (!role) return "";
  const r = role.toLowerCase();
  if (r.includes("wk"))      return "role-wk";
  if (r.includes("bat"))     return "role-batsman";
  if (r.includes("bowl"))    return "role-bowler";
  if (r.includes("all"))     return "role-allrounder";
  return "role-batsman";
}
function roleEmoji(role) {
  if (!role) return "";
  const r = role.toLowerCase();
  if (r.includes("wk"))  return "🧤";
  if (r.includes("bat")) return "🏏";
  if (r.includes("bowl"))return "⚾";
  if (r.includes("all")) return "⚡";
  return "🏏";
}
function impactColor(score) {
  if (score >= 75) return "#ffd740";
  if (score >= 55) return "#00e5ff";
  if (score >= 35) return "#00e676";
  return "#607080";
}
function teamInitials(name) {
  if (!name) return "?";
  const words = name.split(" ");
  if (words.length === 1) return name.slice(0,3).toUpperCase();
  return words.filter(w=>w[0]===w[0].toUpperCase()).map(w=>w[0]).join("").slice(0,3);
}

// ── Win Probability Bar ──────────────────────────────────────
function renderProbBar(pred, t1, t2) {
  const p1 = +(pred.team1_win_probability * 100).toFixed(1);
  const p2 = +(pred.team2_win_probability * 100).toFixed(1);
  document.getElementById("prob-label-t1").textContent = t1;
  document.getElementById("prob-label-t2").textContent = t2;

  setTimeout(() => {
    document.getElementById("probFillT1").style.width = p1 + "%";
    document.getElementById("probFillT2").style.width = p2 + "%";
    document.getElementById("probPctT1").textContent  = p1 + "%";
    document.getElementById("probPctT2").textContent  = p2 + "%";
  }, 200);

  const bh = pred.bayesian_h2h || {};
  const ci = bh.ci_low && bh.ci_high
    ? `Bayesian 95% Credible Interval for ${t1}: [${(bh.ci_low*100).toFixed(1)}% – ${(bh.ci_high*100).toFixed(1)}%]  ·  α=${bh.alpha||"—"}, β=${bh.beta||"—"}`
    : "";
  document.getElementById("credibleInterval").textContent = ci;
}

// ── Summary Stats Row ────────────────────────────────────────
function renderSummaryStats(pred, h2h, t1, t2) {
  document.getElementById("sc-exp1").textContent = pred.team1_expected_score
    ? Math.round(pred.team1_expected_score) : "—";
  document.getElementById("sc-exp2").textContent = pred.team2_expected_score
    ? Math.round(pred.team2_expected_score) : "—";

  if (h2h) {
    const rec = `${h2h.team1_wins}–${h2h.team2_wins}`;
    document.getElementById("sc-h2h").textContent     = rec;
    document.getElementById("sc-h2h-sub").textContent = `${h2h.total_matches} matches played`;
  }

  // Colour the score cards
  document.getElementById("statCard1").style.borderTopColor = "#0088ff";
  document.getElementById("statCard2").style.borderTopColor = "#ff8800";
}

// ── Model Breakdown Cards ────────────────────────────────────
function renderModelBreakdown(pred, t1, t2) {
  const mw = pred.model_weights || {h2h:0.40,venue:0.25,runs:0.35};
  const bh = pred.bayesian_h2h || {};
  const vf1 = (pred.venue_factor_team1||{}).win_rate || 0.5;
  const vf2 = (pred.venue_factor_team2||{}).win_rate || 0.5;
  const rr1 = pred.team1_run_rate_lambda || 8;
  const rr2 = pred.team2_run_rate_lambda || 8;

  const cards = [
    {
      title:"BAYESIAN H2H · Beta(α,β)",
      weight: mw.h2h,
      t1_val: ((bh.prob||0.5)*100).toFixed(1)+"%",
      t2_val: (((1-(bh.prob||0.5)))*100).toFixed(1)+"%",
      bar: (bh.prob||0.5)*100,
      desc:`α=${bh.alpha||"—"} β=${bh.beta||"—"} · Prior Beta(2,2)`
    },
    {
      title:"VENUE FACTOR",
      weight: mw.venue,
      t1_val: (vf1*100).toFixed(1)+"%",
      t2_val: (vf2*100).toFixed(1)+"%",
      bar: vf1*100,
      desc:`Win rate at selected venue`
    },
    {
      title:"POISSON RUN-RATE · λ",
      weight: mw.runs,
      t1_val: `λ=${rr1.toFixed(2)}`,
      t2_val: `λ=${rr2.toFixed(2)}`,
      bar: (rr1/(rr1+rr2))*100,
      desc:`Expected runs per over`
    }
  ];

  const grid = document.getElementById("modelGrid");
  grid.innerHTML = cards.map(c => `
    <div class="model-card">
      <div class="model-card-title">${c.title}</div>
      <div class="model-bar-wrap">
        <div class="model-bar-bg">
          <div class="model-bar-fill" style="width:0%" data-target="${c.bar.toFixed(1)}"></div>
        </div>
      </div>
      <div class="model-teams-row">
        <span style="color:#4da6ff">${c.t1_val}</span>
        <span style="color:#ff9944">${c.t2_val}</span>
      </div>
      <div class="model-weight">Weight: ${(c.weight*100).toFixed(0)}% · ${c.desc}</div>
    </div>
  `).join("");

  setTimeout(() => {
    grid.querySelectorAll(".model-bar-fill").forEach(el => {
      el.style.width = el.dataset.target + "%";
    });
  }, 300);
}

// ── Matchup Table ────────────────────────────────────────────
function renderMatchupTable(data, t1, t2) {
  const matchups = (data.matchups || []).slice(0, 25);
  if (!matchups.length) {
    document.getElementById("matchupTable").innerHTML = `<p style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem;">No matchup data available.</p>`;
    return;
  }
  const rows = matchups.map(m => {
    const advClass = m.advantage === "BOWLER" ? "adv-bowler" :
                     m.advantage === "BATSMAN" ? "adv-batsman" : "adv-neutral";
    const sig = m.statistically_dominant
      ? `<span class="sig-star" title="Statistically significant (p<0.05)">★</span>` : "";
    const dom = m.statistically_dominant ? " dominant" : "";
    const sr  = m.wickets > 0 ? m.strike_rate_for_bowler : "—";
    return `
      <tr class="${dom}">
        <td><strong style="color:#ff6644">${m.bowler}</strong><br/>
            <span style="color:var(--text-muted);font-size:0.6rem">${t2}</span></td>
        <td><strong>${m.batsman}</strong><br/>
            <span style="color:var(--text-muted);font-size:0.6rem">${t1}</span></td>
        <td>${m.balls}</td>
        <td>${m.runs}</td>
        <td><strong style="color:${m.wickets>=2?'#ff4444':'var(--text)'}">${m.wickets}</strong></td>
        <td>${sr}</td>
        <td>${m.dot_ball_percentage}%</td>
        <td><span style="font-family:var(--font-mono);font-size:0.65rem;color:${m.binomial_p_value<0.05?'#ff4444':'var(--text-dim)'}">${m.binomial_p_value}</span>${sig}</td>
        <td><span class="advantage-pill ${advClass}">${m.advantage}</span></td>
      </tr>`;
  }).join("");

  document.getElementById("matchupTable").innerHTML = `
    <table class="matchup-table">
      <thead>
        <tr>
          <th>BOWLER (${t2})</th><th>BATSMAN (${t1})</th>
          <th>BALLS</th><th>RUNS</th><th>WKTS</th>
          <th>SR(BOWL)</th><th>DOT%</th><th>P-VALUE</th><th>ADVANTAGE</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Squad Grid ────────────────────────────────────────────────
function renderSquad(data, containerId, labelId) {
  const sq = data.squad || [];
  if (labelId) document.getElementById(labelId).textContent = data.team + " — 2026 SQUAD";

  const sorted = [...sq].sort((a,b) => (b.impact_score||0)-(a.impact_score||0));
  const topPlayers = new Set(sorted.slice(0,3).map(p=>p.player));

  const cards = sq.map(p => {
    const bat = p.batting || {};
    const bwl = p.bowling || {};
    const isKey = topPlayers.has(p.player);
    const color = impactColor(p.impact_score||0);

    // Extra badges
    const badges = [];
    if (p.is_captain)   badges.push(`<span style="background:#ffd74022;color:var(--gold);border:1px solid #ffd74055;font-family:var(--font-mono);font-size:0.55rem;padding:2px 6px;border-radius:3px;letter-spacing:0.08em">© CAPTAIN</span>`);
    if (p.is_retained)  badges.push(`<span style="background:#00e67622;color:#00e676;border:1px solid #00e67655;font-family:var(--font-mono);font-size:0.55rem;padding:2px 6px;border-radius:3px;letter-spacing:0.08em">RETAINED</span>`);
    if (p.is_overseas)  badges.push(`<span style="background:#00e5ff22;color:var(--cyan);border:1px solid #00e5ff55;font-family:var(--font-mono);font-size:0.55rem;padding:2px 6px;border-radius:3px;letter-spacing:0.08em">OVERSEAS</span>`);

    // Price chip
    const priceChip = p.price_cr ? `<span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--gold)">₹${p.price_cr}Cr</span>` : "";

    // Styles row
    const stylesRow = (p.batting_style || p.bowling_style) ? `
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        ${p.batting_style?`<span style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-dim)">🏏 ${p.batting_style}</span>`:""}
        ${p.bowling_style?`<span style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-dim)">⚾ ${p.bowling_style}</span>`:""}
      </div>` : "";

    const batStats = bat.average ? `
      <div class="stat-mini"><div class="stat-mini-val">${bat.average||"—"}</div><div class="stat-mini-lbl">BAT AVG</div></div>
      <div class="stat-mini"><div class="stat-mini-val">${bat.strike_rate||"—"}</div><div class="stat-mini-lbl">STRIKE RATE</div></div>
    ` : "";
    const bwlStats = bwl.wickets ? `
      <div class="stat-mini"><div class="stat-mini-val">${bwl.wickets||"—"}</div><div class="stat-mini-lbl">WICKETS</div></div>
      <div class="stat-mini"><div class="stat-mini-val">${bwl.economy||"—"}</div><div class="stat-mini-lbl">ECONOMY</div></div>
    ` : "";

    return `
      <div class="player-card ${isKey?'key-player':''}">
        ${isKey?'<div style="position:absolute;top:8px;right:8px;font-size:0.6rem;font-family:var(--font-mono);color:var(--gold);letter-spacing:0.1em">★ KEY PLAYER</div>':''}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div class="player-name">${roleEmoji(p.role)} ${p.player}</div>
          ${priceChip}
        </div>
        <div class="player-meta">
          <span class="role-pill ${roleClass(p.role)}">${p.role||"—"}</span>
          <span class="nationality-flag">${p.nationality||""} · Age ${p.age||"—"}</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">${badges.join("")}</div>
        ${stylesRow}
        <div class="impact-score">
          <span class="impact-label">IMPACT</span>
          <div class="impact-bar">
            <div class="impact-fill" style="width:0%;background:${color}" data-target="${p.impact_score||0}"></div>
          </div>
          <span class="impact-num" style="color:${color}">${p.impact_score||0}</span>
        </div>
        <div class="stats-mini-grid">
          ${batStats}${bwlStats}
          ${!batStats&&!bwlStats?`<div class="stat-mini" style="grid-column:span 2"><div class="stat-mini-val" style="font-size:0.9rem">Debut Season</div></div>`:""}
        </div>
      </div>`;
  }).join("");

  document.getElementById(containerId).innerHTML = cards;
  setTimeout(() => {
    document.querySelectorAll(`#${containerId} .impact-fill`).forEach(el => {
      el.style.width = el.dataset.target + "%";
    });
  }, 200);
}

// ── Strategy Panel ────────────────────────────────────────────
function renderStrategy(data, t1) {
  const bs = data.batting_strategy  || {};
  const bwls= data.bowling_strategy || {};
  const km = data.key_matchups_to_exploit || [];

  const tossHTML = `
    <div class="toss-recommendation">
      <div class="toss-icon">${data.toss_recommendation==="BAT FIRST"?"🏏":"🎯"}</div>
      <div class="toss-text-wrap">
        <div class="toss-label">TOSS STRATEGY RECOMMENDATION</div>
        <div class="toss-value">${data.toss_recommendation||"FIELD FIRST"}</div>
        <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim);margin-top:4px">Based on historical venue data (win% analysis)</div>
      </div>
    </div>`;

  const stratHTML = `
    <div class="strategy-grid">
      <div class="strategy-block">
        <div class="strat-title">🏏 BATTING GAMEPLAN</div>
        <div class="strat-phase">
          <div class="strat-item"><div class="strat-phase-label">POWERPLAY (1–6)</div><div class="strat-phase-text">${bs.powerplay||"—"}</div></div>
          <div class="strat-item"><div class="strat-phase-label">MIDDLE OVERS (7–15)</div><div class="strat-phase-text">${bs.middle_overs||"—"}</div></div>
          <div class="strat-item"><div class="strat-phase-label">DEATH OVERS (16–20)</div><div class="strat-phase-text">${bs.death_overs||"—"}</div></div>
        </div>
      </div>
      <div class="strategy-block">
        <div class="strat-title">⚾ BOWLING GAMEPLAN</div>
        <div class="strat-phase">
          <div class="strat-item"><div class="strat-phase-label">POWERPLAY (1–6)</div><div class="strat-phase-text">${bwls.powerplay||"—"}</div></div>
          <div class="strat-item"><div class="strat-phase-label">MIDDLE OVERS (7–15)</div><div class="strat-phase-text">${bwls.middle_overs||"—"}</div></div>
          <div class="strat-item"><div class="strat-phase-label">DEATH OVERS (16–20)</div><div class="strat-phase-text">${bwls.death_overs||"—"}</div></div>
        </div>
      </div>
    </div>`;

  let kmHTML = "";
  if (km.length) {
    const kmRows = km.map(m => `
      <div class="km-item">
        <div>
          <div class="km-bowler">⚾ ${m.bowler}</div>
          <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted)">BOWLER</div>
        </div>
        <div class="km-arrow">→</div>
        <div>
          <div class="km-batsman">${m.batsman}</div>
          <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted)">TARGET BATSMAN</div>
        </div>
        <div class="km-stat">
          ${m.wickets} wkts · p=${m.binomial_p_value}<br/>
          <span style="color:var(--text-muted)">${m.balls} balls · ${m.dot_ball_percentage}% dots</span>
        </div>
      </div>`).join("");

    kmHTML = `
      <div class="key-matchup-strat">
        <div class="section-label">KEY MATCHUPS TO EXPLOIT · Use These Bowler-Batsman Plans</div>
        ${kmRows}
      </div>`;
  }

  document.getElementById("strategyPanel").innerHTML = tossHTML + stratHTML + kmHTML;
}

// ── H2H Panel ────────────────────────────────────────────────
function renderH2H(data, t1, t2) {
  const yearly = (data.yearly_breakdown || []).filter(y=>y.matches>0);
  const recent = data.recent_meetings || [];
  const maxWins = Math.max(...yearly.map(y=>Math.max(y.t1_wins,y.t2_wins)), 1);

  const yearRows = yearly.map(y => `
    <div class="h2h-bar-row">
      <span class="h2h-bar-year">${y.year}</span>
      <div class="h2h-bar-t1" style="width:0px" data-target="${y.t1_wins*40/maxWins}px">${y.t1_wins}</div>
      <span class="h2h-bar-gap">·</span>
      <div class="h2h-bar-t2" style="width:0px" data-target="${y.t2_wins*40/maxWins}px">${y.t2_wins}</div>
    </div>`).join("");

  const recentRows = recent.map(m => {
    const margin = m.win_by_wickets > 0
      ? `${m.win_by_wickets} wkts`
      : m.win_by_runs > 0 ? `${m.win_by_runs} runs` : "—";
    return `
      <div class="match-row">
        <span class="match-date">${m.date||""}</span>
        <span class="match-winner">🏆 ${m.winner||"—"}</span>
        <span class="match-venue">${(m.venue||"").split(",")[0]}</span>
        <span class="match-margin">${margin}</span>
      </div>`;
  }).join("");

  document.getElementById("h2hPanel").innerHTML = `
    <div class="h2h-bar-chart">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-family:var(--font-mono);font-size:0.65rem;">
        <span style="color:#4da6ff">■ ${t1} (${data.team1_wins||0} wins)</span>
        <span style="color:#ff9944">■ ${t2} (${data.team2_wins||0} wins)</span>
      </div>
      <div class="h2h-bars">${yearRows}</div>
    </div>
    <div class="recent-matches">
      <div class="section-label" style="margin-bottom:12px">RECENT MEETINGS</div>
      ${recentRows || '<p style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem">No recent data.</p>'}
    </div>`;

  setTimeout(() => {
    document.querySelectorAll(".h2h-bar-t1, .h2h-bar-t2").forEach(el => {
      el.style.width = el.dataset.target;
    });
  }, 300);
}

// ── Tab switching ────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById("tab-" + tab.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}
