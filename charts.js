// ============================================================
//  charts.js – Particle background + canvas animations
// ============================================================

// ── Particle system ──────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3 - 0.1;
      this.r  = Math.random() * 1.5 + 0.3;
      this.a  = Math.random() * 0.6 + 0.1;
      this.hue= Math.random() > 0.7 ? 190 : 40; // cyan or gold
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.y < -10 || this.x < -10 || this.x > W + 10) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},100%,65%,${this.a})`;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = Array.from({length: 80}, () => new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,229,255,${0.08 * (1 - dist/120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  init();
  loop();
})();

// ── Confidence Gauge (mini SVG) ──────────────────────────────
function drawGauge(containerId, prob, label) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pct = Math.max(0, Math.min(1, prob));
  const angle = pct * 180;
  const cx = 60, cy = 60, r = 45;

  // Convert angle to x,y on arc
  const toRad = d => (d - 180) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(0));
  const y1 = cy + r * Math.sin(toRad(0));
  const x2 = cx + r * Math.cos(toRad(angle));
  const y2 = cy + r * Math.sin(toRad(angle));
  const large = angle > 90 ? 1 : 0;

  const color = pct > 0.6 ? "#00e676" : pct > 0.4 ? "#ffd740" : "#ff4444";

  el.innerHTML = `
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d="M15,60 A45,45 0 0,1 105,60" fill="none" stroke="#1e2d3d" stroke-width="8"/>
      <path d="M${cx+r*Math.cos(toRad(0))},${cy+r*Math.sin(toRad(0))} A${r},${r} 0 ${large},1 ${x2},${y2}"
            fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
      <text x="60" y="52" text-anchor="middle" font-family="'Space Mono',monospace"
            font-size="14" font-weight="bold" fill="${color}">${(pct*100).toFixed(0)}%</text>
      <text x="60" y="64" text-anchor="middle" font-family="'Barlow Condensed',sans-serif"
            font-size="9" fill="#607080">${label}</text>
    </svg>`;
}

// ── Animated number counter ───────────────────────────────────
function animateCount(el, target, duration=800, decimals=0) {
  if (!el) return;
  const start = 0, startTime = performance.now();
  function update(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const val = start + (target - start) * ease;
    el.textContent = decimals > 0 ? val.toFixed(decimals) : Math.round(val);
    if (t < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ── Score expectation chart (SVG bar) ────────────────────────
function renderScoreChart(t1Score, t2Score, t1Name, t2Name, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(t1Score, t2Score, 160) * 1.1;
  const pct1 = (t1Score / max) * 100;
  const pct2 = (t2Score / max) * 100;

  el.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim);margin-bottom:10px;letter-spacing:0.1em">EXPECTED SCORES · POISSON MODEL</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div>
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.7rem;margin-bottom:4px">
          <span style="color:#4da6ff">${t1Name}</span><span style="color:#ffd740">${Math.round(t1Score)}</span>
        </div>
        <div style="background:var(--bg3);border-radius:3px;height:10px;overflow:hidden">
          <div style="width:0%;height:100%;background:linear-gradient(90deg,#0066ff,#00aaff);border-radius:3px;transition:width 1s ease" data-w="${pct1}"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.7rem;margin-bottom:4px">
          <span style="color:#ff9944">${t2Name}</span><span style="color:#ffd740">${Math.round(t2Score)}</span>
        </div>
        <div style="background:var(--bg3);border-radius:3px;height:10px;overflow:hidden">
          <div style="width:0%;height:100%;background:linear-gradient(90deg,#ff6600,#ff9900);border-radius:3px;transition:width 1s ease" data-w="${pct2}"></div>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    el.querySelectorAll("[data-w]").forEach(bar => {
      bar.style.width = bar.dataset.w + "%";
    });
  }, 300);
}
