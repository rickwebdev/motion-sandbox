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

  function init() {
    if (!window.motionSketches || !window.motionSketches.box || !window.motionSketches.waterfall) {
      requestAnimationFrame(init);
      return;
    }
    const prev = document.getElementById("carousel-prev");
    const next = document.getElementById("carousel-next");
    if (prev) prev.addEventListener("click", () => go(index - 1));
    if (next) next.addEventListener("click", () => go(index + 1));
    document.querySelectorAll(".carousel-dot").forEach((dot) => {
      dot.addEventListener("click", () => go(Number(dot.dataset.slide)));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    });
    go(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
