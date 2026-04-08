// ============================================================
//  api.js – R Plumber API communication layer
//  Falls back to SQUAD_DATA_2026 (from squad_data.js) if R offline
// ============================================================

const API_BASE = "http://localhost:8000";
let API_ONLINE = false;

// Use the real 2026 squad data (defined in squad_data.js)
// SQUAD_DATA_2026 is a global from that file

// ── Inline demo data (mirrors demo_data.R) ──────────────────
const DEMO_TEAMS = [
  "Chennai Super Kings","Mumbai Indians",
  "Royal Challengers Bengaluru","Kolkata Knight Riders",
  "Delhi Capitals","Punjab Kings","Rajasthan Royals",
  "Sunrisers Hyderabad","Lucknow Super Giants","Gujarat Titans"
];

const DEMO_VENUES = [
  "Wankhede Stadium, Mumbai",
  "M. A. Chidambaram Stadium, Chennai",
  "Eden Gardens, Kolkata",
  "M. Chinnaswamy Stadium, Bengaluru",
  "Arun Jaitley Stadium, Delhi",
  "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad",
  "Punjab Cricket Association IS Bindra Stadium, Mohali",
  "Sawai Mansingh Stadium, Jaipur",
  "Ekana Cricket Stadium, Lucknow",
  "Narendra Modi Stadium, Ahmedabad"
];

const H2H_MAP = {
  "Chennai Super Kings|Mumbai Indians":             {total:35,t1:16,t2:19},
  "Chennai Super Kings|Royal Challengers Bengaluru":{total:32,t1:21,t2:11},
  "Chennai Super Kings|Kolkata Knight Riders":      {total:29,t1:17,t2:12},
  "Chennai Super Kings|Rajasthan Royals":           {total:27,t1:15,t2:12},
  "Chennai Super Kings|Sunrisers Hyderabad":        {total:22,t1:12,t2:10},
  "Chennai Super Kings|Delhi Capitals":             {total:28,t1:18,t2:10},
  "Mumbai Indians|Royal Challengers Bengaluru":     {total:33,t1:20,t2:13},
  "Mumbai Indians|Kolkata Knight Riders":           {total:31,t1:18,t2:13},
  "Mumbai Indians|Rajasthan Royals":                {total:30,t1:20,t2:10},
  "Mumbai Indians|Delhi Capitals":                  {total:31,t1:21,t2:10},
  "Royal Challengers Bengaluru|Kolkata Knight Riders":{total:30,t1:14,t2:16},
  "Kolkata Knight Riders|Rajasthan Royals":         {total:28,t1:16,t2:12},
  "Kolkata Knight Riders|Sunrisers Hyderabad":      {total:24,t1:13,t2:11},
  "Rajasthan Royals|Sunrisers Hyderabad":           {total:18,t1:10,t2:8},
  "Sunrisers Hyderabad|Delhi Capitals":             {total:20,t1:11,t2:9}
};

function getH2H(t1, t2) {
  if (H2H_MAP[`${t1}|${t2}`]) return {rec:H2H_MAP[`${t1}|${t2}`], swapped:false};
  if (H2H_MAP[`${t2}|${t1}`]) return {rec:H2H_MAP[`${t2}|${t1}`], swapped:true};
  return {rec:{total:20,t1:10,t2:10}, swapped:false};
}

// Bayesian Beta posterior mean + CI
function bayesWinProb(wins, total) {
  const a = 2 + wins, b = 2 + (total - wins);
  const prob = a / (a + b);
  // Normal approx for CI (fine for a+b > 10)
  const se = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return { prob: +prob.toFixed(4), ci_low: +(prob - 1.96*se).toFixed(4),
           ci_high: +(prob + 1.96*se).toFixed(4), alpha: a, beta: b };
}

// Seeded pseudo-random (deterministic per team pair)
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}

function strSeed(str) { return [...str].reduce((a,c)=>a+c.charCodeAt(0),0); }

const SQUAD_DATA = {
  "Chennai Super Kings": [
    {player:"MS Dhoni",role:"WK-Batsman",age:43,nationality:"India"},
    {player:"Ruturaj Gaikwad",role:"Batsman",age:28,nationality:"India"},
    {player:"Ravindra Jadeja",role:"Allrounder",age:35,nationality:"India"},
    {player:"Deepak Chahar",role:"Bowler",age:32,nationality:"India"},
    {player:"Shivam Dube",role:"Allrounder",age:28,nationality:"India"},
    {player:"Matheesha Pathirana",role:"Bowler",age:22,nationality:"Sri Lanka"},
    {player:"Moeen Ali",role:"Allrounder",age:37,nationality:"England"},
    {player:"Devon Conway",role:"Batsman",age:33,nationality:"New Zealand"},
    {player:"Tushar Deshpande",role:"Bowler",age:29,nationality:"India"},
    {player:"Rachin Ravindra",role:"Batsman",age:25,nationality:"New Zealand"},
    {player:"Noor Ahmad",role:"Bowler",age:21,nationality:"Afghanistan"}
  ],
  "Mumbai Indians": [
    {player:"Rohit Sharma",role:"Batsman",age:38,nationality:"India"},
    {player:"Hardik Pandya",role:"Allrounder",age:31,nationality:"India"},
    {player:"Jasprit Bumrah",role:"Bowler",age:31,nationality:"India"},
    {player:"Suryakumar Yadav",role:"Batsman",age:34,nationality:"India"},
    {player:"Tilak Varma",role:"Batsman",age:22,nationality:"India"},
    {player:"Trent Boult",role:"Bowler",age:35,nationality:"New Zealand"},
    {player:"Naman Dhir",role:"Batsman",age:22,nationality:"India"},
    {player:"Ryan Rickelton",role:"WK-Batsman",age:25,nationality:"South Africa"},
    {player:"Will Jacks",role:"Allrounder",age:25,nationality:"England"},
    {player:"Allah Ghazanfar",role:"Bowler",age:19,nationality:"Afghanistan"}
  ],
  "Royal Challengers Bengaluru": [
    {player:"Virat Kohli",role:"Batsman",age:37,nationality:"India"},
    {player:"Rajat Patidar",role:"Batsman",age:31,nationality:"India"},
    {player:"Glenn Maxwell",role:"Allrounder",age:36,nationality:"Australia"},
    {player:"Josh Hazlewood",role:"Bowler",age:34,nationality:"Australia"},
    {player:"Mohammed Siraj",role:"Bowler",age:31,nationality:"India"},
    {player:"Liam Livingstone",role:"Allrounder",age:31,nationality:"England"},
    {player:"Phil Salt",role:"WK-Batsman",age:28,nationality:"England"},
    {player:"Yash Dayal",role:"Bowler",age:24,nationality:"India"},
    {player:"Krunal Pandya",role:"Allrounder",age:34,nationality:"India"},
    {player:"Tim David",role:"Batsman",age:29,nationality:"Singapore"}
  ],
  "Kolkata Knight Riders": [
    {player:"Shreyas Iyer",role:"Batsman",age:30,nationality:"India"},
    {player:"Sunil Narine",role:"Allrounder",age:36,nationality:"West Indies"},
    {player:"Andre Russell",role:"Allrounder",age:36,nationality:"West Indies"},
    {player:"Rinku Singh",role:"Batsman",age:27,nationality:"India"},
    {player:"Varun Chakravarthy",role:"Bowler",age:33,nationality:"India"},
    {player:"Mitchell Starc",role:"Bowler",age:35,nationality:"Australia"},
    {player:"Phil Salt",role:"WK-Batsman",age:28,nationality:"England"},
    {player:"Spencer Johnson",role:"Bowler",age:28,nationality:"Australia"},
    {player:"Harshit Rana",role:"Bowler",age:23,nationality:"India"},
    {player:"Quinton de Kock",role:"WK-Batsman",age:33,nationality:"South Africa"}
  ],
  "Delhi Capitals": [
    {player:"Axar Patel",role:"Allrounder",age:31,nationality:"India"},
    {player:"KL Rahul",role:"WK-Batsman",age:32,nationality:"India"},
    {player:"Faf du Plessis",role:"Batsman",age:41,nationality:"South Africa"},
    {player:"Kuldeep Yadav",role:"Bowler",age:30,nationality:"India"},
    {player:"Tristan Stubbs",role:"Batsman",age:23,nationality:"South Africa"},
    {player:"Jake Fraser-McGurk",role:"Batsman",age:22,nationality:"Australia"},
    {player:"Mukesh Kumar",role:"Bowler",age:28,nationality:"India"},
    {player:"Khaleel Ahmed",role:"Bowler",age:28,nationality:"India"},
    {player:"Mitchell Marsh",role:"Allrounder",age:33,nationality:"Australia"}
  ],
  "Punjab Kings": [
    {player:"Shikhar Dhawan",role:"Batsman",age:39,nationality:"India"},
    {player:"Arshdeep Singh",role:"Bowler",age:25,nationality:"India"},
    {player:"Sam Curran",role:"Allrounder",age:26,nationality:"England"},
    {player:"Jonny Bairstow",role:"WK-Batsman",age:35,nationality:"England"},
    {player:"Liam Livingstone",role:"Allrounder",age:31,nationality:"England"},
    {player:"Kagiso Rabada",role:"Bowler",age:29,nationality:"South Africa"},
    {player:"Prabhsimran Singh",role:"WK-Batsman",age:23,nationality:"India"},
    {player:"Harpreet Brar",role:"Allrounder",age:27,nationality:"India"},
    {player:"Harshal Patel",role:"Bowler",age:34,nationality:"India"},
    {player:"Rilee Rossouw",role:"Batsman",age:34,nationality:"South Africa"}
  ],
  "Rajasthan Royals": [
    {player:"Sanju Samson",role:"WK-Batsman",age:30,nationality:"India"},
    {player:"Jos Buttler",role:"Batsman",age:34,nationality:"England"},
    {player:"Yashasvi Jaiswal",role:"Batsman",age:23,nationality:"India"},
    {player:"Riyan Parag",role:"Allrounder",age:22,nationality:"India"},
    {player:"Yuzvendra Chahal",role:"Bowler",age:34,nationality:"India"},
    {player:"Jofra Archer",role:"Bowler",age:30,nationality:"England"},
    {player:"Shimron Hetmyer",role:"Batsman",age:27,nationality:"West Indies"},
    {player:"Ravichandran Ashwin",role:"Bowler",age:38,nationality:"India"},
    {player:"Dhruv Jurel",role:"WK-Batsman",age:23,nationality:"India"}
  ],
  "Sunrisers Hyderabad": [
    {player:"Pat Cummins",role:"Bowler",age:32,nationality:"Australia"},
    {player:"Heinrich Klaasen",role:"WK-Batsman",age:33,nationality:"South Africa"},
    {player:"Travis Head",role:"Batsman",age:31,nationality:"Australia"},
    {player:"Abhishek Sharma",role:"Batsman",age:24,nationality:"India"},
    {player:"Nitish Kumar Reddy",role:"Allrounder",age:21,nationality:"India"},
    {player:"Mohammed Shami",role:"Bowler",age:34,nationality:"India"},
    {player:"Bhuvneshwar Kumar",role:"Bowler",age:35,nationality:"India"},
    {player:"Washington Sundar",role:"Allrounder",age:25,nationality:"India"},
    {player:"Ishan Kishan",role:"WK-Batsman",age:27,nationality:"India"}
  ],
  "Lucknow Super Giants": [
    {player:"KL Rahul",role:"WK-Batsman",age:32,nationality:"India"},
    {player:"Nicholas Pooran",role:"WK-Batsman",age:28,nationality:"West Indies"},
    {player:"Ravi Bishnoi",role:"Bowler",age:24,nationality:"India"},
    {player:"Mohsin Khan",role:"Bowler",age:25,nationality:"India"},
    {player:"Avesh Khan",role:"Bowler",age:27,nationality:"India"},
    {player:"Marcus Stoinis",role:"Allrounder",age:35,nationality:"Australia"},
    {player:"Deepak Hooda",role:"Allrounder",age:29,nationality:"India"},
    {player:"Ayush Badoni",role:"Batsman",age:24,nationality:"India"},
    {player:"David Miller",role:"Batsman",age:35,nationality:"South Africa"}
  ],
  "Gujarat Titans": [
    {player:"Shubman Gill",role:"Batsman",age:25,nationality:"India"},
    {player:"Rashid Khan",role:"Bowler",age:26,nationality:"Afghanistan"},
    {player:"Mohammed Shami",role:"Bowler",age:34,nationality:"India"},
    {player:"David Miller",role:"Batsman",age:35,nationality:"South Africa"},
    {player:"Sai Sudharsan",role:"Batsman",age:23,nationality:"India"},
    {player:"Wriddhiman Saha",role:"WK-Batsman",age:40,nationality:"India"},
    {player:"Kane Williamson",role:"Batsman",age:34,nationality:"New Zealand"},
    {player:"Noor Ahmad",role:"Bowler",age:21,nationality:"Afghanistan"},
    {player:"Rahul Tewatia",role:"Allrounder",age:31,nationality:"India"}
  ]
};

// ── API check ────────────────────────────────────────────────
async function checkAPIStatus() {
  try {
    const r = await fetch(`${API_BASE}/teams`, {signal: AbortSignal.timeout(2000)});
    if (r.ok) { API_ONLINE = true; return true; }
  } catch {}
  API_ONLINE = false;
  return false;
}

// ── Generic API call with demo fallback ──────────────────────
async function apiCall(path, method="GET", params={}) {
  if (API_ONLINE) {
    try {
      let url = `${API_BASE}${path}`;
      if (method === "GET" && Object.keys(params).length) {
        url += "?" + new URLSearchParams(params);
      }
      const opts = {method, headers:{"Content-Type":"application/json"}};
      if (method === "POST") opts.body = JSON.stringify(params);
      const r = await fetch(url, opts);
      if (r.ok) return await r.json();
    } catch {}
  }
  // Fallback to demo
  return demoFallback(path, params);
}

// ── Demo fallback router ─────────────────────────────────────
function demoFallback(path, p) {
  if (path === "/teams")    return {teams: DEMO_TEAMS};
  if (path === "/venues")   return {venues: DEMO_VENUES};
  if (path === "/head-to-head") return demoH2H(p.team1, p.team2);
  if (path === "/predict")  return demoPredict(p.team1, p.team2, p.venue);
  if (path === "/matchups") return demoMatchups(p.team1, p.team2);
  if (path === "/squad")    return demoSquad(p.team);
  if (path === "/strategy") return demoStrategy(p.team1, p.team2, p.venue);
  return {};
}

function demoH2H(t1, t2) {
  const h = getH2H(t1, t2);
  const r = h.rec;
  const t1w = h.swapped ? r.t2 : r.t1;
  const t2w = h.swapped ? r.t1 : r.t2;
  const rng = seededRand(strSeed(t1+t2));
  const recent = [2021,2022,2023,2024,2025].map(y => ({
    date:`${y}-0${Math.floor(rng()*3)+4}-${10+Math.floor(rng()*20)}`,
    venue: DEMO_VENUES[Math.floor(rng()*DEMO_VENUES.length)],
    winner: rng() < t1w/r.total ? t1 : t2,
    win_by_runs: Math.floor(rng()*30),
    win_by_wickets: Math.floor(rng()*7)
  }));
  const yearly = [2019,2020,2021,2022,2023,2024].map(y => ({
    year:y, matches:2,
    t1_wins: Math.round(rng()+0.3),
    t2_wins: Math.round(rng()+0.3)
  }));
  return {
    team1:t1, team2:t2,
    total_matches:r.total, team1_wins:t1w, team2_wins:t2w, no_result:0,
    team1_win_prob: bayesWinProb(t1w, r.total),
    team2_win_prob: bayesWinProb(t2w, r.total),
    recent_meetings: recent,
    yearly_breakdown: yearly
  };
}

function demoPredict(t1, t2, venue) {
  const h = getH2H(t1, t2);
  const r = h.rec;
  const t1w = h.swapped ? r.t2 : r.t1;
  const bp1 = bayesWinProb(t1w, r.total);
  const rng = seededRand(strSeed(t1+t2+(venue||"")));
  const rr1 = 7.8 + rng()*0.9;
  const rr2 = 7.7 + rng()*0.9;
  const vf = 0.48 + rng()*0.08;
  const raw = 0.4*bp1.prob + 0.25*vf + 0.35*(rr1/(rr1+rr2));
  return {
    team1:t1, team2:t2, venue,
    team1_win_probability: +raw.toFixed(4),
    team2_win_probability: +(1-raw).toFixed(4),
    team1_expected_score: +(rr1*20).toFixed(1),
    team2_expected_score: +(rr2*20).toFixed(1),
    team1_run_rate_lambda: +rr1.toFixed(3),
    team2_run_rate_lambda: +rr2.toFixed(3),
    bayesian_h2h: bp1,
    venue_factor_team1:{win_rate:+vf.toFixed(3),matches:12},
    venue_factor_team2:{win_rate:+(1-vf).toFixed(3),matches:12},
    model_weights:{h2h:0.40,venue:0.25,runs:0.35}
  };
}

function demoMatchups(t1, t2) {
  const sq1 = SQUAD_DATA[t1] || [];
  const sq2 = SQUAD_DATA[t2] || [];
  const bats = sq1.filter(p=>["Batsman","WK-Batsman","Allrounder"].includes(p.role)).map(p=>p.player);
  const bwls = sq2.filter(p=>["Bowler","Allrounder"].includes(p.role)).map(p=>p.player);
  const rng = seededRand(strSeed(t1+t2));
  const matchups = [];
  for (const bwl of bwls.slice(0,5)) {
    for (const bat of bats.slice(0,6)) {
      const balls = 12 + Math.floor(rng()*50);
      const runs  = Math.round(balls*(0.7+rng()*1.1));
      const wkts  = Math.floor(rng()*3.5);
      const dp    = +(25+rng()*22).toFixed(1);
      const pval  = +(0.01+rng()*0.45).toFixed(3);
      const sig   = wkts>=2 && pval<0.05;
      matchups.push({
        bowler:bwl, batsman:bat, balls, runs, wickets:wkts,
        strike_rate_for_bowler: wkts>0?+(balls/wkts).toFixed(1):999,
        batting_avg_in_matchup:  wkts>0?+(runs/wkts).toFixed(1):runs,
        dot_ball_percentage: dp,
        binomial_p_value: pval,
        statistically_dominant: sig,
        advantage: sig?"BOWLER":(runs/Math.max(wkts,1)>35?"BATSMAN":"NEUTRAL")
      });
    }
  }
  matchups.sort((a,b)=>b.wickets-a.wickets||a.binomial_p_value-b.binomial_p_value);
  return {team1:t1, team2:t2, matchups};
}

function demoSquad(team) {
  const sq = SQUAD_DATA[team] || [];
  const rng = seededRand(strSeed(team));
  const stats = sq.map(p => {
    const role = p.role;
    const isBat = ["Batsman","WK-Batsman"].includes(role);
    const isBwl = role === "Bowler";
    const isAll = role === "Allrounder";
    const innings = 40+Math.floor(rng()*100);
    const avg_bat = isBat?+(25+rng()*30).toFixed(1):isAll?+(15+rng()*22).toFixed(1):+(5+rng()*15).toFixed(1);
    const sr_bat  = isBat?+(120+rng()*45).toFixed(1):isAll?+(125+rng()*50).toFixed(1):+(95+rng()*45).toFixed(1);
    const wkts    = isBwl?30+Math.floor(rng()*170):isAll?15+Math.floor(rng()*80):Math.floor(rng()*10);
    const econ    = (isBwl||isAll)?+(6.5+rng()*3.2).toFixed(2):null;
    const avg_bwl = (isBwl||isAll)?+(18+rng()*22).toFixed(1):null;

    const bScore = 0.5*avg_bat/50 + 0.5*sr_bat/150;
    const bwlScore = avg_bwl?(0.4*(1-Math.min(avg_bwl/50,1))+0.3*(1-Math.min(econ/12,1))+0.3*Math.min(wkts/30,1)):0;
    const w = isBat?[0.85,0.15]:isBwl?[0.15,0.85]:[0.5,0.5];
    const impact = +Math.min((w[0]*bScore+w[1]*bwlScore)*100,100).toFixed(1);

    return {
      player:p.player, role:p.role, age:p.age, nationality:p.nationality,
      batting:{innings,runs:Math.round(avg_bat*innings*0.6),average:avg_bat,strike_rate:sr_bat},
      bowling:{wickets:wkts, economy:econ, average:avg_bwl},
      impact_score:impact
    };
  });
  return {team, squad:stats};
}

function demoStrategy(t1, t2, venue) {
  const rng = seededRand(strSeed(t1+t2+(venue||"")));
  const toss = rng() > 0.5 ? "BAT FIRST" : "FIELD FIRST";
  const mu = demoMatchups(t1,t2);
  const keyMU = mu.matchups.filter(m=>m.advantage==="BOWLER").slice(0,3);
  return {
    team:t1,
    toss_recommendation: toss,
    batting_strategy:{
      powerplay:"Target 50+ runs. Aggressive openers should take on pace bowling.",
      middle_overs:"Rotate strike, preserve wickets, attack spinners in their weak zones.",
      death_overs:"Set targets above 170 with pre-decided big hitters at 6-8."
    },
    bowling_strategy:{
      powerplay:"Swing bowling with slips cordon. Keep 2 fielders inside the ring.",
      middle_overs:"Deploy spinners to create pressure. Use matchup data to bowl to plans.",
      death_overs:"Yorkers and slower balls to identified weak zones of dangerous hitters."
    },
    key_matchups_to_exploit: keyMU
  };
}
