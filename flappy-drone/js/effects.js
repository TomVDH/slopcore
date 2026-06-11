// effects.js — Flappy Drone particles, fireworks, nuke, pickups, vignette
// All functions attach to window.FD namespace.
// Uses: FD.ctx, FD.globalTick, FD.W, FD.H, FD.GROUND_H,
//       FD.particles, FD.fireworks, FD.pickups,
//       FD.nukeActive, FD.nukeStart, FD.nukeGx, FD.nukeGy, FD.screenShake

(function () {
  const FD = window.FD || (window.FD = {});

  // --- Nuke VFX config (shared with previews/33-nuke-vfx.html lab) ---
  // Defaults ship the full NOVA baseline: all layers ON except godRays
  // (stylistic, left OFF in lab) and novaShock (mutually exclusive with
  // the 'combo' shockwave default — auto-managed when shockStyle changes).
  FD.NUKE_FX = {
    // Stage
    whiteFlash: true, godRays: false, haze: true, trailHaze: true,
    // Shockwave — mutually exclusive with novaShock
    shockStyle: 'combo', // 'nova' | 'harmonic' | 'pulse' | 'refraction' | 'combo' | 'off'
    novaShock: false,    // auto-managed: true iff shockStyle === 'nova'
    // Stem
    midStem: true, wideStem: true, stemCore: true,
    // Cap
    capEdge: true, hotspots: true, cloudBands: true,
    // Ground
    baseFire: true, groundFires: true, baseGlow: true, baseRing: true,
    // Extra paired-particle layers (lifted from lab 33)
    capArcs: true, afterglow: true, fallout: true,
    // Per-system fade-in durations (ms)
    fadeInArcsMs:    400,
    fadeInFalloutMs: 2200,
    // Refinement pass 2026-06-10 — physically-inspired layers.
    // All stateless (pure functions of elapsed) so the lab scrubber works.
    flashDouble: true,    // bhangmeter double flash: snap → dip → thermal re-brighten
    ionRim: true,         // violet ionized-air rim on the early fireball
    wilsonRings: true,    // toroidal condensation rings around the rising cap
    cloudLightning: true, // cold intra-cloud flashes during the dark linger
    groundSurge: true,    // dust wall racing outward along the ground
    chromaFringe: true,   // RGB split on the refraction snap leading edge
    emberFlicker: true,   // ground fires breathe instead of static glow
    sound: true           // FD.nukeBoom() procedural audio (callers opt in by calling it)
  };

  // Deterministic hash for time-sliced effects (lightning slots, surge puffs).
  // Same input → same output, so the lab's timeline scrubber replays
  // identically and nothing pops when scrubbing backwards.
  function nukeHash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // --- Paired-particle arrays (used by spawnFallout / spawnCapArcs) ---
  FD.FALLOUT  = [];
  FD.CAP_ARCS = [];

  // --- Paired-particle pattern (from NOVA MK-V Lab) ---
  // Each call pushes a streak + a glow with shared kinematics. Optional
  // p.sizeScale multiplies radii for smaller/larger pairs.
  FD.pairedSpawn = function (arr, p) {
    const bornAt = performance.now();
    const S = p.sizeScale || 1;
    arr.push({
      kind: 'streak',
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      life: p.life, maxLife: p.maxLife,
      r: (2 + Math.random() * 1.5) * S,
      hue: 25 + Math.random() * 10, sat: 100, lum: 75,
      damping: p.damping, gravity: p.gravity,
      trail: [], bornAt, fadeKey: p.fadeKey, fadeCurve: p.fadeCurve
    });
    arr.push({
      kind: 'glow',
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      life: p.life, maxLife: p.maxLife,
      r: (15 + Math.random() * 20) * S,
      hue: 15 + Math.random() * 10, sat: 100, lum: 65,
      damping: p.damping, gravity: p.gravity,
      bornAt, fadeKey: p.fadeKey, fadeCurve: p.fadeCurve
    });
  };

  FD.updatePaired = function (arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life--;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      if (p.kind === 'streak') {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 12) p.trail.shift();
      }
      p.x += p.vx; p.y += p.vy;
      p.vx *= p.damping;
      p.vy = p.vy * p.damping + p.gravity;
    }
  };

  FD.drawPaired = function (arr) {
    const ctx = FD.ctx;
    const now = performance.now();
    for (const p of arr) {
      const t01 = p.life / p.maxLife;           // 1 fresh → 0 dead
      const fadeMs = (p.fadeKey && FD.NUKE_FX[p.fadeKey]) || 0;
      const age = now - (p.bornAt || now);
      const fadeInA = (fadeMs > 0 && age < fadeMs) ? (age / fadeMs) : 1;
      const curve = p.fadeCurve || 0.18;
      const fadeOutA = Math.pow(t01, curve);
      let aMul = fadeInA * fadeOutA;
      if (aMul < 0.02) continue;
      const age01 = 1 - t01;
      if (p.kind === 'glow') {
        ctx.save();
        const useAdd = p.lum > 70;
        if (useAdd) ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * t01);
        grad.addColorStop(0,    `hsla(${p.hue}, ${p.sat}%, ${p.lum}%, ${aMul * 0.8})`);
        grad.addColorStop(0.25, `hsla(${p.hue}, ${p.sat}%, ${p.lum - 10}%, ${aMul * 0.4})`);
        grad.addColorStop(0.6,  `hsla(${p.hue}, ${p.sat}%, ${p.lum - 25}%, ${aMul * 0.1})`);
        grad.addColorStop(1,    `hsla(${p.hue}, ${p.sat}%, ${p.lum - 30}%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t01, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        const sHue = p.hue - age01 * 18;
        const sSat = Math.max(20, p.sat - age01 * 70);
        const sLum = Math.max(12, p.lum + (1 - age01) * 20 - age01 * 30);
        if (p.trail.length > 1) {
          ctx.globalAlpha = aMul * 0.6;
          ctx.strokeStyle = `hsl(${sHue}, ${sSat * 0.7}%, ${sLum * 0.6}%)`;
          ctx.lineWidth = p.r * t01 * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let k = 1; k < p.trail.length; k++) ctx.lineTo(p.trail[k].x, p.trail[k].y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = aMul * 0.7;
        ctx.fillStyle = `hsl(${sHue}, ${sSat}%, ${Math.min(95, sLum + 15)}%)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t01 * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  };

  // --- Cap-center math (shared by fallout/capArcs/afterglow/trailHaze) ---
  // Matches the NOVA MK-V baseline: cloudT/5800, cubic-out ease, 0.05 drift.
  FD.capCenter = function () {
    const elapsedMs = performance.now() - FD.nukeStart;
    const H = FD.H;
    const cloudT   = Math.min(1, (elapsedMs - 100) / 5800);
    const riseEase = 1 - Math.pow(1 - Math.min(1, cloudT * 1.5), 3);
    const slowDrift = Math.min(1, elapsedMs / 14000) * H * 0.05;
    const cY      = FD.nukeGy - riseEase * (H * 0.5) - slowDrift;
    const capGrow = Math.min(1, cloudT * 2.5);
    const capR    = 50 + capGrow * 70;
    const capRx   = capR * 1.5;
    return { cY, capR, capRx, elapsedMs };
  };

  // --- Fallout: very sparse, slow, paired, fades in (lab 33 default OFF, ship ON) ---
  FD.spawnFallout = function () {
    if (!FD.NUKE_FX.fallout || !FD.nukeActive) return;
    const { cY, capR, capRx, elapsedMs } = FD.capCenter();
    if (elapsedMs < 1800 || elapsedMs > 12500) return;
    if (FD.FALLOUT.length > 80) return;
    if (Math.random() > 0.04) return;
    const px = FD.nukeGx + (Math.random() - 0.5) * capRx * 1.4;
    const py = cY + capR * (-0.05 + Math.random() * 0.35);
    const vy = 0.05 + Math.random() * 0.18;
    const vx = (Math.random() - 0.5) * 0.04;
    FD.pairedSpawn(FD.FALLOUT, {
      x: px, y: py, vx, vy,
      life: 6000 + Math.random() * 2400, maxLife: 8400,
      damping: 0.9995, gravity: 0.0008,
      fadeKey: 'fadeInFalloutMs',
      sizeScale: 0.22,   // much smaller than stem particles
      fadeCurve: 0.10    // very slow 100→0 fade-out
    });
  };

  // --- Cap-edge arcs: paired, mixed-speed, earlier start, shorter range ---
  FD.spawnCapArcs = function () {
    if (!FD.NUKE_FX.capArcs || !FD.nukeActive) return;
    const { cY, capR, capRx, elapsedMs } = FD.capCenter();
    if (elapsedMs < 700 || elapsedMs > 6500) return;
    if (FD.CAP_ARCS.length > 70) return;
    if (Math.random() > 0.20) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const pa = -Math.PI * 0.5 + dir * (0.05 + Math.random() * 0.55) * Math.PI * 0.5;
    const px = FD.nukeGx + Math.cos(pa) * capRx * (0.78 + Math.random() * 0.18);
    const py = cY        + Math.sin(pa) * capR  * (0.68 + Math.random() * 0.22);
    // Mixed velocities — three tiers: slow drift / medium / quick
    const tier = Math.random();
    let vx, vy;
    if (tier < 0.30) {        // slow drifters (~30%)
      vx = dir * (0.10 + Math.random() * 0.12);
      vy = -0.02 - Math.random() * 0.08;
    } else if (tier < 0.80) { // medium (~50%)
      vx = dir * (0.20 + Math.random() * 0.18);
      vy = -0.05 - Math.random() * 0.10;
    } else {                  // quick (~20%)
      vx = dir * (0.40 + Math.random() * 0.25);
      vy = -0.10 - Math.random() * 0.15;
    }
    FD.pairedSpawn(FD.CAP_ARCS, {
      x: px, y: py, vx, vy,
      life: 1600 + Math.random() * 500, maxLife: 2100,
      damping: 0.985, gravity: 0.0035,
      fadeKey: 'fadeInArcsMs'
    });
  };

  // --- Lingering cap-core afterglow (screen-blended, breathing) ---
  FD.drawCapAfterglow = function () {
    if (!FD.NUKE_FX.afterglow || !FD.nukeActive) return;
    const ctx = FD.ctx;
    const { cY, capRx, elapsedMs } = FD.capCenter();
    if (elapsedMs < 200) return;
    const ramp  = Math.min(1, (elapsedMs - 200) / 1300);
    const fadeT = elapsedMs > 12000 ? Math.min(1, (elapsedMs - 12000) / 2000) : 0;
    const decay = Math.pow(1 - Math.min(1, elapsedMs / 13500), 1.4);
    const baseA = ramp * decay * (1 - fadeT);
    if (baseA < 0.005) return;
    const breath = 0.85 + 0.15 * Math.sin(elapsedMs * 0.0014);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const outerR = capRx * 2.2;
    const og = ctx.createRadialGradient(FD.nukeGx, cY - capRx * 0.05, 0,
                                        FD.nukeGx, cY - capRx * 0.05, outerR);
    og.addColorStop(0,    `hsla(34,100%,70%,${baseA * 0.5  * breath})`);
    og.addColorStop(0.25, `hsla(28,100%,55%,${baseA * 0.28 * breath})`);
    og.addColorStop(0.6,  `hsla(20, 90%,40%,${baseA * 0.10 * breath})`);
    og.addColorStop(1,    `hsla(15, 80%,25%,0)`);
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(FD.nukeGx, cY - capRx * 0.05, outerR, 0, Math.PI * 2); ctx.fill();
    const innerR = capRx * 0.85;
    const ig = ctx.createRadialGradient(FD.nukeGx, cY - capRx * 0.1, 0,
                                        FD.nukeGx, cY - capRx * 0.1, innerR);
    ig.addColorStop(0,   `hsla(45,100%,82%,${baseA * 0.55 * breath})`);
    ig.addColorStop(0.4, `hsla(35,100%,58%,${baseA * 0.28 * breath})`);
    ig.addColorStop(1,   `hsla(25,100%,40%,0)`);
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(FD.nukeGx, cY - capRx * 0.1, innerR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // --- Cap-trailing sky haze — wide warm fog band behind the rising cap ---
  FD.drawCapTrailingHaze = function () {
    if (!FD.NUKE_FX.trailHaze || !FD.nukeActive) return;
    const ctx = FD.ctx;
    const { cY, capRx, elapsedMs } = FD.capCenter();
    if (elapsedMs < 1500) return;
    const W = FD.W;
    let intensity;
    if (elapsedMs < 5000) intensity = (elapsedMs - 1500) / 3500;
    else if (elapsedMs < 9000) intensity = 1;
    else if (elapsedMs < 13000) intensity = 1 - (elapsedMs - 9000) / 4000;
    else intensity = 0;
    intensity = Math.max(0, Math.min(1, intensity));
    if (intensity < 0.02) return;
    const climb = (FD.nukeGy - cY) / FD.H;
    const bandH = 140 + climb * 200;
    const bandCY = cY + capRx * 0.15;
    const bandTop = bandCY - bandH * 0.55;
    const bandBot = bandCY + bandH * 0.45;
    const hue = 22 + climb * 6;
    const sat = 28 + climb * 12;
    const lum = 28;
    const peakA = 0.34 * intensity;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createLinearGradient(0, bandTop, 0, bandBot);
    grad.addColorStop(0,   `hsla(${hue},${sat}%,${lum}%,0)`);
    grad.addColorStop(0.4, `hsla(${hue},${sat}%,${lum + 4}%,${peakA * 0.7})`);
    grad.addColorStop(0.6, `hsla(${hue},${sat}%,${lum + 6}%,${peakA})`);
    grad.addColorStop(1,   `hsla(${hue},${sat - 8}%,${lum - 4}%,0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandTop, W, bandBot - bandTop);
    const glowR = capRx * 4.0;
    const glowH = bandH * 0.6;
    const eg = ctx.createRadialGradient(FD.nukeGx, bandCY, 0,
                                        FD.nukeGx, bandCY, glowR);
    eg.addColorStop(0,   `hsla(${hue + 4},${sat + 8}%,${lum + 8}%,${peakA * 0.85})`);
    eg.addColorStop(0.5, `hsla(${hue},${sat}%,${lum + 4}%,${peakA * 0.35})`);
    eg.addColorStop(1,   `hsla(${hue - 4},${sat - 10}%,${lum}%,0)`);
    ctx.fillStyle = eg;
    ctx.save();
    ctx.translate(FD.nukeGx, bandCY);
    ctx.scale(1, glowH / glowR);
    ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  // --- Shockwave variants ('nova' handled inside drawNukeCloud; this draws the rest) ---
  FD.drawShockwave = function () {
    if (!FD.nukeActive) return;
    const style = FD.NUKE_FX.shockStyle;
    if (style === 'nova' || style === 'off') return;
    const ctx = FD.ctx;
    const elapsedMs = performance.now() - FD.nukeStart;
    if (elapsedMs < 80 || elapsedMs > 3800) return;
    const W = FD.W, H = FD.H;
    const gx = FD.nukeGx, gy = FD.nukeGy;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (style === 'harmonic') {
      [{ off: 0, peak: 0.55 }, { off: 220, peak: 0.32 }].forEach(r => {
        const local = elapsedMs - r.off;
        if (local < 0 || local > 2800) return;
        const t = local / 2800;
        const radius = t * Math.max(W, H) * 0.95;
        const a = (1 - t) * r.peak;
        ctx.strokeStyle = `rgba(255,210,140,${a})`;
        ctx.lineWidth = 2 + (1 - t) * 18;
        ctx.beginPath(); ctx.arc(gx, gy, radius, Math.PI, 0); ctx.stroke();
      });
    } else if (style === 'pulse') {
      const t = Math.min(1, (elapsedMs - 80) / 2200);
      const radius = t * Math.max(W, H) * 1.0;
      const a = (1 - t * t) * 0.6;
      const g = ctx.createRadialGradient(gx, gy, radius * 0.55, gx, gy, radius);
      g.addColorStop(0, `rgba(255,180,80,0)`);
      g.addColorStop(0.7, `rgba(255,150,60,${a * 0.6})`);
      g.addColorStop(1.0, `rgba(255,120,40,0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gx, gy, radius, Math.PI, 0); ctx.fill();
    } else if (style === 'refraction') {
      const t = Math.min(1, (elapsedMs - 80) / 2400);
      const radius = t * Math.max(W, H) * 0.95;
      const bandW = 26 + (1 - t) * 24;
      const a = (1 - t) * 0.7;
      if (FD.NUKE_FX.chromaFringe) {
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = `rgba(255,70,50,${a * 0.45})`;
        ctx.beginPath(); ctx.arc(gx, gy, radius + 4, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = `rgba(70,200,255,${a * 0.45})`;
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, radius - 4), Math.PI, 0); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255,235,200,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gx, gy, radius, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = `rgba(180,200,230,${a * 0.35})`;
      ctx.lineWidth = bandW;
      ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, radius - bandW * 0.6), Math.PI, 0); ctx.stroke();
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = `rgba(40,30,20,${a * 0.45})`;
      ctx.lineWidth = bandW * 0.7;
      ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, radius - bandW * 1.3), Math.PI, 0); ctx.stroke();
    } else if (style === 'combo') {
      // Phase 1 — refraction snap (~750 ms, alpha cap 0.50)
      if (elapsedMs >= 80 && elapsedMs <= 900) {
        const t1 = Math.min(1, (elapsedMs - 80) / 750);
        const radius = t1 * Math.max(W, H) * 0.95;
        const bandW = 22 + (1 - t1) * 20;
        const a = (1 - t1 * t1) * 0.50;
        if (FD.NUKE_FX.chromaFringe) {
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = `rgba(255,70,50,${a * 0.55})`;
          ctx.beginPath(); ctx.arc(gx, gy, radius + 3.5, Math.PI, 0); ctx.stroke();
          ctx.strokeStyle = `rgba(70,200,255,${a * 0.55})`;
          ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, radius - 3.5), Math.PI, 0); ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255,235,200,${a})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(gx, gy, radius, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = `rgba(180,200,230,${a * 0.35})`;
        ctx.lineWidth = bandW;
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, radius - bandW * 0.55), Math.PI, 0); ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = `rgba(40,30,20,${a * 0.5})`;
        ctx.lineWidth = bandW * 0.7;
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, radius - bandW * 1.25), Math.PI, 0); ctx.stroke();
        ctx.restore();
      }
      // Phase 2 — soft warm pulse bloom (500–3800 ms)
      if (elapsedMs >= 500 && elapsedMs <= 3800) {
        const t2 = Math.min(1, (elapsedMs - 500) / 3200);
        const radius = t2 * Math.max(W, H) * 1.05;
        const a = (1 - t2 * t2) * 0.65;
        const g = ctx.createRadialGradient(gx, gy, radius * 0.55, gx, gy, radius);
        g.addColorStop(0,   `rgba(255,180,80,0)`);
        g.addColorStop(0.6, `rgba(255,150,60,${a * 0.55})`);
        g.addColorStop(1,   `rgba(255,120,40,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(gx, gy, radius, Math.PI, 0); ctx.fill();
        const innerA = a * 0.4;
        const ig = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius * 0.5);
        ig.addColorStop(0, `rgba(255,200,120,${innerA})`);
        ig.addColorStop(1, `rgba(255,140,60,0)`);
        ctx.fillStyle = ig;
        ctx.beginPath(); ctx.arc(gx, gy, radius * 0.5, Math.PI, 0); ctx.fill();
      }
    }

    ctx.restore();
  };

  // --- Orchestrator: called once per frame by game / tester / city-lab ---
  // Handles spawn + update of paired arrays. Safe to call every frame —
  // internally gated by FD.nukeActive (for spawning) and always runs
  // update so existing particles finish their lifetime post-nuke.
  FD.tickNuke = function () {
    if (FD.nukeActive) {
      FD.spawnFallout();
      FD.spawnCapArcs();
    }
    FD.updatePaired(FD.FALLOUT);
    FD.updatePaired(FD.CAP_ARCS);
  };

  // --- Orchestrator: called by render pipeline to draw all non-cloud layers.
  // Caller still invokes FD.drawNukeCloud() directly — this handles the
  // auxiliary layers (trailHaze behind, afterglow / paired / shockwave in front).
  // Intended order: drawBehindNukeCloud() → drawNukeCloud() → drawInFrontNukeCloud()
  //
  // drawBehindNukeCloud uses a simple !nukeActive guard because trailHaze has
  // no particle array to drain. If a future behind-layer with stateful
  // particles is added, move it to drawInFrontNukeCloud or add its own drain
  // condition matching the drawInFrontNukeCloud pattern.
  FD.drawBehindNukeCloud = function () {
    if (!FD.nukeActive) return;
    FD.drawCapTrailingHaze();
  };
  FD.drawInFrontNukeCloud = function () {
    if (!FD.nukeActive && FD.FALLOUT.length === 0 && FD.CAP_ARCS.length === 0) return;
    FD.drawCapAfterglow();
    FD.drawPaired(FD.CAP_ARCS);
    FD.drawPaired(FD.FALLOUT);
    FD.drawShockwave();
  };

  // --- Procedural detonation audio (zero assets, lazy AudioContext) ---
  // Layers: crack transient → sub drop (110→22 Hz) → looped lowpassed
  // rumble with LFO sweep (~7 s tail) → distant echo crack at +0.65 s.
  // Gated by FD.NUKE_FX.sound. Callers opt in by invoking FD.nukeBoom()
  // from a user-gesture path (button / click) so autoplay policy is met.
  FD.nukeBoom = function () {
    if (!FD.NUKE_FX.sound) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!FD._audio) {
      const ac = new AC();
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      FD._audio = { ac, noise: buf };
    }
    const ac = FD._audio.ac, noise = FD._audio.noise;
    if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime + 0.02;
    const master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);

    // 1) crack — highpassed noise snap
    const crack = ac.createBufferSource(); crack.buffer = noise;
    const cHP = ac.createBiquadFilter(); cHP.type = 'highpass'; cHP.frequency.value = 900;
    const cG = ac.createGain();
    cG.gain.setValueAtTime(0.9, t0);
    cG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    crack.connect(cHP).connect(cG).connect(master);
    crack.start(t0); crack.stop(t0 + 0.25);

    // 2) sub drop — sine 110 → 22 Hz
    const sub = ac.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t0);
    sub.frequency.exponentialRampToValueAtTime(22, t0 + 1.3);
    const sG = ac.createGain();
    sG.gain.setValueAtTime(0.0001, t0);
    sG.gain.exponentialRampToValueAtTime(1.0, t0 + 0.04);
    sG.gain.exponentialRampToValueAtTime(0.001, t0 + 1.6);
    sub.connect(sG).connect(master);
    sub.start(t0); sub.stop(t0 + 1.7);

    // 3) rumble — looped noise through swept lowpass, breathing via LFO
    const rum = ac.createBufferSource(); rum.buffer = noise; rum.loop = true;
    const rLP = ac.createBiquadFilter(); rLP.type = 'lowpass'; rLP.Q.value = 0.8;
    rLP.frequency.setValueAtTime(160, t0);
    rLP.frequency.exponentialRampToValueAtTime(55, t0 + 6.5);
    const rLFO = ac.createOscillator(); rLFO.frequency.value = 0.9;
    const rLFOG = ac.createGain(); rLFOG.gain.value = 30;
    rLFO.connect(rLFOG).connect(rLP.frequency);
    const rG = ac.createGain();
    rG.gain.setValueAtTime(0.0001, t0);
    rG.gain.exponentialRampToValueAtTime(0.55, t0 + 0.35);
    rG.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.0);
    rum.connect(rLP).connect(rG).connect(master);
    rum.start(t0); rum.stop(t0 + 7.1);
    rLFO.start(t0); rLFO.stop(t0 + 7.1);

    // 4) distant echo crack — bandpassed, quiet, +0.65 s
    const ek = ac.createBufferSource(); ek.buffer = noise;
    const eBP = ac.createBiquadFilter(); eBP.type = 'bandpass'; eBP.frequency.value = 320; eBP.Q.value = 1.2;
    const eG = ac.createGain();
    eG.gain.setValueAtTime(0.0001, t0 + 0.65);
    eG.gain.exponentialRampToValueAtTime(0.28, t0 + 0.70);
    eG.gain.exponentialRampToValueAtTime(0.001, t0 + 1.9);
    ek.connect(eBP).connect(eG).connect(master);
    ek.start(t0 + 0.65); ek.stop(t0 + 2.0);
  };

  // --- Thrust particles ---
  FD.spawnThrust = function (droneX, droneY) {
    // Hot exhaust particles
    for (let i = 0; i < 8; i++) {
      FD.particles.push({
        x: droneX + (Math.random() - 0.5) * 8,
        y: droneY + 8 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 1.2,
        vy: Math.random() * 3 + 1,
        life: 10 + Math.random() * 8, maxLife: 18,
        r: Math.random() * 2 + 0.6,
        hue: 15 + Math.random() * 25, sat: 100, lum: 55 + Math.random() * 20
      });
    }
    // Bright blue spark flash — beneath the drone at thruster position
    FD.particles.push({
      x: droneX, y: droneY + 14,
      vx: 0, vy: 0.5,
      life: 8, maxLife: 8,
      r: 30,
      hue: 200, sat: 100, lum: 95,
      glow: true
    });
    // Inner white-blue core
    FD.particles.push({
      x: droneX, y: droneY + 14,
      vx: 0, vy: 0.3,
      life: 5, maxLife: 5,
      r: 12,
      hue: 210, sat: 80, lum: 98,
      glow: true
    });
    // Tiny white-hot glow
    FD.particles.push({
      x: droneX, y: droneY + 10,
      vx: 0, vy: 1,
      life: 4, maxLife: 4,
      r: 10,
      hue: 40, sat: 100, lum: 95,
      glow: true
    });
    // Larger warm glow
    FD.particles.push({
      x: droneX, y: droneY + 10,
      vx: 0, vy: 0.5,
      life: 8, maxLife: 8,
      r: 18,
      hue: 20, sat: 100, lum: 75,
      glow: true
    });
  };

  // --- Explosion ---
  FD.spawnExplosion = function (x, y) {
    // Shrapnel spray — 24 fast streak particles
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 7 + Math.random() * 3;
      FD.particles.push({
        x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 18 + Math.random() * 12, maxLife: 30,
        r: 1 + Math.random() * 2,
        hue: 15 + Math.random() * 30, sat: 100, lum: 55,
        damping: 0.96,
        streak: true
      });
    }
    // Bright glow flash
    FD.particles.push({
      x, y,
      vx: 0, vy: 0,
      life: 5, maxLife: 5,
      r: 35,
      hue: 30, sat: 100, lum: 97,
      glow: true
    });

    // 2-3 scattered offshoots — smaller secondary explosions nearby
    const offshootCount = 2 + Math.round(Math.random());
    for (let o = 0; o < offshootCount; o++) {
      const ox = x + (Math.random() - 0.5) * 60;
      const oy = y + (Math.random() - 0.5) * 40;
      const delay = 4 + Math.round(Math.random() * 8); // stagger slightly

      // Mini shrapnel burst (8 streaks each)
      for (let j = 0; j < 8; j++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 4 + Math.random() * 2;
        FD.particles.push({
          x: ox + (Math.random() - 0.5) * 3, y: oy + (Math.random() - 0.5) * 3,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: delay + 10 + Math.random() * 8, maxLife: delay + 18,
          r: 0.8 + Math.random() * 1.5,
          hue: 20 + Math.random() * 25, sat: 100, lum: 60,
          damping: 0.95,
          streak: true
        });
      }
      // Mini glow flash
      FD.particles.push({
        x: ox, y: oy,
        vx: 0, vy: 0,
        life: delay + 4, maxLife: delay + 4,
        r: 18,
        hue: 35, sat: 100, lum: 95,
        glow: true
      });
    }
  };

  // --- Draw particles (enhanced: trails, colour-cooling, additive blending) ---
  // Two-pass: call with isFg=false for background, isFg=true for foreground.
  FD.drawParticles = function (isFg) {
    const ctx = FD.ctx;
    const now = performance.now();
    // Temporarily scale p.life down during _fadeInMs window so the existing
    // alpha math (derived from p.life / p.maxLife) emerges as transparent
    // → opaque over the chosen duration. Restored after draw.
    const restore = [];
    for (const p of FD.particles) {
      if (p._fadeInMs && p._bornAt) {
        const age = now - p._bornAt;
        if (age < p._fadeInMs) {
          restore.push({ p, life: p.life });
          p.life = p.life * (age / p._fadeInMs);
        }
      }
    }
    FD.particles.forEach(p => {
      if (!!p.fg !== !!isFg) return;
      const t = p.life / p.maxLife;

      // Trail rendering (if particle has trail history)
      if (p.hasTrail && p.trailList && p.trailList.length > 1) {
        const age = p.maxLife - p.life;
        const trailAlpha = age < 90 ? (age / 90) * 0.6 : t * 0.6;
        ctx.globalAlpha = trailAlpha;
        ctx.strokeStyle = `hsla(${p.hue}, ${(p.sat || 100) * 0.7}%, ${(p.lum || 55) * 0.6}%, ${trailAlpha})`;
        ctx.lineWidth = p.r * t * 0.5;
        ctx.beginPath();
        p.trailList.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (p.glow) {
        // Additive blending for hot glow particles (lum > 70)
        var useAdditive = (p.lum || 55) > 70;
        if (useAdditive) ctx.globalCompositeOperation = 'lighter';
        // Ember flicker — per-particle phase/speed so fires breathe out of sync
        const am = (p.flicker && FD.NUKE_FX.emberFlicker)
          ? 0.70 + 0.30 * Math.sin(now * 0.008 * p.flicker + p.fphase)
          : 1;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * t);
        grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.lum}%, ${t * 0.8 * am})`);
        grad.addColorStop(0.25, `hsla(${p.hue}, ${p.sat}%, ${p.lum - 10}%, ${t * 0.4 * am})`);
        grad.addColorStop(0.6, `hsla(${p.hue}, ${p.sat}%, ${p.lum - 25}%, ${t * 0.1 * am})`);
        grad.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, ${p.lum - 30}%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2); ctx.fill();
        if (useAdditive) ctx.globalCompositeOperation = 'source-over';
      } else if (p.streak) {
        // Colour-cooling: bright → deep red → dark grey as particle ages
        const age01 = 1 - t;
        const sHue = p.hue - age01 * 18;
        const sSat = Math.max(20, (p.sat || 100) - age01 * 70);
        const sLum = Math.max(12, (p.lum || 55) + (1 - age01) * 20 - age01 * 30);
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = `hsl(${sHue}, ${sSat}%, ${sLum}%)`;
        ctx.lineWidth = p.r * t * 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = `hsl(${sHue}, ${sSat}%, ${Math.min(95, sLum + 15)}%)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t * 0.6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = t * 0.75;
        const sat = p.sat || 90, lum = p.lum || 55;
        ctx.fillStyle = `hsl(${p.hue}, ${sat}%, ${lum + (1 - t) * 20}%)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    // Restore any scaled-down lives
    for (const r of restore) r.p.life = r.life;
  };

  // --- Update particles (enhanced: trail tracking, depth switch, impact flashes) ---
  FD.updateParticles = function () {
    var groundY = FD.H - FD.GROUND_H;
    var flashes = [];
    var toFlash = [];
    // Pre-pass: tag + flash detection (must run before life-- decrements)
    FD.particles.forEach(function (p) {
      // Tag newly-spawned mid-stem streaks once. ~12% become camera-bound:
      // slower lateral motion, forward bias, radius grows with age to
      // simulate approaching the lens. Switched to foreground to render
      // on top of the city.
      if (p.streak && p.hasTrail && !p.fg && !p._tagged) {
        p._tagged = true;
        if (Math.random() < 0.12) {
          p._zoom = true;
          p._baseR = p.r;
          p.vx *= 0.35;
          p.vy *= 0.6;
          p.fg  = true;
        }
      }
      // End-of-life bright flash — ~55% of streaks pop into a burst.
      if (p.streak && p.hasTrail && p.life <= 1 && !p._flashed) {
        p._flashed = true;
        if (Math.random() < 0.55) toFlash.push({ x: p.x, y: p.y, fg: p.fg });
      }
    });
    // Grow camera-bound particles (linear with age, up to ~4×)
    FD.particles.forEach(function (p) {
      if (p._zoom && p._baseR) {
        const age = 1 - (p.life / p.maxLife);
        p.r = p._baseR * (1 + age * 3.0);
      }
    });
    // Main update (preserves existing ground-flash behaviour)
    FD.particles.forEach(p => {
      if (p.switchZ && p.life < p.maxLife * 0.65) p.fg = true;
      if (p.fg && p.y > groundY - 10 && p.life > 15 && Math.random() < 0.02) {
        p.life = 0;
        flashes.push({
          x: p.x, y: p.y, vx: 0, vy: -0.2,
          life: 8, maxLife: 8, r: 25 + Math.random() * 20,
          hue: 35, sat: 100, lum: 90, glow: true, fg: true
        });
      }
      if (p.hasTrail) {
        if (!p.trailList) p.trailList = [];
        p.trailList.push({ x: p.x, y: p.y });
        if (p.trailList.length > 20) p.trailList.shift();
      }
      p.x += p.vx; p.y += p.vy;
      p.vx *= (p.damping || 0.98);
      p.vy *= (p.damping || 0.98);
      p.vy += (p.gravity || 0.02);
      p.life--;
    });
    FD.particles = FD.particles.filter(p => p.life > 0);
    flashes.forEach(function (f) { FD.particles.push(f); });

    // End-of-life burst spawns for flagged streaks
    for (const f of toFlash) {
      // Hot white-yellow core — the initial pop
      FD.particles.push({
        x: f.x, y: f.y, vx: 0, vy: -0.03,
        life: 14, maxLife: 14, r: 20 + Math.random() * 8,
        hue: 46, sat: 100, lum: 98, glow: true, fg: f.fg
      });
      // Secondary warm halo that lingers a beat longer
      FD.particles.push({
        x: f.x, y: f.y, vx: 0, vy: 0,
        life: 22, maxLife: 22, r: 40 + Math.random() * 10,
        hue: 32, sat: 100, lum: 68, glow: true, fg: f.fg
      });
      // Quick bright snap (short-lived pinpoint highlight)
      FD.particles.push({
        x: f.x, y: f.y, vx: 0, vy: 0,
        life: 4, maxLife: 4, r: 8,
        hue: 55, sat: 80, lum: 100, glow: true, fg: f.fg
      });
      // Spark shower
      const sparks = 6 + ((Math.random() * 4) | 0);
      for (let s = 0; s < sparks; s++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 0.45 + Math.random() * 0.75;
        FD.particles.push({
          x: f.x, y: f.y,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: 14 + Math.random() * 8, maxLife: 22,
          r: 1.2 + Math.random() * 1.0,
          hue: 42 + Math.random() * 10, sat: 100, lum: 85,
          damping: 0.94, gravity: 0.004,
          streak: true, fg: f.fg
        });
      }
    }
  };

  // --- Fireworks update (does NOT auto-spawn; callers handle that) ---
  FD.updateFireworks = function () {
    FD.fireworks.forEach(fw => {
      if (!fw.exploded) {
        fw.y += fw.vy;
        fw.trail.push({ x: fw.x + (Math.random() - 0.5) * 2, y: fw.y });
        if (fw.trail.length > 12) fw.trail.shift();
        if (fw.y <= fw.targetY) {
          fw.exploded = true;
          // Willow cascade — particles droop with heavier gravity, streak trails
          const burstHues = [fw.hue, (fw.hue + 30) % 360, (fw.hue + 60) % 360];
          const count = [24, 40, 65][fw.size || 0];
          const spdMul = [0.9, 1.2, 1.8][fw.size || 0];
          const rMul = [1, 1.3, 2.0][fw.size || 0];
          const lifeMul = [1.5, 2.0, 2.8][fw.size || 0];
          for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 / count) * i + Math.random() * 0.35;
            const spd = (Math.random() * 2.5 + 1) * spdMul;
            FD.particles.push({
              x: fw.x, y: fw.y,
              vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 0.3,
              life: (35 + Math.random() * 30) * lifeMul, maxLife: 65 * lifeMul,
              r: (Math.random() * 2 + 1) * rMul,
              hue: burstHues[i % burstHues.length], sat: 100, lum: 55,
              damping: 0.97, gravity: 0.04,
              streak: true
            });
          }
          // Soft warm glow flash
          FD.particles.push({
            x: fw.x, y: fw.y,
            vx: 0, vy: 0,
            life: 10, maxLife: 10,
            r: 40 + (fw.size || 0) * 20,
            hue: fw.hue, sat: 80, lum: 85,
            glow: true
          });
        }
      }
    });
    FD.fireworks = FD.fireworks.filter(fw => !fw.exploded);
  };

  // --- Draw fireworks ---
  FD.drawFireworks = function () {
    const ctx = FD.ctx;
    FD.fireworks.forEach(fw => {
      if (fw.exploded) return;
      // Trail
      fw.trail.forEach((pt, i) => {
        ctx.globalAlpha = (i / fw.trail.length) * 0.6;
        ctx.fillStyle = `hsl(${fw.hue}, 80%, 70%)`;
        ctx.fillRect(pt.x, pt.y, 2, 2);
      });
      // Head
      ctx.globalAlpha = 1;
      ctx.fillStyle = `hsl(${fw.hue}, 90%, 85%)`;
      ctx.fillRect(fw.x - 1, fw.y - 1, 3, 3);
      ctx.globalAlpha = 1;
    });
  };

  // --- Nuke mushroom cloud: NOVA MK-V (14 s timeline, unified) ---
  // All effect blocks gated by FD.NUKE_FX.<key>. Lab patches baked in:
  // brighter cap-edge (earlier start + doubled rate), fattened stem/cap
  // particles, widened stem spawn column, stem ejecta dead-zone fix,
  // bezier-ribbon stem core rod, taller haze band, _fadeInMs tagging
  // on cap-edge. See docs/specs/2026-04-16-unify-design.md § 3 for the
  // full change log.
  FD.drawNukeCloud = function () {
    if (!FD.nukeActive) return;
    const ctx = FD.ctx;
    const W = FD.W, H = FD.H;
    const elapsed = performance.now() - FD.nukeStart;
    const totalMs = 14000;
    const gx = FD.nukeGx, gy = FD.nukeGy;
    const t = elapsed / 1000;

    if (elapsed < 100) { if (elapsed > totalMs) FD.nukeActive = false; return; }

    const cloudT = Math.min(1, (elapsed - 100) / 5800);
    const fadeT  = elapsed > 12000 ? Math.min(1, (elapsed - 12000) / 2000) : 0;
    const darkT  = elapsed > 3500 ? Math.min(1, (elapsed - 3500) / 4500) : 0;
    const alpha  = (1 - fadeT) * 0.95;
    if (alpha < 0.01) { if (elapsed > totalMs) FD.nukeActive = false; return; }
    ctx.globalAlpha = alpha;

    const riseEase = 1 - Math.pow(1 - Math.min(1, cloudT * 1.5), 3);
    const slowDrift = Math.min(1, elapsed / totalMs) * H * 0.05;
    const cY = gy - riseEase * (H * 0.5) - slowDrift;
    const capGrow = Math.min(1, cloudT * 2.5);
    const capR = 50 + capGrow * 70;
    const capRx = capR * 1.5;
    const hShift = darkT * 20;
    const lDrop  = darkT * 35;

    const drawNoisyEllipse = (cx, cy, rx, ry, iOff, flattenBottom) => {
      ctx.beginPath();
      for (let j = 0; j <= 60; j++) {
        const angle = (j / 60) * Math.PI * 2;
        const turb = Math.sin(angle * 12 + t * 0.6 + iOff) * 0.03 + Math.cos(angle * 7 - t * 0.5 + iOff * 2) * 0.04;
        const px = cx + Math.cos(angle) * rx * (1 + turb);
        const yDir = Math.sin(angle);
        const ryMult = (flattenBottom && yDir > 0) ? 0.55 : 1.0;
        const py = cy + yDir * ry * (1 + turb) * ryMult;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.fill();
    };

    // Thermal god rays (0-2.5s) — gated + dimmed + count halved
    if (elapsed < 2500 && FD.NUKE_FX.godRays) {
      const rayAlpha = (1 - (elapsed / 2500) ** 2) * 0.012;
      ctx.save();
      ctx.globalAlpha = rayAlpha;
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI + Math.PI;
        const sweep = Math.sin(t * 0.4 + i * 1.7) * 0.08;
        const fa = angle + sweep;
        const len = W * 0.8 + Math.sin(t * 1.2 + i * 3) * 40;
        const grad = ctx.createLinearGradient(gx, gy, gx + Math.cos(fa) * len, gy + Math.sin(fa) * len);
        grad.addColorStop(0, 'rgba(255,200,100,1)');
        grad.addColorStop(1, 'rgba(255,100,50,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(fa - 0.05) * len, gy + Math.sin(fa - 0.05) * len);
        ctx.lineTo(gx + Math.cos(fa + 0.05) * len, gy + Math.sin(fa + 0.05) * len);
        ctx.fill();
      }
      ctx.restore();
    }

    // NOVA shockwave + ground dust band — gated (disabled when combo/pulse/etc is active)
    if (elapsed > 200 && elapsed < 2800 && FD.NUKE_FX.novaShock) {
      const st = (elapsed - 200) / 2600;
      const radius = st * Math.max(W, H) * 0.9;
      ctx.globalAlpha = alpha * Math.max(0, 1 - st) * 0.4;
      ctx.strokeStyle = 'rgba(255,200,100,0.7)';
      ctx.lineWidth = 4 + (1 - st) * 15;
      ctx.beginPath(); ctx.arc(gx, gy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = alpha;
      const gw = st * W * 1.8, gh = 15 + st * 15;
      const lg = ctx.createLinearGradient(0, gy - gh, 0, gy);
      lg.addColorStop(0, 'rgba(200,160,120,0)');
      lg.addColorStop(1, `rgba(200,160,120,${(1 - st) * 0.6})`);
      ctx.fillStyle = lg;
      ctx.fillRect(gx - gw / 2, gy - gh, gw, gh);
    }

    // Hourglass stem with bezier necking
    const stemTopW = 25 + capGrow * 18;
    const stemBaseW = 45 + capGrow * 40;
    const neckPinch = stemTopW * 0.3;
    const stemGrad = ctx.createLinearGradient(gx, cY + capR * 0.3, gx, gy);
    stemGrad.addColorStop(0, `hsla(${25 - hShift},90%,${Math.max(10, 50 - lDrop)}%,${alpha})`);
    stemGrad.addColorStop(0.4, `hsla(${20 - hShift},85%,${Math.max(8, 40 - lDrop)}%,${alpha})`);
    stemGrad.addColorStop(1, `hsla(${15 - hShift},70%,${Math.max(5, 30 - lDrop)}%,${alpha})`);
    ctx.fillStyle = stemGrad;
    const midY = (cY + gy) / 2;
    const wobble = Math.sin(t * 1.2) * 12;
    ctx.beginPath();
    ctx.moveTo(gx - stemTopW / 2, cY + capR * 0.3);
    ctx.bezierCurveTo(gx - stemTopW * 0.6 + wobble, cY + (midY - cY) * 0.5, gx - stemTopW * 0.3 + wobble - neckPinch * 0.5, midY - 20, gx - stemTopW * 0.4 + wobble, midY);
    ctx.bezierCurveTo(gx - stemTopW * 0.5 + wobble + neckPinch * 0.3, midY + 20, gx - stemBaseW * 0.4, gy - 30, gx - stemBaseW / 2, gy);
    ctx.lineTo(gx + stemBaseW / 2, gy);
    ctx.bezierCurveTo(gx + stemBaseW * 0.4, gy - 30, gx + stemTopW * 0.5 + wobble + neckPinch * 0.3, midY + 20, gx + stemTopW * 0.4 + wobble, midY);
    ctx.bezierCurveTo(gx + stemTopW * 0.3 + wobble - neckPinch * 0.5, midY - 20, gx + stemTopW * 0.6 + wobble, cY + (midY - cY) * 0.5, gx + stemTopW / 2, cY + capR * 0.3);
    ctx.closePath(); ctx.fill();

    // Stem core glow — bezier ribbon that tracks the stem wobble
    const coreGlowA = alpha * Math.max(0, 0.5 - darkT * 0.4);
    if (coreGlowA > 0.01 && FD.NUKE_FX.stemCore) {
      const cg = ctx.createLinearGradient(gx, cY + capR * 0.3, gx, gy);
      cg.addColorStop(0, `hsla(40,100%,${Math.max(20, 65 - lDrop)}%,${coreGlowA})`);
      cg.addColorStop(1, `hsla(25,100%,${Math.max(10, 40 - lDrop)}%,${coreGlowA * 0.2})`);
      ctx.fillStyle = cg;
      // Bezier ribbon — mirrors stem wobble instead of staying pin-straight
      (() => {
        const halfW = stemTopW * 0.075;
        const topY  = cY + capR * 0.3;
        ctx.beginPath();
        ctx.moveTo(gx - halfW, topY);
        ctx.bezierCurveTo(
          gx - halfW + wobble * 0.65, topY + (midY - topY) * 0.5,
          gx - halfW + wobble * 0.55 - neckPinch * 0.3, midY - 18,
          gx - halfW + wobble * 0.45, midY
        );
        ctx.bezierCurveTo(
          gx - halfW + wobble * 0.40 + neckPinch * 0.2, midY + 18,
          gx - halfW * 0.9, gy - 24,
          gx - halfW * 0.85, gy
        );
        ctx.lineTo(gx + halfW * 0.85, gy);
        ctx.bezierCurveTo(
          gx + halfW * 0.9, gy - 24,
          gx + halfW + wobble * 0.40 + neckPinch * 0.2, midY + 18,
          gx + halfW + wobble * 0.45, midY
        );
        ctx.bezierCurveTo(
          gx + halfW + wobble * 0.55 - neckPinch * 0.3, midY - 18,
          gx + halfW + wobble * 0.65, topY + (midY - topY) * 0.5,
          gx + halfW, topY
        );
        ctx.closePath();
        ctx.fill();
      })();
    }

    // Base radial glow — gated
    if (FD.NUKE_FX.baseGlow) {
      const bgR = capRx * 2.2;
      const bgA = alpha * Math.max(0, 1 - (elapsed / 2000));
      const bg = ctx.createRadialGradient(gx, gy, 0, gx, gy, bgR);
      bg.addColorStop(0, `hsla(40,100%,80%,${bgA})`);
      bg.addColorStop(0.15, `hsla(30,100%,60%,${bgA * 0.5})`);
      bg.addColorStop(0.4, `hsla(20,100%,40%,${bgA * 0.1})`);
      bg.addColorStop(1, 'hsla(15,100%,20%,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(gx, gy, bgR, 0, Math.PI * 2); ctx.fill();
    }

    // Ground dust surge — two dust walls racing outward along the ground
    // with trailing wake, distinct from the optical shockwave. Puff
    // positions/sizes keyed by nukeHash so the lab scrubber replays
    // identically frame-to-frame.
    if (elapsed > 250 && elapsed < 2400 && FD.NUKE_FX.groundSurge) {
      const st = (elapsed - 250) / 2150;
      const surgeR = Math.pow(st, 0.62) * W * 0.52;
      const sFade = Math.pow(1 - st, 1.2) * 0.5;
      if (sFade > 0.012) {
        ctx.save();
        for (let k = 0; k < 6; k++) {
          const lag = k / 6;
          for (let dir = -1; dir <= 1; dir += 2) {
            const px = gx + dir * surgeR * (1 - lag * 0.38) + (nukeHash(k * 3.7 + dir) - 0.5) * 16;
            const puffR = (14 + nukeHash(k * 1.3 + dir * 7.1) * 16) * (0.7 + st * 0.9) * (1 - lag * 0.3);
            if (px < -puffR || px > W + puffR) continue;
            const py = gy - 3 - puffR * 0.25;
            const pa = sFade * (1 - lag * 0.55) * (0.6 + nukeHash(k * 9.1 + dir) * 0.4);
            const pg = ctx.createRadialGradient(px, py, 0, px, py, puffR);
            pg.addColorStop(0,   `hsla(26, 45%, 42%, ${pa})`);
            pg.addColorStop(0.5, `hsla(24, 40%, 32%, ${pa * 0.55})`);
            pg.addColorStop(1,   `hsla(22, 35%, 24%, 0)`);
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(px, py, puffR, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Sub-cloud at stem-cap intersection
    ctx.fillStyle = `hsla(${18 - hShift},85%,${Math.max(8, 35 - lDrop)}%,${alpha})`;
    drawNoisyEllipse(gx, cY + capR * 0.25, capRx * 0.75, capR * 0.4, 10, false);

    // Differential darkening
    const outerDark = Math.min(1, darkT * 1.4);
    const midDark   = darkT;
    const innerDark = Math.min(1, darkT * 0.6);
    const coreDark  = Math.min(1, darkT * 0.35);
    const outerHShift = outerDark * 22;
    const outerLDrop  = outerDark * 40;

    // 4 plasma cap layers
    ctx.fillStyle = `hsla(${8 - outerHShift},${90 - outerDark * 30}%,${Math.max(4, 22 - outerLDrop)}%,${alpha})`;
    drawNoisyEllipse(gx, cY, capRx * 1.0, capR * 0.95, 0, true);
    ctx.fillStyle = `hsla(${14 - midDark * 20},${92 - midDark * 20}%,${Math.max(6, 30 - midDark * 32)}%,${alpha})`;
    drawNoisyEllipse(gx, cY - capR * 0.03, capRx * 0.85, capR * 0.82, 1, true);
    ctx.fillStyle = `hsla(${25 - innerDark * 18},${95 - innerDark * 15}%,${Math.max(10, 42 - innerDark * 28)}%,${alpha})`;
    drawNoisyEllipse(gx, cY - capR * 0.06, capRx * 0.65, capR * 0.65, 2, true);
    ctx.fillStyle = `hsla(${40 - coreDark * 15},100%,${Math.max(15, 58 - coreDark * 25)}%,${alpha})`;
    drawNoisyEllipse(gx, cY - capR * 0.08, capRx * 0.45, capR * 0.45, 3, false);

    // Hot core
    const coreExtDk = elapsed > 6500 ? Math.min(1, (elapsed - 6500) / 2000) : 0;
    const coreA = alpha * Math.max(0.1, 1 - coreExtDk);
    ctx.fillStyle = `hsla(35,100%,${Math.max(15, 80 - coreExtDk * 60)}%,${coreA})`;
    drawNoisyEllipse(gx, cY - capR * 0.1, capRx * 0.25, capR * 0.25, 20, false);

    // Rolling hotspots — gated
    if (FD.NUKE_FX.hotspots) for (let hs = 0; hs < 4; hs++) {
      if (t < 0.5 + hs * 0.3 || darkT > 0.8) continue;
      const hsX = gx + Math.sin(t * 0.3 + hs * 2.5) * capRx * 0.4;
      const hsY = cY - capR * 0.05 + Math.cos(t * 0.25 + hs * 1.8) * capR * 0.25;
      const hsR = capR * 0.12 * (1 - darkT * 0.7);
      const hsA = alpha * 0.35 * (1 - darkT);
      const hsg = ctx.createRadialGradient(hsX, hsY, 0, hsX, hsY, hsR);
      hsg.addColorStop(0, `hsla(42,100%,72%,${hsA})`);
      hsg.addColorStop(0.5, `hsla(35,100%,55%,${hsA * 0.3})`);
      hsg.addColorStop(1, 'hsla(25,100%,40%,0)');
      ctx.fillStyle = hsg;
      ctx.beginPath(); ctx.arc(hsX, hsY, hsR, 0, Math.PI * 2); ctx.fill();
    }

    // Ionization rim — violet edge on the early fireball (air ionization),
    // a brief exotic colour note against the amber before the cap blooms.
    if (elapsed > 150 && elapsed < 1100 && FD.NUKE_FX.ionRim) {
      const it = (elapsed - 150) / 950;
      const iA = Math.sin(it * Math.PI) * 0.30;
      const iy = cY - capR * 0.05;
      const ir1 = capRx * 1.6;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const ig2 = ctx.createRadialGradient(gx, iy, capRx * 0.9, gx, iy, ir1);
      ig2.addColorStop(0,    'hsla(268, 90%, 64%, 0)');
      ig2.addColorStop(0.35, `hsla(268, 90%, 64%, ${iA})`);
      ig2.addColorStop(0.7,  `hsla(258, 85%, 58%, ${iA * 0.45})`);
      ig2.addColorStop(1,    'hsla(250, 80%, 50%, 0)');
      ctx.fillStyle = ig2;
      ctx.beginPath(); ctx.arc(gx, iy, ir1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Wilson condensation rings — stationary vapor sheaths the fireball
    // punches through as it rises (anchored to altitude, not to the cap).
    if (FD.NUKE_FX.wilsonRings) {
      for (let k = 0; k < 2; k++) {
        const local = (elapsed - (700 + k * 650)) / 800;
        if (local <= 0 || local >= 1) continue;
        const wA = Math.sin(local * Math.PI) * (0.34 - k * 0.08) * (1 - fadeT);
        const ringY = gy - H * (0.16 + k * 0.09);
        const rrx = capRx * (0.92 + local * 0.62);
        const rry = rrx * 0.30;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 1;
        for (let s = 0; s < 3; s++) {
          ctx.strokeStyle = `hsla(208, 35%, 88%, ${wA * (s === 1 ? 1 : 0.45)})`;
          ctx.lineWidth = (7 - local * 3.5) * (1 + s * 0.9);
          ctx.beginPath();
          ctx.ellipse(gx, ringY, rrx + s * 2, rry + s * 1.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Base ring / skirt — gated
    if (FD.NUKE_FX.baseRing) {
      ctx.fillStyle = `hsla(${15 - hShift},70%,${Math.max(5, 28 - lDrop)}%,${alpha * 0.8})`;
      drawNoisyEllipse(gx, cY + capR * 0.4, capRx * 1.15, capR * 0.22, 12, false);
    }

    // 3 cloud bands — gated
    if (FD.NUKE_FX.cloudBands) for (let i = 0; i < 3; i++) {
      const entryT = 0.15 + i * 0.15;
      if (cloudT < entryT) continue;
      const bandAge = Math.min(1, (cloudT - entryT) / 0.35);
      const t01 = i / 2;
      const finalY2 = cY - capR * (0.55 - t01 * 1.0) - 35;
      const startY = cY + capR * 0.5;
      const bandY = startY + (finalY2 - startY) * bandAge + Math.sin(t * (0.4 + i * 0.25) + i * 2.3) * capR * 0.03;
      const widthAtY = capRx * (0.6 + t01 * 0.8) * bandAge;
      const fade2 = (0.7 + t01 * 0.3) * bandAge;
      const pulse = 0.3 + 0.1 * Math.sin(t * (1.2 + i * 0.4) + i * 1.7);
      const bandAlpha = alpha * pulse * fade2;
      ctx.strokeStyle = `hsla(${24 - hShift + i * 3},75%,${Math.max(10, (44 - i * 4) - lDrop)}%,${bandAlpha})`;
      ctx.lineWidth = (4 + t01 * 2) * bandAge;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx - widthAtY, bandY);
      const sag1 = capR * 0.05 * Math.sin(t * (0.6 + i * 0.3) + i);
      const sag2 = capR * 0.04 * Math.sin(t * (0.5 + i * 0.2) + i + 1.5);
      ctx.quadraticCurveTo(gx - widthAtY * 0.35, bandY + sag1, gx, bandY + sag2);
      ctx.quadraticCurveTo(gx + widthAtY * 0.35, bandY - sag1, gx + widthAtY, bandY);
      ctx.stroke();
    }

    // Intra-cloud lightning — cold sheet flashes + jagged bolts inside the
    // cap during the dark linger. Slot schedule (~0.9 s) keyed by nukeHash
    // so the scrubber replays the same storm; seed varies per detonation
    // via ground-zero x.
    if (elapsed > 5500 && elapsed < 11500 && FD.NUKE_FX.cloudLightning && darkT > 0.3) {
      const seed = Math.floor(gx * 0.37);
      const slot = Math.floor((elapsed - 5500) / 900);
      const tIn  = (elapsed - 5500) % 900;
      if (nukeHash(slot * 7.31 + seed) < 0.62) {
        const fDur = 110 + nukeHash(slot * 3.7 + seed) * 90;
        if (tIn < fDur) {
          // storm grows in with the darkness — faint while the core still
          // glows, full strength once the cloud has gone near-black
          const dRamp = Math.min(1, (darkT - 0.3) / 0.5);
          const fA = Math.sin((tIn / fDur) * Math.PI) * (0.35 + 0.65 * dRamp);
          const lx = gx + (nukeHash(slot * 11.3 + seed) - 0.5) * capRx * 0.85;
          const ly = cY + (nukeHash(slot * 17.9 + seed) - 0.5) * capR * 0.55;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const lg2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, capR * 0.62);
          lg2.addColorStop(0,   `hsla(222, 70%, 82%, ${fA * 0.40})`);
          lg2.addColorStop(0.4, `hsla(225, 60%, 65%, ${fA * 0.18})`);
          lg2.addColorStop(1,   'hsla(228, 50%, 50%, 0)');
          ctx.fillStyle = lg2;
          ctx.beginPath(); ctx.arc(lx, ly, capR * 0.62, 0, Math.PI * 2); ctx.fill();
          // jagged bolt on ~60% of flashes — wide faint pass then hot core
          if (nukeHash(slot * 23.7 + seed) < 0.6) {
            ctx.globalCompositeOperation = 'lighter';
            const segs = 7;
            const bl = capR * (0.55 + nukeHash(slot * 5.5) * 0.4);
            let bx = lx, by = ly - bl * 0.45;
            const pts = [[bx, by]];
            for (let sg = 1; sg <= segs; sg++) {
              bx += (nukeHash(slot * 31.7 + sg * 13.1) - 0.5) * capR * 0.34;
              by += bl / segs;
              pts.push([bx, by]);
            }
            ctx.lineJoin = 'round';
            for (const pass of [[3.5, 0.22], [1.4, 0.85]]) {
              ctx.strokeStyle = `hsla(218, 80%, 88%, ${fA * pass[1]})`;
              ctx.lineWidth = pass[0];
              ctx.beginPath();
              ctx.moveTo(pts[0][0], pts[0][1]);
              for (let sg = 1; sg < pts.length; sg++) ctx.lineTo(pts[sg][0], pts[sg][1]);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
    }

    // === DEBRIS PARTICLES ===
    const highStemY = cY + (gy - cY) * 0.30;

    // Mid-stem outward debris — gated, 4 pairs, dead-zone fix, widened column,
    // bigger pvy kick, damping/gravity tuned for higher apex + longer travel
    if (elapsed > 200 && elapsed < 2000 && FD.NUKE_FX.midStem) {
      for (let i = 0; i < 4; i++) {
        if (FD.particles.length >= 300) break;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const px = gx + (Math.random() - 0.5) * 28;  // widened from 15
        const py = highStemY + (Math.random() - 0.5) * 30;
        // 25% go near-straight-up so the middle of the stem isn't a
        // dead zone between left+right fountains.
        const pvx = (Math.random() < 0.25
          ? (Math.random() - 0.5) * 0.06
          : dir * (0.08 + Math.random() * 0.20)
        ) * (FD.NUKE_FX.wideStem ? 1.8 : 1);
        const pvy = -0.85 - Math.random() * 0.75;  // bumped from -0.5-1.0 to -0.85-1.6
        const shortLived = Math.random() < 0.4;
        const plife = shortLived ? (300 + Math.random() * 400) : (800 + Math.random() * 800);
        const pmaxLife = shortLived ? 700 : 1600;
        const isFg = Math.random() < 0.45;
        FD.particles.push({
          x: px, y: py, vx: pvx, vy: pvy,
          life: plife, maxLife: pmaxLife, r: 2 + Math.random() * 1.5,
          hue: 25 + Math.random() * 10, sat: 100, lum: 75,
          damping: 0.9998, gravity: 0.0007, streak: true, hasTrail: true,
          fg: false, switchZ: isFg
        });
        FD.particles.push({
          x: px, y: py, vx: pvx, vy: pvy,
          life: plife, maxLife: pmaxLife, r: 15 + Math.random() * 20,
          hue: 15 + Math.random() * 10, sat: 100, lum: 65,
          damping: 0.9998, gravity: 0.0007, glow: true,
          fg: false, switchZ: isFg
        });
      }
    }

    // Cap-edge debris — earlier start (1200→100 ms), tail extended
    // (4000→4500 ms), rate doubled (0.2→0.42), inner loop 2→3, particles
    // fattened to match stem, tagged with _fadeInMs for gentle appearance.
    if (elapsed > 100 && elapsed < 4500 && Math.random() < 0.42 && FD.particles.length < 300 && FD.NUKE_FX.capEdge) {
      for (let ci = 0; ci < 3; ci++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const px = gx + dir * capRx * (0.5 + Math.random() * 0.4);
        const py = cY - capR * 0.1 + (Math.random() - 0.5) * capR * 0.3;
        const pvx = dir * (0.25 + Math.random() * 0.4) * (FD.NUKE_FX.wideStem ? 2.0 : 1);
        const pvy = -0.05 - Math.random() * 0.15;
        const plife = 600 + Math.random() * 500;
        const bornAt = performance.now();
        FD.particles.push({
          x: px, y: py, vx: pvx, vy: pvy, life: plife,
          maxLife: 1100, _fadeInMs: 1500, _bornAt: bornAt,
          r: 2 + Math.random() * 1.5,
          hue: 25 + Math.random() * 10, sat: 100, lum: 75,
          damping: 0.9993, gravity: 0.0014, streak: true, hasTrail: true, fg: true
        });
        FD.particles.push({
          x: px, y: py, vx: pvx, vy: pvy, life: plife,
          maxLife: 1100, _fadeInMs: 1500, _bornAt: bornAt,
          r: 15 + Math.random() * 20,
          hue: 15 + Math.random() * 10, sat: 100, lum: 65,
          damping: 0.9993, gravity: 0.0014, glow: true, fg: true
        });
      }
    }

    // Base fire — gated
    if (elapsed > 800 && elapsed < 4000 && Math.random() < 0.3 && FD.particles.length < 300 && FD.NUKE_FX.baseFire) {
      const bdir = Math.random() < 0.5 ? -1 : 1;
      FD.particles.push({
        x: gx + (Math.random() - 0.5) * stemBaseW * 1.5, y: gy - Math.random() * 10,
        vx: bdir * (0.05 + Math.random() * 0.15), vy: -0.05 - Math.random() * 0.15,
        life: 150 + Math.random() * 100, maxLife: 250, r: 20 + Math.random() * 30,
        hue: 20 + Math.random() * 15, sat: 60, lum: 35, damping: 0.9998, gravity: -0.0003, glow: true, fg: true,
        flicker: 0.5 + Math.random() * 0.7, fphase: Math.random() * 6.283
      });
    }

    // Ground fires — gated
    if (elapsed > 4000 && elapsed < 12000 && Math.random() < 0.08 && FD.particles.length < 500 && FD.NUKE_FX.groundFires) {
      FD.particles.push({
        x: gx + (Math.random() - 0.5) * W * 0.7, y: gy - 2 - Math.random() * 4,
        vx: (Math.random() - 0.5) * 0.05, vy: -0.02 - Math.random() * 0.04,
        life: 60 + Math.random() * 80, maxLife: 140, r: 3 + Math.random() * 5,
        hue: 25 + Math.random() * 15, sat: 100, lum: 55 + Math.random() * 20,
        damping: 0.999, gravity: -0.0002, glow: true, fg: true,
        flicker: 0.8 + Math.random() * 1.2, fphase: Math.random() * 6.283
      });
    }

    // Atmospheric ground haze — gated, height 60+90 (bumped from 40+50)
    if (elapsed > 400 && elapsed < 12500 && FD.NUKE_FX.haze) {
      const hazeT = elapsed < 1500 ? (elapsed - 400) / 1100 : elapsed < 9000 ? 1 : 1 - (elapsed - 9000) / 3500;
      const hazeH = 60 + hazeT * 90;
      const hazeA = hazeT * 0.55;
      ctx.save();
      const hg = ctx.createLinearGradient(0, gy - hazeH, 0, gy + 10);
      hg.addColorStop(0, `rgba(200,130,50,0)`);
      hg.addColorStop(0.3, `rgba(180,100,40,${hazeA * 0.2})`);
      hg.addColorStop(0.6, `rgba(160,80,30,${hazeA * 0.5})`);
      hg.addColorStop(1, `rgba(140,60,20,${hazeA})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, gy - hazeH, W, hazeH + 10);
      ctx.restore();
    }

    // Smoke trail children from streak particles
    FD.particles.forEach(function (p) {
      if (p.streak && p.hasTrail && p.life > 30 && p.life % 40 === 0 && FD.particles.length < 500) {
        FD.particles.push({
          x: p.x + (Math.random() - 0.5) * 3, y: p.y + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 0.03, vy: -0.01 - Math.random() * 0.02,
          life: 80 + Math.random() * 60, maxLife: 140, r: 5 + Math.random() * 8,
          hue: 20, sat: 30, lum: 25, damping: 0.9998, gravity: -0.0003, glow: true,
          fg: p.fg || false
        });
      }
    });

    ctx.globalAlpha = 1;

    // Shake
    if (elapsed < 1200) FD.screenShake = Math.max(FD.screenShake, 50 * (1 - elapsed / 1200));
    else if (elapsed < 4000) FD.screenShake = Math.max(FD.screenShake * 0.94, 0);

    if (elapsed > totalMs) FD.nukeActive = false;
  };

  // --- Nuke overlay: white flash (brighter + longer) + radial warm glow ---
  // White flash gated by FD.NUKE_FX.whiteFlash. Flash window expanded
  // from 0-300 ms (peak 0.95) to 0-650 ms (peak 1.6 clamped at 1). Radial
  // glow rise math unchanged (matches drawNukeCloud).
  FD.drawNukeOverlay = function () {
    if (!FD.nukeActive) return;
    const ctx = FD.ctx;
    const W = FD.W, H = FD.H;
    const elapsed = performance.now() - FD.nukeStart;
    const cloudT = Math.min(1, Math.max(0, elapsed - 100) / 3000);
    const riseEase = 1 - Math.pow(1 - Math.min(1, cloudT * 1.5), 3);
    const slowDriftOv = Math.min(1, elapsed / 11000) * H * 0.07;
    const cloudCenterY = FD.nukeGy - riseEase * (H * 0.45) - slowDriftOv;

    // Blinding white flash. flashDouble = bhangmeter double pulse: instant
    // snap (0-140 ms) → visible dip → slower warm thermal re-brighten
    // peaking ~500 ms, gone by ~1 s. Otherwise the single 650 ms curve.
    if (FD.NUKE_FX.whiteFlash) {
      if (FD.NUKE_FX.flashDouble && elapsed < 1000) {
        const p1 = elapsed < 140 ? Math.min(1, 1.7 * (1 - Math.pow(elapsed / 140, 1.6))) : 0;
        const p2 = 0.62 * Math.exp(-Math.pow((elapsed - 500) / 235, 2));
        const fa = Math.max(p1, p2);
        if (fa > 0.004) {
          ctx.globalAlpha = Math.min(1, fa);
          ctx.fillStyle = p2 > p1 ? '#fff3e2' : '#fff';
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      } else if (elapsed < 650) {
        const ft = elapsed / 650;
        ctx.globalAlpha = Math.min(1, (1 - ft * ft * ft) * 1.6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }

    // Warm radial glow (0-7s)
    if (elapsed < 7000) {
      const lt = elapsed / 7000;
      const intensity = (1 - lt * lt) * 0.45;
      const rad = Math.max(W, H) * 1.2;
      const radGrad = ctx.createRadialGradient(FD.nukeGx, cloudCenterY, 0, FD.nukeGx, cloudCenterY, rad);
      radGrad.addColorStop(0, `hsla(35, 100%, 65%, ${intensity})`);
      radGrad.addColorStop(0.3, `hsla(25, 100%, 45%, ${intensity * 0.5})`);
      radGrad.addColorStop(0.7, `hsla(20, 90%, 25%, ${intensity * 0.15})`);
      radGrad.addColorStop(1, 'hsla(15, 80%, 15%, 0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // --- Vignette ---
  FD.drawVignette = function () {
    const ctx = FD.ctx;
    const W = FD.W, H = FD.H;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };

  // --- Pickup type definitions ---
  FD.PICKUP_TYPES = [
    {
      id: 'nuke',
      label: 'NUKE',
      draw(x, y, r, tick) {
        const ctx = FD.ctx;
        const pulse = 1 + Math.sin(tick * 0.08) * 0.1;
        const pr = r * pulse;
        ctx.save();
        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, pr * 2.5);
        glow.addColorStop(0, 'rgba(255, 220, 0, 0.2)');
        glow.addColorStop(0.5, 'rgba(255, 160, 0, 0.08)');
        glow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, pr * 2.5, 0, Math.PI * 2); ctx.fill();
        // Outer ring
        ctx.strokeStyle = `rgba(255, 200, 0, ${0.7 + Math.sin(tick * 0.1) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.stroke();
        // Hazard trefoil
        ctx.fillStyle = '#ffcc00';
        const spin = tick * 0.02;
        for (let i = 0; i < 3; i++) {
          const a = spin + i * Math.PI * 2 / 3;
          const bx = x + Math.cos(a) * pr * 0.4;
          const by = y + Math.sin(a) * pr * 0.4;
          ctx.beginPath(); ctx.arc(bx, by, pr * 0.32, 0, Math.PI * 2); ctx.fill();
        }
        // Center dot
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(x, y, pr * 0.18, 0, Math.PI * 2); ctx.fill();
        // Mask gaps between trefoil lobes
        ctx.fillStyle = '#111';
        for (let i = 0; i < 3; i++) {
          const a = spin + i * Math.PI * 2 / 3 + Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.arc(x, y, pr * 0.7, a - 0.25, a + 0.25);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    },
    {
      id: 'shield',
      label: 'SHIELD',
      draw(x, y, r, tick) {
        const ctx = FD.ctx;
        const pulse = 1 + Math.sin(tick * 0.06) * 0.08;
        const pr = r * pulse;
        ctx.save();
        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, pr * 2.5);
        glow.addColorStop(0, 'rgba(0, 180, 255, 0.2)');
        glow.addColorStop(0.5, 'rgba(0, 120, 255, 0.08)');
        glow.addColorStop(1, 'rgba(0, 80, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, pr * 2.5, 0, Math.PI * 2); ctx.fill();
        // Outer shell
        ctx.strokeStyle = `rgba(80, 200, 255, ${0.6 + Math.sin(tick * 0.12) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.stroke();
        // Inner hexagon
        ctx.strokeStyle = 'rgba(150, 230, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = tick * 0.015 + i * Math.PI / 3;
          const px = x + Math.cos(a) * pr * 0.55;
          const py = y + Math.sin(a) * pr * 0.55;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
        // Core
        ctx.fillStyle = `rgba(180, 240, 255, ${0.5 + Math.sin(tick * 0.08) * 0.2})`;
        ctx.beginPath(); ctx.arc(x, y, pr * 0.2, 0, Math.PI * 2); ctx.fill();
        // Orbiting sparks
        for (let i = 0; i < 3; i++) {
          const a = tick * 0.04 + i * Math.PI * 2 / 3;
          const sx = x + Math.cos(a) * pr * 0.75;
          const sy = y + Math.sin(a) * pr * 0.75;
          ctx.fillStyle = 'rgba(200, 240, 255, 0.7)';
          ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    },
    {
      id: 'magnet',
      label: 'MAGNET',
      draw(x, y, r, tick) {
        const ctx = FD.ctx;
        const pulse = 1 + Math.sin(tick * 0.07) * 0.06;
        const pr = r * pulse;
        ctx.save();
        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, pr * 2.2);
        glow.addColorStop(0, 'rgba(255, 50, 80, 0.18)');
        glow.addColorStop(1, 'rgba(255, 50, 80, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, pr * 2.2, 0, Math.PI * 2); ctx.fill();
        // Horseshoe body
        ctx.strokeStyle = '#cc2233';
        ctx.lineWidth = pr * 0.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y - pr * 0.1, pr * 0.55, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        // Silver tips
        ctx.fillStyle = '#ccc';
        const la = Math.PI * 0.15, ra = Math.PI * 0.85;
        ctx.beginPath(); ctx.arc(x + Math.cos(la) * pr * 0.55, y - pr * 0.1 + Math.sin(la) * pr * 0.55, pr * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + Math.cos(ra) * pr * 0.55, y - pr * 0.1 + Math.sin(ra) * pr * 0.55, pr * 0.15, 0, Math.PI * 2); ctx.fill();
        // Field lines
        ctx.strokeStyle = `rgba(255, 100, 130, ${0.3 + Math.sin(tick * 0.1) * 0.15})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const fieldR = pr * (0.8 + i * 0.25) + Math.sin(tick * 0.06 + i) * 3;
          ctx.beginPath();
          ctx.arc(x, y - pr * 0.1, fieldR, Math.PI * 0.2, Math.PI * 0.8);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  ];

  // --- Spawn pickup ---
  FD.spawnPickup = function (typeId) {
    const W = FD.W, H = FD.H;
    const type = FD.PICKUP_TYPES.find(t => t.id === typeId) || FD.PICKUP_TYPES[0];
    const px = W * 0.3 + Math.random() * W * 0.4;
    const py = H * 0.2 + Math.random() * H * 0.35;
    FD.pickups.push({ type, x: px, y: py, r: 14, born: FD.globalTick });
    if (FD.pickups.length > 4) FD.pickups.shift();
  };

  // --- Draw pickups ---
  FD.drawPickups = function () {
    FD.pickups.forEach(p => {
      const age = FD.globalTick - p.born;
      const bobY = p.y + Math.sin(age * 0.03) * 6;
      p.type.draw(p.x, bobY, p.r, FD.globalTick);
    });
  };
  // ── Near-Miss Effect ────────────────────────────────────────
  // Shared component: call FD.triggerNearMiss(droneX, droneY, clearance)
  // then FD.updateNearMiss() each frame and FD.drawNearMiss() in render.
  FD.nearMissAlpha = 0;
  FD.nearMissText = '';
  FD.nearMissTimer = 0;
  FD.nearMissX = 0;
  FD.nearMissY = 0;

  FD.triggerNearMiss = function (droneX, droneY, clearance) {
    FD.nearMissText = clearance <= 10 ? 'RAZOR!' : 'CLOSE!';
    FD.nearMissAlpha = 1;
    FD.nearMissTimer = 0;
    FD.nearMissX = droneX;
    FD.nearMissY = droneY;

    var intensity = 1 - Math.max(0, (clearance - 5) / 35);
    var count = Math.round(4 + intensity * 4);
    for (var i = 0; i < count; i++) {
      FD.particles.push({
        x: droneX - 10 - i * 6,
        y: droneY + (Math.random() - 0.5) * 8,
        vx: -(1.5 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.5,
        life: 15 + Math.random() * 15, maxLife: 30,
        r: 1 + Math.random() * 1.5,
        hue: 190, sat: 100, lum: 70,
        streak: true
      });
    }
    for (var j = 0; j < 6; j++) {
      var a = Math.random() * Math.PI * 2;
      FD.particles.push({
        x: droneX + Math.cos(a) * 8,
        y: droneY + Math.sin(a) * 6,
        vx: Math.cos(a) * (1 + Math.random()),
        vy: Math.sin(a) * (1 + Math.random()),
        life: 12 + Math.random() * 10, maxLife: 22,
        r: 1 + Math.random(), hue: 180, sat: 80, lum: 80,
        glow: true
      });
    }
  };

  FD.updateNearMiss = function () {
    if (FD.nearMissAlpha <= 0) return;
    FD.nearMissTimer++;
    FD.nearMissAlpha = Math.max(0, 1 - FD.nearMissTimer / 30);
  };

  FD.drawNearMiss = function () {
    if (FD.nearMissAlpha <= 0.01) return;
    var ctx = FD.ctx, W = FD.W, H = FD.H;

    ctx.save();
    ctx.globalAlpha = FD.nearMissAlpha * 0.9;
    ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 8;
    ctx.fillText(FD.nearMissText, FD.nearMissX, FD.nearMissY - 25 - (FD.nearMissTimer * 0.5));
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

    var pulseAlpha = FD.nearMissAlpha * 0.12;
    var edgeGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.55);
    edgeGrad.addColorStop(0, 'rgba(0,212,255,0)');
    edgeGrad.addColorStop(1, 'rgba(0,212,255,' + pulseAlpha + ')');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 1;
    ctx.restore();
  };

  // ── Speed Indicator ─────────────────────────────────────────
  // Shared component: call FD.drawSpeedIndicator(speed) in render.
  // Pre-generated stable streak data.
  FD.speedStreaks = [];
  for (var si = 0; si < 80; si++) {
    FD.speedStreaks.push({
      y: Math.random() * FD.H,
      baseLen: 3 + Math.random() * 7,       // short dashes: 3-10px
      alpha: 0.06 + Math.random() * 0.12,
      lineW: 0.5 + Math.random() * 0.8,
      oscSpeed: 1.5 + Math.random() * 3,
      oscPhase: Math.random() * Math.PI * 2
    });
  }

  FD.drawSpeedIndicator = function (speed) {
    if (speed < 4.0) return;
    var ctx = FD.ctx, W = FD.W, H = FD.H;

    var intensity = Math.min(1, (speed - 4.0) / 8.0);
    var bandW = 20 + intensity * 12;         // narrow band: 20-32px
    var visibleCount = Math.round(6 + intensity * 24);

    // Always cyan-tinted — gets warmer orange only at extreme (12+)
    var cr, cg, cb;
    if (speed < 10) {
      cr = 0; cg = Math.round(200 + intensity * 55); cb = 255; // pure cyan
    } else {
      var warm = Math.min(1, (speed - 10) / 5);
      cr = Math.round(warm * 180); cg = Math.round(200 - warm * 60); cb = Math.round(255 - warm * 100);
    }

    ctx.save();
    var tick = FD.globalTick;
    // Left side only — dynamic speed lines streaming from the left edge
    for (var i = 0; i < visibleCount && i < 80; i++) {
        var s = FD.speedStreaks[i];
        var oscX = Math.sin(tick * s.oscSpeed * 0.02 + s.oscPhase) * bandW * 0.35;
        var len = s.baseLen * (0.5 + intensity * 0.5);
        var x1 = oscX + bandW * 0.15;

        ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (s.alpha * intensity) + ')';
        ctx.lineWidth = s.lineW;
        ctx.beginPath();
        ctx.moveTo(x1, s.y);
        ctx.lineTo(x1 + len, s.y);
        ctx.stroke();
    }
    ctx.restore();
  };
})();
