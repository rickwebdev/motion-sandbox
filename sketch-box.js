/**
 * p5.js WEBGL — box + ring (instance mode for carousel).
 */
window.motionSketches = window.motionSketches || {};
window.motionSketches.box = new p5((p) => {
  const BOX_HALF = 575;
  const TORUS_MAJOR = 218;
  const TORUS_MINOR = 76;
  const BOUND_R = TORUS_MAJOR + TORUS_MINOR;
  const INNER = BOX_HALF - BOUND_R;
  const CAM_ORBIT_MARGIN = 1.38;

  const GRAVITY = 0.52;
  const AIR_DRAG = 0.9975;
  const RESTITUTION = 0.78;
  const VEL_EPS = 0.006;
  const WALL_FRICTION = 0.96;

  const SPIN_DRAG = 0.965;
  const SPIN_COUP_ROT = 0.42;
  const SPIN_COUP_TRANS = 0.0012;
  const WALL_SPIN = 0.012;

  const BOX_DRAG_XY = 1.05;
  const BOX_DRAG_Z = 0.12;
  const ROT_DRAG = 0.008;
  const ROLL_DRAG = 0.008;

  const SHAKE_VEL_THRESH = 14;
  const SHAKE_ROT_THRESH = 0.0012;
  const HOVER_SPRING = 0.045;
  const HOVER_EXTRA_DRAG = 0.982;
  const HOVER_BOB_AMP = 5;
  const HOVER_BOB_FREQ = 0.042;
  const SPIN_COUP_TRANS_RM = 320;

  let boxPos;
  let boxPosPrev;
  let boxRotX = 0;
  let boxRotY = 0;
  let boxRotZ = 0;
  let boxRotXPrev = 0;
  let boxRotYPrev = 0;
  let boxRotZPrev = 0;

  let pos;
  let vel;
  let spinAng;
  let spinVel;

  let camYaw = 0.55;
  let camPitch = -0.35;
  let prevTouchMid = null;

  function rotMat(rx, ry, rz) {
    const cx = p.cos(rx);
    const sx = p.sin(rx);
    const cy = p.cos(ry);
    const sy = p.sin(ry);
    const cz = p.cos(rz);
    const sz = p.sin(rz);
    return [
      cy * cz,
      sx * sy * cz - cx * sz,
      cx * sy * cz + sx * sz,
      cy * sz,
      sx * sy * sz + cx * cz,
      cx * sy * sz - sx * cz,
      -sy,
      sx * cy,
      cx * cy,
    ];
  }

  function mat3MulVec(m, v) {
    return p.createVector(
      m[0] * v.x + m[1] * v.y + m[2] * v.z,
      m[3] * v.x + m[4] * v.y + m[5] * v.z,
      m[6] * v.x + m[7] * v.y + m[8] * v.z
    );
  }

  function mat3TmulVec(m, v) {
    return p.createVector(
      m[0] * v.x + m[3] * v.y + m[6] * v.z,
      m[1] * v.x + m[4] * v.y + m[7] * v.z,
      m[2] * v.x + m[5] * v.y + m[8] * v.z
    );
  }

  function clampDonutInsideBox(R) {
    const pl = mat3TmulVec(R, p5.Vector.sub(pos, boxPos));
    const h = INNER;
    pl.x = p.constrain(pl.x, -h, h);
    pl.y = p.constrain(pl.y, -h, h);
    pl.z = p.constrain(pl.z, -h, h);
    pos.set(boxPos).add(mat3MulVec(R, pl));
  }

  function addWallSpinLocal(R, spinVelRef, vRel, nx, ny, nz) {
    const lx = ny * vRel.z - nz * vRel.y;
    const ly = nz * vRel.x - nx * vRel.z;
    const lz = nx * vRel.y - ny * vRel.x;
    const wLocal = p.createVector(lx, ly, lz);
    spinVelRef.add(mat3MulVec(R, wLocal).mult(WALL_SPIN));
  }

  function resolveDonutInBox(boxVel, R) {
    const pl = mat3TmulVec(R, p5.Vector.sub(pos, boxPos));
    const velL = mat3TmulVec(R, vel);
    const boxVelL = mat3TmulVec(R, boxVel);
    const h = INNER;

    if (pl.x < -h) {
      const vRel = p5.Vector.sub(velL, boxVelL);
      pl.x = -h;
      velL.x = boxVelL.x - RESTITUTION * (velL.x - boxVelL.x);
      velL.y *= WALL_FRICTION;
      velL.z *= WALL_FRICTION;
      addWallSpinLocal(R, spinVel, vRel, 1, 0, 0);
    } else if (pl.x > h) {
      const vRel = p5.Vector.sub(velL, boxVelL);
      pl.x = h;
      velL.x = boxVelL.x - RESTITUTION * (velL.x - boxVelL.x);
      velL.y *= WALL_FRICTION;
      velL.z *= WALL_FRICTION;
      addWallSpinLocal(R, spinVel, vRel, -1, 0, 0);
    }

    if (pl.y < -h) {
      const vRel = p5.Vector.sub(velL, boxVelL);
      pl.y = -h;
      velL.y = boxVelL.y - RESTITUTION * (velL.y - boxVelL.y);
      velL.x *= WALL_FRICTION;
      velL.z *= WALL_FRICTION;
      addWallSpinLocal(R, spinVel, vRel, 0, 1, 0);
    } else if (pl.y > h) {
      const vRel = p5.Vector.sub(velL, boxVelL);
      pl.y = h;
      velL.y = boxVelL.y - RESTITUTION * (velL.y - boxVelL.y);
      velL.x *= WALL_FRICTION;
      velL.z *= WALL_FRICTION;
      addWallSpinLocal(R, spinVel, vRel, 0, -1, 0);
    }

    if (pl.z < -h) {
      const vRel = p5.Vector.sub(velL, boxVelL);
      pl.z = -h;
      velL.z = boxVelL.z - RESTITUTION * (velL.z - boxVelL.z);
      velL.x *= WALL_FRICTION;
      velL.y *= WALL_FRICTION;
      addWallSpinLocal(R, spinVel, vRel, 0, 0, 1);
    } else if (pl.z > h) {
      const vRel = p5.Vector.sub(velL, boxVelL);
      pl.z = h;
      velL.z = boxVelL.z - RESTITUTION * (velL.z - boxVelL.z);
      velL.x *= WALL_FRICTION;
      velL.y *= WALL_FRICTION;
      addWallSpinLocal(R, spinVel, vRel, 0, 0, -1);
    }

    vel.set(mat3MulVec(R, velL));
    pos.set(boxPos).add(mat3MulVec(R, pl));
  }

  function cameraDistanceForViewport() {
    const h = p.max(p.height, 1);
    const w = p.max(p.width, 1);
    const aspect = w / h;
    const fovy = 2 * p.atan(h / 2 / 800);
    const t = p.tan(fovy / 2);
    const dVert = BOX_HALF / t;
    const dHor = BOX_HALF / (t * aspect);
    return p.max(dVert, dHor) * CAM_ORBIT_MARGIN;
  }

  function applyDrag() {
    const shift = p.keyIsDown(16);
    const dx = p.mouseX - p.pmouseX;
    const dy = p.mouseY - p.pmouseY;

    if (p.mouseButton === p.LEFT) {
      if (shift) {
        boxPos.x += dx * BOX_DRAG_XY;
        boxPos.y += dy * BOX_DRAG_XY;
      } else {
        boxRotY += dx * ROT_DRAG;
        boxRotX += dy * ROT_DRAG;
      }
    }

    if (p.mouseButton === p.CENTER) {
      boxRotZ += dx * ROLL_DRAG;
    }

    if (p.mouseButton === p.RIGHT) {
      camYaw += dx * 0.006;
      camPitch += dy * 0.006;
      camPitch = p.constrain(camPitch, -p.PI / 2 + 0.15, p.PI / 2 - 0.15);
    }
  }

  p.setup = () => {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    cnv.parent("slide-box");
    p.pixelDensity(1);
    p.angleMode(p.RADIANS);
    const canvasEl = cnv.elt;
    if (canvasEl) canvasEl.oncontextmenu = () => false;

    const root = document.getElementById("slide-box");
    if (root && canvasEl) {
      const setGrabbing = (on) => {
        root.classList.toggle("is-grabbing", on);
      };
      canvasEl.addEventListener("pointerdown", () => setGrabbing(true));
      window.addEventListener("pointerup", () => setGrabbing(false));
      window.addEventListener("pointercancel", () => setGrabbing(false));
    }

    window.addEventListener("orientationchange", () => {
      setTimeout(() => p.resizeCanvas(p.windowWidth, p.windowHeight), 200);
    });

    boxPos = p.createVector(0, 0, 0);
    boxPosPrev = boxPos.copy();
    spinAng = p.createVector(0, 0, 0);
    spinVel = p.createVector(0, 0, 0);

    const R0 = rotMat(boxRotX, boxRotY, boxRotZ);
    const inner = INNER * 0.35;
    const pl0 = p.createVector(
      p.random(-inner, inner),
      p.random(-inner, inner),
      p.random(-inner, inner)
    );
    pos = p5.Vector.add(boxPos, mat3MulVec(R0, pl0));
    vel = p.createVector(p.random(-4, 4), p.random(-2.8, 2.8), p.random(-4, 4));
  };

  p.mouseDragged = () => {
    applyDrag();
  };

  p.touchMoved = () => {
    if (p.touches.length >= 2) {
      const midx = (p.touches[0].x + p.touches[1].x) / 2;
      const midy = (p.touches[0].y + p.touches[1].y) / 2;
      if (prevTouchMid !== null) {
        camYaw += (midx - prevTouchMid.x) * 0.006;
        camPitch += (midy - prevTouchMid.y) * 0.006;
        camPitch = p.constrain(camPitch, -p.PI / 2 + 0.15, p.PI / 2 - 0.15);
      }
      prevTouchMid = { x: midx, y: midy };
      return false;
    }
    prevTouchMid = null;

    if (p.touches.length === 1) {
      const dx = p.mouseX - p.pmouseX;
      const dy = p.mouseY - p.pmouseY;
      boxRotY += dx * ROT_DRAG;
      boxRotX += dy * ROT_DRAG;
    }
    return false;
  };

  p.touchStarted = () => {
    prevTouchMid = null;
    return false;
  };

  p.touchEnded = () => {
    prevTouchMid = null;
  };

  p.mouseWheel = (ev) => {
    boxPos.z -= ev.delta * BOX_DRAG_Z;
  };

  p.keyPressed = () => {
    if (p.key === "q" || p.key === "Q") boxRotZ -= 0.08;
    if (p.key === "e" || p.key === "E") boxRotZ += 0.08;
  };

  p.draw = () => {
    p.background(20);

    const boxVel = p5.Vector.sub(boxPos, boxPosPrev);
    const dRx = boxRotX - boxRotXPrev;
    const dRy = boxRotY - boxRotYPrev;
    const dRz = boxRotZ - boxRotZPrev;

    const R = rotMat(boxRotX, boxRotY, boxRotZ);

    const shaking =
      boxVel.mag() > SHAKE_VEL_THRESH ||
      p.abs(dRx) > SHAKE_ROT_THRESH ||
      p.abs(dRy) > SHAKE_ROT_THRESH ||
      p.abs(dRz) > SHAKE_ROT_THRESH;

    if (shaking) {
      const gWorld = mat3MulVec(R, p.createVector(0, -GRAVITY, 0));
      vel.add(gWorld);
      vel.mult(AIR_DRAG);
      pos.add(vel);
    } else {
      const toward = p5.Vector.sub(boxPos, pos);
      vel.add(toward.mult(HOVER_SPRING));
      vel.mult(HOVER_EXTRA_DRAG);
      pos.add(vel);
    }

    resolveDonutInBox(boxVel, R);
    clampDonutInsideBox(R);

    if (shaking) {
      spinVel.add(mat3MulVec(R, p.createVector(dRx, dRy, dRz)).mult(SPIN_COUP_ROT));
      const rWorld = p5.Vector.sub(pos, boxPos);
      const rm = rWorld.mag() + SPIN_COUP_TRANS_RM;
      spinVel.add(rWorld.cross(boxVel).mult(SPIN_COUP_TRANS / rm));
      spinVel.mult(SPIN_DRAG);
    } else {
      spinVel.mult(0.88);
    }
    spinAng.add(spinVel);

    if (vel.magSq() < VEL_EPS * VEL_EPS && shaking) {
      vel.set(0, 0, 0);
    }
    if (spinVel.magSq() < 1e-10) {
      spinVel.set(0, 0, 0);
    }

    boxPosPrev.set(boxPos);
    boxRotXPrev = boxRotX;
    boxRotYPrev = boxRotY;
    boxRotZPrev = boxRotZ;

    const camDist = cameraDistanceForViewport();
    const cp = p.cos(camPitch);
    const sp = p.sin(camPitch);
    const cy = p.cos(camYaw);
    const sy = p.sin(camYaw);
    const eyeX = camDist * sy * cp;
    const eyeY = camDist * sp;
    const eyeZ = camDist * cy * cp;
    p.camera(eyeX, eyeY, eyeZ, 0, 0, 0, 0, 1, 0);

    p.ambientLight(60);
    p.directionalLight(255, 255, 255, -0.5, 0.5, -1);

    const nearCenter = p5.Vector.sub(pos, boxPos).mag() < INNER * 0.4;
    const hoverBobY =
      !shaking && nearCenter
        ? p.sin(p.frameCount * HOVER_BOB_FREQ) * HOVER_BOB_AMP * 0.22
        : 0;

    p.push();
    p.translate(pos.x, pos.y + hoverBobY, pos.z);
    p.rotateX(spinAng.x);
    p.rotateY(spinAng.y);
    p.rotateZ(spinAng.z);
    p.noStroke();
    p.normalMaterial();
    p.torus(TORUS_MAJOR, TORUS_MINOR, 56, 28);
    p.pop();

    p.push();
    p.translate(boxPos.x, boxPos.y, boxPos.z);
    p.applyMatrix(
      R[0],
      R[1],
      R[2],
      0,
      R[3],
      R[4],
      R[5],
      0,
      R[6],
      R[7],
      R[8],
      0,
      0,
      0,
      0,
      1
    );
    p.noFill();
    p.stroke(180, 210, 255, 230);
    p.strokeWeight(3);
    p.box(BOX_HALF * 2);
    p.pop();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
}, "slide-box");
