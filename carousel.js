(function () {
  const slides = document.querySelectorAll(".carousel-slide");
  const total = slides.length;
  let index = 0;

  function applySketches() {
    const ms = window.motionSketches;
    if (!ms) return;
    if (ms.box) {
      if (index === 0) ms.box.loop();
      else ms.box.noLoop();
    }
    if (ms.waterfall) {
      if (index === 1) ms.waterfall.loop();
      else ms.waterfall.noLoop();
    }
    if (ms.flow) {
      if (index === 2) ms.flow.loop();
      else ms.flow.noLoop();
    }
  }

  function go(n) {
    index = (n + total) % total;
    slides.forEach((el, i) => {
      el.classList.toggle("is-active", i === index);
      el.setAttribute("aria-hidden", i !== index ? "true" : "false");
    });
    document.querySelectorAll(".carousel-dot").forEach((dot, i) => {
      dot.classList.toggle("is-current", i === index);
      dot.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    const label = document.getElementById("carousel-label");
    if (label && slides[index]) {
      label.textContent = slides[index].dataset.title || "";
    }
    applySketches();
  }

  /**
   * iOS Safari: nav taps are flaky; touchend + preventDefault is reliable.
   * click covers mouse + keyboard. If both fire for one tap, skip duplicate click.
   * Timeout clears skipClick if a synthetic click never arrives (e.g. hybrid use).
   */
  function bindNavControl(el, handler) {
    if (!el) return;
    let skipClick = false;
    let skipTimer = null;
    el.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        skipClick = true;
        if (skipTimer) clearTimeout(skipTimer);
        skipTimer = setTimeout(() => {
          skipClick = false;
          skipTimer = null;
        }, 450);
        handler();
      },
      { passive: false }
    );
    el.addEventListener("click", () => {
      if (skipClick) {
        skipClick = false;
        if (skipTimer) {
          clearTimeout(skipTimer);
          skipTimer = null;
        }
        return;
      }
      handler();
    });
  }

  function bindNav() {
    bindNavControl(document.getElementById("carousel-prev"), () => go(index - 1));
    bindNavControl(document.getElementById("carousel-next"), () => go(index + 1));
    document.querySelectorAll(".carousel-dot").forEach((dot) => {
      const slide = Number(dot.dataset.slide);
      bindNavControl(dot, () => go(slide));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    });
  }

  function waitForSketches() {
    if (
      window.motionSketches &&
      window.motionSketches.box &&
      window.motionSketches.waterfall &&
      window.motionSketches.flow
    ) {
      applySketches();
      return;
    }
    requestAnimationFrame(waitForSketches);
  }

  function init() {
    bindNav();
    go(0);
    waitForSketches();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
