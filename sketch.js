/**
 * p5.js WEBGL — box + ring scaled up; camera distance fits the box to the viewport (centered).
 * Ring stays inside the box; physics + hover as before.
 */

const BOX_HALF = 575;
const TORUS_MAJOR = 218;
const TORUS_MINOR = 76;
const BOUND_R = TORUS_MAJOR + TORUS_MINOR;
const INNER = BOX_HALF - BOUND_R;

/**
 * Camera distance uses the same vertical FOV as p5’s default perspective:
 * fovy = 2 * atan((height/2) / 800) with default eye at z = 800.
 * Do not call perspective() manually — it was breaking the default camera and blacking the canvas.
 * Extra >1 so rotated box corners stay inside the frame (orthographic fit uses half-extent, not projected silhouette).
 */
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

/** Box considered “still” → hover mode (spring to center, no gravity). */
const SHAKE_VEL_THRESH = 14;
const SHAKE_ROT_THRESH = 0.0012;
/** Pull ring toward box center each frame while hovering. */
const HOVER_SPRING = 0.045;
const HOVER_EXTRA_DRAG = 0.982;
/** Tiny idle bob so it reads as “hover” (world Y). */
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

function cameraDistanceForViewport() {
  const h = Math.max(height, 1);
  const w = Math.max(width, 1);
  const aspect = w / h;
  const fovy = 2 * atan(h / 2 / 800);
  const t = tan(fovy / 2);
  const dVert = BOX_HALF / t;
  const dHor = BOX_HALF / (t * aspect);
  return Math.max(dVert, dHor) * CAM_ORBIT_MARGIN;
}

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight, WEBGL);
  cnv.parent("p5-root");
  /** 1:1 backing store ↔ CSS size so WEBGL viewport matches the full canvas (avoids top-left quadrant clipping on retina). */
  pixelDensity(1);
  angleMode(RADIANS);
  const canvasEl = cnv.elt;
  if (canvasEl) canvasEl.oncontextmenu = () => false;

  const root = document.getElementById("p5-root");
  if (root && canvasEl) {
    const setGrabbing = (on) => {
      root.classList.toggle("is-grabbing", on);
    };
    canvasEl.addEventListener("pointerdown", () => setGrabbing(true));
    window.addEventListener("pointerup", () => setGrabbing(false));
    window.addEventListener("pointercancel", () => setGrabbing(false));
  }

  boxPos = createVector(0, 0, 0);
  boxPosPrev = boxPos.copy();
  spinAng = createVector(0, 0, 0);
  spinVel = createVector(0, 0, 0);

  const R0 = rotMat(boxRotX, boxRotY, boxRotZ);
  const inner = INNER * 0.35;
  const pl0 = createVector(
    random(-inner, inner),
    random(-inner, inner),
    random(-inner, inner)
  );
  pos = p5.Vector.add(boxPos, mat3MulVec(R0, pl0));
  vel = createVector(
    random(-4, 4),
    random(-2.8, 2.8),
    random(-4, 4)
  );
}

function rotMat(rx, ry, rz) {
  const cx = cos(rx);
  const sx = sin(rx);
  const cy = cos(ry);
  const sy = sin(ry);
  const cz = cos(rz);
  const sz = sin(rz);
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
  return createVector(
    m[0] * v.x + m[1] * v.y + m[2] * v.z,
    m[3] * v.x + m[4] * v.y + m[5] * v.z,
    m[6] * v.x + m[7] * v.y + m[8] * v.z
  );
}

function mat3TmulVec(m, v) {
  return createVector(
    m[0] * v.x + m[3] * v.y + m[6] * v.z,
    m[1] * v.x + m[4] * v.y + m[7] * v.z,
    m[2] * v.x + m[5] * v.y + m[8] * v.z
  );
}

/** Hard clamp: donut center never leaves the inner OBB (fixes tunneling). */
function clampDonutInsideBox(R) {
  const pl = mat3TmulVec(R, p5.Vector.sub(pos, boxPos));
  const h = INNER;
  pl.x = constrain(pl.x, -h, h);
  pl.y = constrain(pl.y, -h, h);
  pl.z = constrain(pl.z, -h, h);
  pos.set(boxPos).add(mat3MulVec(R, pl));
}

function addWallSpinLocal(R, spinVel, vRel, nx, ny, nz) {
  const lx = ny * vRel.z - nz * vRel.y;
  const ly = nz * vRel.x - nx * vRel.z;
  const lz = nx * vRel.y - ny * vRel.x;
  const wLocal = createVector(lx, ly, lz);
  spinVel.add(mat3MulVec(R, wLocal).mult(WALL_SPIN));
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

function mouseDragged() {
  const shift = keyIsDown(16);

  if (mouseButton === LEFT) {
    if (shift) {
      boxPos.x += (mouseX - pmouseX) * BOX_DRAG_XY;
      boxPos.y += (mouseY - pmouseY) * BOX_DRAG_XY;
    } else {
      boxRotY += (mouseX - pmouseX) * ROT_DRAG;
      boxRotX += (mouseY - pmouseY) * ROT_DRAG;
    }
  }

  if (mouseButton === CENTER) {
    boxRotZ += (mouseX - pmouseX) * ROLL_DRAG;
  }

  if (mouseButton === RIGHT) {
    camYaw += (mouseX - pmouseX) * 0.006;
    camPitch += (mouseY - pmouseY) * 0.006;
    camPitch = constrain(camPitch, -PI / 2 + 0.15, PI / 2 - 0.15);
  }
}

function mouseWheel(ev) {
  boxPos.z -= ev.delta * BOX_DRAG_Z;
}

function keyPressed() {
  if (key === "q" || key === "Q") boxRotZ -= 0.08;
  if (key === "e" || key === "E") boxRotZ += 0.08;
}

function draw() {
  background(20);

  const boxVel = p5.Vector.sub(boxPos, boxPosPrev);
  const dRx = boxRotX - boxRotXPrev;
  const dRy = boxRotY - boxRotYPrev;
  const dRz = boxRotZ - boxRotZPrev;

  const R = rotMat(boxRotX, boxRotY, boxRotZ);

  const shaking =
    boxVel.mag() > SHAKE_VEL_THRESH ||
    abs(dRx) > SHAKE_ROT_THRESH ||
    abs(dRy) > SHAKE_ROT_THRESH ||
    abs(dRz) > SHAKE_ROT_THRESH;

  if (shaking) {
    const gWorld = mat3MulVec(R, createVector(0, -GRAVITY, 0));
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
    spinVel.add(mat3MulVec(R, createVector(dRx, dRy, dRz)).mult(SPIN_COUP_ROT));
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
  /** Orbit eye around origin — use camera() so the view is truly centered (avoids stacked default-camera + rotate/translate quirks). */
  const cp = cos(camPitch);
  const sp = sin(camPitch);
  const cy = cos(camYaw);
  const sy = sin(camYaw);
  const eyeX = camDist * sy * cp;
  const eyeY = camDist * sp;
  const eyeZ = camDist * cy * cp;
  camera(eyeX, eyeY, eyeZ, 0, 0, 0, 0, 1, 0);

  ambientLight(60);
  directionalLight(255, 255, 255, -0.5, 0.5, -1);

  const nearCenter = p5.Vector.sub(pos, boxPos).mag() < INNER * 0.4;
  const hoverBobY =
    !shaking && nearCenter
      ? sin(frameCount * HOVER_BOB_FREQ) * HOVER_BOB_AMP * 0.22
      : 0;

  push();
  translate(pos.x, pos.y + hoverBobY, pos.z);
  rotateX(spinAng.x);
  rotateY(spinAng.y);
  rotateZ(spinAng.z);
  noStroke();
  normalMaterial();
  torus(TORUS_MAJOR, TORUS_MINOR, 56, 28);
  pop();

  push();
  translate(boxPos.x, boxPos.y, boxPos.z);
  applyMatrix(
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
  noFill();
  stroke(180, 210, 255, 230);
  strokeWeight(3);
  box(BOX_HALF * 2);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
