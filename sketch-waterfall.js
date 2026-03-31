/**
 * Color waterfall — falling HSB stream with mouse/touch “splash” response,
 * plus alchemical sparks and ring bursts when the stream is disturbed.
 */
window.motionSketches = window.motionSketches || {};
window.motionSketches.waterfall = new p5((p) => {
  const STREAM = 1900;
  const SPLASH_CAP = 520;
  const SPARK_CAP = 480;
  const BURST_CAP = 36;
  let stream = [];
  let splashes = [];
  let sparks = [];
  let bursts = [];
  let pmouse = { x: 0, y: 0 };
  let huePhase = 0;

  function spawnStream(i) {
    const col = (i * 0.73) % p.width;
    return {
      x: col + p.sin(i * 0.31 + huePhase) * 12 + p.random(-4, 4),
      y: p.random(-p.height * 1.2, 40),
      vx: p.random(-0.35, 0.35),
      vy: p.random(2.6, 6.2),
      r: p.random(2.2, 5.2),
      hue: (i * 0.22 + huePhase * 40 + p.random(-15, 15)) % 360,
      sat: p.random(92, 100),
    };
  }

  p.setup = () => {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight, p.P2D);
    cnv.parent("slide-waterfall");
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    stream = [];
    for (let i = 0; i < STREAM; i++) {
      stream.push(spawnStream(i));
    }
    pmouse.x = p.mouseX;
    pmouse.y = p.mouseY;
  };

  function pushSplash(x, y, hue, mdx, mdy) {
    if (splashes.length >= SPLASH_CAP) return;
    const n = p.floor(p.random(5, 13));
    for (let k = 0; k < n; k++) {
      splashes.push({
        x: x + p.random(-5, 5),
        y: y + p.random(-5, 5),
        vx: p.random(-9, 9) + mdx * 0.16,
        vy: p.random(-13, 4) + mdy * 0.16,
        life: p.random(32, 62),
        r: p.random(1.4, 5),
        hue: (hue + p.random(-25, 25)) % 360,
      });
    }
  }

  function pushSparks(x, y, baseHue, mdx, mdy, intensity) {
    if (sparks.length >= SPARK_CAP) return;
    const n = p.floor(p.map(p.constrain(intensity, 0, 45), 0, 45, 5, 22, true));
    for (let k = 0; k < n; k++) {
      const ang = p.random(p.TWO_PI);
      const sp = p.random(5, 16 + intensity * 0.55);
      const gold = p.random() < 0.35 ? 38 : baseHue;
      const life0 = p.random(10, 26);
      sparks.push({
        x: x + p.random(-6, 6),
        y: y + p.random(-6, 6),
        vx: p.cos(ang) * sp + mdx * 0.18,
        vy: p.sin(ang) * sp + mdy * 0.18,
        life: life0,
        maxLife: life0,
        hue: (gold + p.random(-50, 50) + k * 11) % 360,
        w: p.random(0.9, 2.8),
      });
    }
  }

  function pushBurst(x, y, hue) {
    if (bursts.length >= BURST_CAP) return;
    const life0 = p.random(14, 22);
    bursts.push({
      x,
      y,
      r: p.random(6, 14),
      life: life0,
      maxLife: life0,
      hue: (hue + p.random(-30, 30)) % 360,
    });
  }

  p.draw = () => {
    huePhase += 0.003;
    p.background(248, 58, 14);

    const mx = p.mouseX;
    const my = p.mouseY;
    const mdx = mx - pmouse.x;
    const mdy = my - pmouse.y;
    const ms = p.sqrt(mdx * mdx + mdy * mdy);
    pmouse.x = mx;
    pmouse.y = my;

    p.strokeWeight(1);
    for (let gy = 0; gy < p.height; gy += 5) {
      const t = (gy + p.frameCount * 2.4) * 0.008;
      const h = (p.sin(t) * 60 + 180 + huePhase * 50) % 360;
      p.stroke(h, 62, 48, 26);
      p.line(0, gy, p.width, gy);
    }
    p.noStroke();

    for (let i = 0; i < stream.length; i++) {
      let o = stream[i];
      o.vy += 0.11;
      o.x += o.vx + p.sin(o.y * 0.01 + i * 0.02) * 0.15;
      o.y += o.vy;
      o.vx *= 0.998;
      o.hue = (o.hue + 0.15 + p.sin(p.frameCount * 0.01 + i * 0.01)) % 360;

      const d = p.dist(o.x, o.y, mx, my);
      const brush = p.map(d, 0, 140, 1, 0, true);
      const touching = p.touches && p.touches.length > 0;
      if (brush > 0 && (ms > 0.35 || p.mouseIsPressed || touching)) {
        const pushAmt = brush * (1.05 + ms * 0.055);
        const nx = d > 0.01 ? (o.x - mx) / d : p.random(-1, 1);
        const ny = d > 0.01 ? (o.y - my) / d : p.random(-1, 1);
        o.vx += nx * pushAmt * 3.9 + mdx * 0.08 * brush;
        o.vy += ny * pushAmt * 3.0 + mdy * 0.08 * brush;
        if (d < 62 && p.random() < 0.48 + ms * 0.028) {
          pushSplash(o.x, o.y, o.hue, mdx, mdy);
          const snag = brush * ms;
          if (p.random() < 0.42 + ms * 0.018) {
            pushSparks(o.x, o.y, o.hue, mdx, mdy, snag);
          }
          if (p.random() < 0.22 + ms * 0.012) {
            pushBurst(mx, my, o.hue);
          }
        }
      }

      if (o.y > p.height + 30) {
        stream[i] = spawnStream(i);
      }

      const alpha = p.map(o.vy, 2, 12, 72, 100, true);
      p.fill(o.hue, o.sat, 100, alpha);
      p.circle(o.x, o.y, o.r);
      p.fill((o.hue + 12) % 360, o.sat, 100, alpha * 0.62);
      p.circle(o.x - o.r * 0.2, o.y - o.r * 0.2, o.r * 0.45);
    }

    for (let j = splashes.length - 1; j >= 0; j--) {
      const s = splashes[j];
      s.vy += 0.32;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.94;
      s.life -= 1;
      const a = p.map(s.life, 0, 65, 0, 100, true);
      p.fill(s.hue, 98, 100, a);
      p.circle(s.x, s.y, s.r * (0.6 + s.life * 0.01));
      if (s.life <= 0) {
        splashes.splice(j, 1);
      }
    }

    for (let b = bursts.length - 1; b >= 0; b--) {
      const u = bursts[b];
      u.life -= 1;
      u.r += 5.5 + u.life * 0.35;
      const ua = p.map(u.life, 0, u.maxLife, 0, 72, true);
      p.noFill();
      p.stroke(u.hue, 82, 100, ua);
      p.strokeWeight(1.5 + (1 - u.life / u.maxLife) * 2);
      p.circle(u.x, u.y, u.r);
      p.stroke((u.hue + 40) % 360, 60, 100, ua * 0.45);
      p.strokeWeight(1);
      p.circle(u.x, u.y, u.r * 0.72);
      p.noStroke();
      if (u.life <= 0) {
        bursts.splice(b, 1);
      }
    }

    for (let q = sparks.length - 1; q >= 0; q--) {
      const sp = sparks[q];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.22;
      sp.vx *= 0.97;
      sp.life -= 1;
      const sa = p.map(sp.life, 0, sp.maxLife, 0, 100, true);
      const x1 = sp.x - sp.vx * 1.15;
      const y1 = sp.y - sp.vy * 1.15;
      p.stroke(sp.hue, 96, 100, sa);
      p.strokeWeight(sp.w);
      p.line(sp.x, sp.y, x1, y1);
      p.stroke((sp.hue + 55) % 360, 40, 100, sa * 0.35);
      p.strokeWeight(sp.w * 0.45);
      p.line(sp.x, sp.y, x1, y1);
      p.noStroke();
      if (sp.life <= 0) {
        sparks.splice(q, 1);
      }
    }

    p.fill(0, 0, 100, 3);
    p.rect(0, 0, p.width, p.height);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    stream = [];
    splashes = [];
    sparks = [];
    bursts = [];
    for (let i = 0; i < STREAM; i++) {
      stream.push(spawnStream(i));
    }
  };

  p.touchMoved = () => {
    return false;
  };

  p.touchStarted = () => {
    return false;
  };
}, "slide-waterfall");
