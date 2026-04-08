// ============================================================
//  app.js – Main application orchestrator
// ============================================================

(async function App() {

  // ── DOM refs ────────────────────────────────────────────────
  const selT1     = document.getElementById("sel-team1");
  const selT2     = document.getElementById("sel-team2");
  const selVenue  = document.getElementById("sel-venue");
  const badge1    = document.getElementById("badge1");
  const badge2    = document.getElementById("badge2");
  const card1     = document.getElementById("card-team1");
  const card2     = document.getElementById("card-team2");
  const analyseBtn= document.getElementById("analyseBtn");
  const dashboard = document.getElementById("dashboard");
  const loader    = document.getElementById("loader");
  const apiDot    = document.getElementById("apiDot");
  const apiStatus = document.getElementById("apiStatusText");

  // ── API status check ────────────────────────────────────────
  const online = await checkAPIStatus();
  if (online) {
    apiDot.className = "status-dot online";
    apiStatus.textContent = "R API Online · localhost:8000";
  } else {
    apiDot.className = "status-dot demo";
    apiStatus.textContent = "Demo Mode · R API offline";
  }

  // ── Load teams + venues ──────────────────────────────────────
  const [teamsData, venuesData] = await Promise.all([
    apiCall("/teams"),
    apiCall("/venues")
  ]);

  const teams  = teamsData.teams  || DEMO_TEAMS;
  const venues = venuesData.venues || DEMO_VENUES;

  teams.forEach(t => {
    [selT1, selT2].forEach(sel => {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
  });

  venues.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    selVenue.appendChild(opt);
  });

  // ── Team selection handlers ──────────────────────────────────
  function onTeamChange() {
    const t1 = selT1.value, t2 = selT2.value;
    badge1.textContent = t1 ? teamInitials(t1) : "?";
    badge2.textContent = t2 ? teamInitials(t2) : "?";
    badge1.className = "team-badge" + (t1 ? " active" : "");
    badge2.className = "team-badge" + (t2 ? " active" : "");
    card1.className  = "team-card"  + (t1 ? " selected" : "");
    card2.className  = "team-card"  + (t2 ? " selected" : "");
    analyseBtn.disabled = !(t1 && t2 && t1 !== t2);
  }

  selT1.addEventListener("change", onTeamChange);
  selT2.addEventListener("change", onTeamChange);

  // ── Init tabs ───────────────────────────────────────────────
  initTabs();

  // ── Loader helpers ───────────────────────────────────────────
  const LOAD_STEPS = [
    "Fetching head-to-head records…",
    "Computing Bayesian win probability (Beta distribution)…",
    "Running Poisson run-rate model (λ estimation)…",
    "Performing binomial matchup tests (α=0.05)…",
    "Building player impact scores…",
    "Generating strategic recommendations…"
  ];

  function showLoader() {
    loader.classList.remove("hidden");
    const stepsEl = document.getElementById("loaderSteps");
    stepsEl.innerHTML = LOAD_STEPS.map((s,i) =>
      `<div class="loader-step" id="lstep${i}">${s}</div>`).join("");
    LOAD_STEPS.forEach((_,i) => {
      setTimeout(() => {
        document.getElementById("lstep"+i)?.classList.add(i===0?"active":"done");
        if (i > 0) document.getElementById("lstep"+(i-1))?.classList.remove("active");
      }, i * 400);
    });
  }

  function hideLoader() {
    loader.classList.add("hidden");
  }

  // ── MAIN ANALYSE ACTION ──────────────────────────────────────
  analyseBtn.addEventListener("click", async () => {
    const t1    = selT1.value;
    const t2    = selT2.value;
    const venue = selVenue.value || "neutral";

    if (!t1 || !t2 || t1 === t2) return;

    // Show loader
    showLoader();
    document.getElementById("loaderText").textContent = `Analysing ${teamInitials(t1)} vs ${teamInitials(t2)}…`;

    // Update tab labels
    document.querySelector('[data-tab="squad1"]').textContent = `🏏 ${teamInitials(t1)} SQUAD`;
    document.querySelector('[data-tab="squad2"]').textContent = `🥎 ${teamInitials(t2)} SQUAD`;

    try {
      // Fetch all data in parallel
      const [pred, h2h, mu1, sq1, sq2, strat] = await Promise.all([
        apiCall("/predict",      "POST",   {team1:t1, team2:t2, venue}),
        apiCall("/head-to-head", "GET",    {team1:t1, team2:t2}),
        apiCall("/matchups",     "GET",    {team1:t1, team2:t2}),
        apiCall("/squad",        "GET",    {team:t1}),
        apiCall("/squad",        "GET",    {team:t2}),
        apiCall("/strategy",     "POST",   {team1:t1, team2:t2, venue})
      ]);

      // Small delay for loading animation
      await new Promise(r => setTimeout(r, 2400));
      hideLoader();

      // Show dashboard
      dashboard.classList.remove("hidden");
      setTimeout(() => dashboard.classList.add("visible"), 50);

      // Render all panels
      renderProbBar(pred, t1, t2);
      renderSummaryStats(pred, h2h, t1, t2);
      renderModelBreakdown(pred, t1, t2);
      renderMatchupTable(mu1, t1, t2);
      renderSquad(sq1, "squad1Grid", "squad1Label");
      renderSquad(sq2, "squad2Grid", "squad2Label");
      renderStrategy(strat, t1);
      renderH2H(h2h, t1, t2);

      // Scroll to dashboard
      setTimeout(() => {
        dashboard.scrollIntoView({behavior:"smooth", block:"start"});
      }, 400);

    } catch (err) {
      hideLoader();
      console.error("Analysis failed:", err);
      alert("Something went wrong. Please try again.");
    }
  });

  // ── Keyboard shortcut: Enter to analyse ─────────────────────
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && !analyseBtn.disabled) analyseBtn.click();
  });

})();
