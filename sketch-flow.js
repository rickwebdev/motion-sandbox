/**
 * Flow — particles swarm the cursor; staying still builds “dwell” so the pull
 * consolidates into a tighter, brighter cluster.
 *
 * Disperse: double-click / double-tap, or Space — burst outward from the pointer,
 * then swirl returns (dwell resets).
 */
window.motionSketches = window.motionSketches || {};
window.motionSketches.flow = new p5((p) => {
  const DISPERSE_DURATION = 78;
  let particles = [];
  let pmouse = { x: 0, y: 0 };
  let t = 0;
  /** 0–1: how long the pointer has stayed roughly still (builds consolidation). */
  let dwell = 0;
  /** Frames left in dispersal phase (repel + damped pull). */
  let disperseTimer = 0;
  let lastDispenseAt = 0;
  let lastTapT = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function particleCount() {
    return p.width < 600 ? 1650 : 2900;
  }

  function spawn() {
    return {
      x: p.random(p.width),
      y: p.random(p.height),
      vx: 0,
      vy: 0,
      hue: p.random(360),
    };
  }

  function fieldAngle(x, y) {
    const sx = x * 0.0021;
    const sy = y * 0.0021;
    const r = p.sqrt(sx * sx + sy * sy);
    return (
      p.sin(sx * 2.1 + sy * 1.3 + t * 0.42) * 1.25 +
      p.cos(sy * 2.4 - sx * 0.9 + t * 0.31) * 1.1 +
      p.sin(r * 3.2 - t * 0.55) * 0.85 +
      p.sin(sx * sy * 1.8 + t * 0.2) * 0.5
    );
  }

  function triggerDisperse(cx, cy) {
    const now = p.millis();
    if (now - lastDispenseAt < 320) return;
    lastDispenseAt = now;

    let px = cx;
    let py = cy;
    if (px < 0 || px > p.width || py < 0 || py > p.height) {
      px = p.constrain(p.mouseX, 0, p.width);
      py = p.constrain(p.mouseY, 0, p.height);
    }

    dwell = 0;
    disperseTimer = DISPERSE_DURATION;

    for (let i = 0; i < particles.length; i++) {
      const o = particles[i];
      const dx = o.x - px;
      const dy = o.y - py;
      const d = p.sqrt(dx * dx + dy * dy) + 16;
      const u = dx / d;
      const v = dy / d;
      const amp = 5.8 + 240 / d;
      o.vx += u * amp * p.random(0.82, 1.18);
      o.vy += v * amp * p.random(0.82, 1.18);
      o.hue = (o.hue + p.random(-28, 28) + 360) % 360;
    }
  }

  p.setup = () => {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight, p.P2D);
    cnv.parent("slide-flow");
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    particles = [];
    const n = particleCount();
    for (let i = 0; i < n; i++) {
      particles.push(spawn());
    }
    pmouse.x = p.mouseX;
    pmouse.y = p.mouseY;
  };

  p.draw = () => {
    t += 0.008;
    const mx = p.mouseX;
    const my = p.mouseY;
    const mdx = mx - pmouse.x;
    const mdy = my - pmouse.y;
    const ms = p.sqrt(mdx * mdx + mdy * mdy);
    pmouse.x = mx;
    pmouse.y = my;

    if (disperseTimer <= 0) {
      if (ms < 1.4) {
        dwell = p.min(dwell + 0.02, 1);
      } else {
        dwell = p.max(dwell - (0.05 + ms * 0.01), 0);
      }
    } else {
      dwell = p.max(dwell - 0.08, 0);
    }

    const touching = p.touches && p.touches.length > 0;
    const wake = touching || p.mouseIsPressed || ms > 0.25;

    const burst = disperseTimer / DISPERSE_DURATION;
    const pullDamp = disperseTimer > 0 ? 1 - p.pow(burst, 0.65) * 0.92 : 1;

    p.background(232, 26, 27);

    const pull = (0.18 + dwell * dwell * 2.6) * pullDamp;
    const swirlMix = p.lerp(0.92, 0.2, dwell) + (disperseTimer > 0 ? burst * 0.45 : 0);
    const fieldMix = p.lerp(1, 0.25, dwell) + (disperseTimer > 0 ? burst * 0.35 : 0);

    for (let i = 0; i < particles.length; i++) {
      const o = particles[i];
      const ang = fieldAngle(o.x, o.y);
      let ax = p.cos(ang) * 0.42 * fieldMix;
      let ay = p.sin(ang) * 0.42 * fieldMix;

      const toX = mx - o.x;
      const toY = my - o.y;
      const d = p.sqrt(toX * toX + toY * toY) + 10;
      const inv = 1 / d;
      const near = p.map(d, 0, 420, 1, 0.08, true);
      const far = p.map(d, 0, 720, 1, 0.22, true);
      const falloff = near * far;
      const orbit = p.map(d, 0, 140, 1, 0.4, true);

      ax += (toX * inv) * pull * falloff * orbit;
      ay += (toY * inv) * pull * falloff * orbit;
      ax += (-toY * inv) * 2.2 * falloff * swirlMix;
      ay += (toX * inv) * 2.2 * falloff * swirlMix;
      if (wake) {
        ax += (mdx * 0.024 + mdy * 0.009) * falloff * swirlMix;
        ay += (mdy * 0.024 - mdx * 0.009) * falloff * swirlMix;
      }

      if (disperseTimer > 0) {
        const fromX = o.x - mx;
        const fromY = o.y - my;
        const rd = p.sqrt(fromX * fromX + fromY * fromY) + 12;
        const repel = burst * 7.2;
        ax += (fromX / rd) * repel * falloff;
        ay += (fromY / rd) * repel * falloff;
      }

      const maxSpeed =
        disperseTimer > 0 ? 14 + burst * 4 : 5.2 + dwell * 2.2;
      o.vx = p.lerp(o.vx, ax, 0.16 + dwell * 0.06);
      o.vy = p.lerp(o.vy, ay, 0.16 + dwell * 0.06);
      const vmag = p.sqrt(o.vx * o.vx + o.vy * o.vy);
      if (vmag > maxSpeed) {
        o.vx = (o.vx / vmag) * maxSpeed;
        o.vy = (o.vy / vmag) * maxSpeed;
      }

      o.x += o.vx;
      o.y += o.vy;
      o.hue = (o.hue + o.vx * 2.4 + o.vy * 2.1 + 0.35) % 360;

      if (o.x < -20) o.x = p.width + 20;
      else if (o.x > p.width + 20) o.x = -20;
      if (o.y < -20) o.y = p.height + 20;
      else if (o.y > p.height + 20) o.y = -20;

      const sp = p.sqrt(o.vx * o.vx + o.vy * o.vy);
      const sat = p.map(sp, 0, 3.2, 92, 100, true);
      const br = p.map(sp, 0, 3, 93, 100, true);
      const al = p.map(sp, 0, 2.8, 78, 100, true);
      const baseR = p.map(sp, 0, 3, 2, 4.5, true);

      p.noStroke();
      p.fill(o.hue, sat * 0.88, 100, al * 0.42);
      p.circle(o.x, o.y, baseR * 2.5);
      p.fill(o.hue, sat, br, al);
      p.circle(o.x, o.y, baseR);
      p.fill((o.hue + 38) % 360, 42, 100, al * 0.72);
      p.circle(o.x - baseR * 0.15, o.y - baseR * 0.15, baseR * 0.48);
    }

    p.fill(0, 0, 100, 1);
    p.rect(0, 0, p.width, p.height);

    if (disperseTimer > 0) {
      disperseTimer -= 1;
    }
  };

  p.doubleClicked = () => {
    triggerDisperse(p.mouseX, p.mouseY);
    return false;
  };

  p.touchEnded = () => {
    const now = p.millis();
    const x = p.mouseX;
    const y = p.mouseY;
    if (now - lastTapT < 400 && p.dist(x, y, lastTapX, lastTapY) < 50) {
      triggerDisperse(x, y);
    }
    lastTapT = now;
    lastTapX = x;
    lastTapY = y;
    return false;
  };

  p.keyPressed = () => {
    if (p.key === " " || p.key === "d" || p.key === "D") {
      triggerDisperse(p.mouseX, p.mouseY);
      return false;
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    const n = particleCount();
    while (particles.length < n) {
      particles.push(spawn());
    }
    while (particles.length > n) {
      particles.pop();
    }
    for (let i = 0; i < particles.length; i++) {
      particles[i].x = p.constrain(particles[i].x, 0, p.width);
      particles[i].y = p.constrain(particles[i].y, 0, p.height);
    }
  };

  p.touchMoved = () => false;
  p.touchStarted = () => false;
}, "slide-flow");

