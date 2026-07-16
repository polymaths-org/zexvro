(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pixelRoot = document.querySelector(".pixel-swarm");
  const canvas = document.getElementById("artifact-canvas");
  const morphWord = document.getElementById("morph-word");

  function buildPixelSwarm() {
    if (!pixelRoot) return;

    for (let i = 0; i < 86; i += 1) {
      const pixel = document.createElement("i");
      const size = 3 + Math.floor(Math.random() * 12);
      pixel.style.left = `${Math.random() * 100}%`;
      pixel.style.top = `${Math.random() * 100}%`;
      pixel.style.setProperty("--size", `${size}px`);
      pixel.style.setProperty("--alpha", `${0.12 + Math.random() * 0.58}`);
      pixelRoot.appendChild(pixel);
    }
  }

  function setupSmoothScroll() {
    if (reduceMotion || !window.Lenis) return null;

    const lenis = new window.Lenis({
      duration: 1.22,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.82,
      touchMultiplier: 1.08,
    });

    if (window.ScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
    }

    if (window.gsap) {
      window.gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }

    return lenis;
  }

  function setupAnchorScroll(lenis) {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const id = anchor.getAttribute("href");
        if (!id || id === "#") return;

        const target = document.querySelector(id);
        if (!target) return;

        event.preventDefault();
        if (lenis) {
          lenis.scrollTo(target, { offset: -18 });
        } else {
          target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
        }
      });
    });
  }

  function setupCanvasArtifact() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const pointer = {
      x: 0,
      y: 0,
      active: false,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const hash = (x, y) => {
      const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };

    const block = (x, y, w, h, alpha = 1) => {
      ctx.fillStyle = `rgba(246, 246, 241, ${alpha})`;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const drawGreekKey = (cell, drift) => {
      const top = Math.max(88, height * 0.11);
      const bottom = height - Math.max(88, height * 0.1);
      const step = cell * 5;

      for (let x = -step; x < width + step; x += step) {
        const dx = (drift * 24) % step;
        block(x + dx, top, cell * 2, cell, 0.18);
        block(x + dx, top + cell, cell, cell * 2, 0.12);
        block(x + dx + cell, bottom, cell * 3, cell, 0.16);
        block(x + dx + cell * 3, bottom - cell * 2, cell, cell * 3, 0.12);
      }
    };

    const drawColumns = (cell, time, scrollPressure) => {
      const base = height * 0.82;
      const top = height * 0.2;
      const columnWidth = cell * 4;
      const spacing = cell * 10;
      const origin = width * 0.7;

      for (let i = 0; i < 4; i += 1) {
        const x = origin + i * spacing + Math.sin(time + i) * cell * 0.4;
        const fade = 0.17 + i * 0.035;

        block(x - cell, top - cell * 2, columnWidth + cell * 2, cell, fade);
        block(x - cell * 2, top - cell, columnWidth + cell * 4, cell, fade + 0.06);
        block(x, top, columnWidth, base - top, fade);

        for (let y = top + cell * 2; y < base; y += cell * 2) {
          const rib = Math.sin(y * 0.03 + time + i) > -0.45;
          if (rib) block(x + cell, y + scrollPressure * cell * 2, cell, cell, fade + 0.13);
          block(x + columnWidth - cell, y, cell, cell, fade + 0.08);
        }

        block(x - cell * 2, base, columnWidth + cell * 4, cell, fade + 0.08);
        block(x - cell * 3, base + cell, columnWidth + cell * 6, cell, fade + 0.05);
      }
    };

    const drawZexvroMark = (cell, time, scrollPressure) => {
      const centerX = width * 0.62;
      const centerY = height * 0.5;
      const scale = Math.min(width, height) * 0.34;
      const pointerPull = pointer.active ? 1 : 0;
      const pointerX = pointer.active ? pointer.x : centerX;
      const pointerY = pointer.active ? pointer.y : centerY;
      const nodes = [
        [-0.82, -0.82, 1.05],
        [0.82, -0.82, 1.05],
        [-0.82, 0.82, 1.05],
        [0.82, 0.82, 1.05],
        [-0.42, -0.42, 0.72],
        [0.42, -0.42, 0.72],
        [-0.42, 0.42, 0.72],
        [0.42, 0.42, 0.72],
        [0, 0, 0.92],
        [-0.82, 0, 0.62],
        [0.82, 0, 0.62],
      ].map(([x, y, size]) => ({
        x: centerX + x * scale,
        y: centerY + y * scale,
        size: size * scale * 0.2,
      }));
      const links = [
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
        [4, 8],
        [5, 8],
        [6, 8],
        [7, 8],
        [9, 4],
        [9, 6],
        [10, 5],
        [10, 7],
      ];

      links.forEach(([fromIndex, toIndex], linkIndex) => {
        const from = nodes[fromIndex];
        const to = nodes[toIndex];
        const steps = Math.max(8, Math.floor(Math.hypot(to.x - from.x, to.y - from.y) / cell));

        for (let step = 0; step <= steps; step += 1) {
          const t = step / steps;
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t;
          const grain = hash(step + linkIndex * 7, Math.floor(time * 12));
          if (grain < 0.14 - scrollPressure * 0.06) continue;

          const distanceToPointer = Math.hypot(pointerX - x, pointerY - y);
          const repulse = Math.max(0, 1 - distanceToPointer / 170) * pointerPull;
          const dx = Math.sin(time + step * 0.18) * cell * 0.34 + repulse * (x - pointerX) * 0.07;
          const dy =
            Math.cos(time * 0.8 + linkIndex) * cell * 0.28 +
            repulse * (y - pointerY) * 0.07 -
            scrollPressure * cell * 2;

          block(x + dx, y + dy, cell * 0.92, cell * 0.92, 0.28 + grain * 0.28);
        }
      });

      nodes.forEach((node, nodeIndex) => {
        const radius = node.size;
        for (let y = node.y - radius; y <= node.y + radius; y += cell) {
          for (let x = node.x - radius; x <= node.x + radius; x += cell) {
            const inside = Math.abs(x - node.x) < radius && Math.abs(y - node.y) < radius;
            if (!inside) continue;

            const grain = hash(Math.floor(x / cell), Math.floor(y / cell) + nodeIndex * 11);
            if (grain < 0.1) continue;

            const distanceToPointer = Math.hypot(pointerX - x, pointerY - y);
            const repulse = Math.max(0, 1 - distanceToPointer / 190) * pointerPull;
            const dx =
              Math.sin(time * 1.2 + y * 0.018) * cell * 0.32 +
              repulse * (x - pointerX) * 0.08 +
              scrollPressure * (x - centerX) * 0.012;
            const dy =
              Math.cos(time + x * 0.018) * cell * 0.28 +
              repulse * (y - pointerY) * 0.08 -
              scrollPressure * cell * 3;
            const alpha = Math.min(0.9, 0.38 + grain * 0.48);

            block(x + dx, y + dy, cell * 0.9, cell * 0.9, alpha);
          }
        }
      });
    };

    const drawPediment = (cell, time) => {
      const startX = width * 0.06;
      const startY = height * 0.64;
      const rows = 16;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col <= row; col += 1) {
          const x = startX + col * cell * 1.8 + (rows - row) * cell * 0.9;
          const y = startY + row * cell * 1.2;
          const alpha = 0.08 + row * 0.01 + Math.sin(time + col) * 0.015;
          block(x, y, cell * 1.2, cell * 1.2, alpha);
        }
      }
    };

    const render = (now = 0) => {
      const time = now * 0.001;
      const scrollMax = Math.max(1, document.body.scrollHeight - window.innerHeight);
      const scrollPressure = Math.min(1, window.scrollY / scrollMax);
      const cell = Math.max(7, Math.min(13, Math.round(width / 124)));

      ctx.clearRect(0, 0, width, height);
      drawGreekKey(cell, time);
      drawPediment(cell, time);
      drawColumns(cell, time, scrollPressure);
      drawZexvroMark(cell, time, scrollPressure);

      if (!reduceMotion) requestAnimationFrame(render);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    });
    window.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    resize();
    render(0);
  }

  function setupMorphWord() {
    if (!morphWord || reduceMotion) return;

    const words = ["MORPH", "PRIVACY", "AGENTS", "VERIFY", "DEPLOY", "ZEXVRO"];
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let index = 0;
    let timer = null;

    const scrambleTo = (word) => {
      let frame = 0;
      const total = 18;
      clearInterval(timer);

      timer = setInterval(() => {
        const resolved = Math.floor((frame / total) * word.length);
        morphWord.textContent = word
          .split("")
          .map((char, charIndex) => {
            if (charIndex < resolved) return char;
            return glyphs[Math.floor(Math.random() * glyphs.length)];
          })
          .join("");

        frame += 1;
        if (frame > total) {
          morphWord.textContent = word;
          clearInterval(timer);
        }
      }, 38);
    };

    window.setInterval(() => {
      index = (index + 1) % words.length;
      scrambleTo(words[index]);
    }, 2600);
  }

  function setupMotion() {
    if (reduceMotion || !window.gsap) return;

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    gsap.set(".site-nav", { autoAlpha: 0, y: -16 });
    gsap.set(".hero h1 span", { y: 82, autoAlpha: 0 });
    gsap.set([".hero-wordmark", ".eyebrow", ".hero-lede", ".hero-actions", ".index-panel"], {
      y: 26,
      autoAlpha: 0,
    });

    gsap
      .timeline({ defaults: { ease: "power3.out" } })
      .to(".site-nav", { autoAlpha: 1, y: 0, duration: 0.8 }, 0.1)
      .to(".hero h1 span", { y: 0, autoAlpha: 1, duration: 1.05, stagger: 0.08 }, 0.18)
      .to([".hero-wordmark", ".eyebrow", ".hero-lede", ".hero-actions"], {
        y: 0,
        autoAlpha: 1,
        duration: 0.82,
        stagger: 0.08,
      }, 0.62)
      .to(".index-panel", { y: 0, autoAlpha: 1, duration: 0.92 }, 0.72)
      .from(".hero-meta span", { y: -12, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.48);

    if (!ScrollTrigger) return;

    gsap.to("#artifact-canvas", {
      scale: 1.08,
      opacity: 0.82,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

    gsap.to(".hero-copy", {
      y: -80,
      autoAlpha: 0.34,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "35% top",
        end: "bottom top",
        scrub: true,
      },
    });

    gsap.to(".index-panel", {
      y: 70,
      autoAlpha: 0.22,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "35% top",
        end: "bottom top",
        scrub: true,
      },
    });

    gsap.to(".pixel-swarm i", {
      x: () => gsap.utils.random(-220, 220, 1),
      y: () => gsap.utils.random(-180, 180, 1),
      rotation: () => gsap.utils.random(-90, 90, 1),
      scale: () => gsap.utils.random(0.2, 1.7),
      ease: "none",
      stagger: { amount: 0.45, from: "random" },
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

    gsap.utils.toArray(".reveal").forEach((element) => {
      gsap.from(element, {
        y: 42,
        autoAlpha: 0,
        duration: 0.95,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 82%",
        },
      });
    });

    gsap.to(".chapter", {
      backgroundColor: "rgba(246, 246, 241, 0.075)",
      stagger: 0.08,
      scrollTrigger: {
        trigger: ".chapter-list",
        start: "top 72%",
        end: "bottom 38%",
        scrub: true,
      },
    });

    gsap.to(".codex-card", {
      y: (index) => (index % 2 === 0 ? -24 : 24),
      ease: "none",
      scrollTrigger: {
        trigger: ".codex-grid",
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    gsap.to(".pixel-tablet i", {
      scale: () => gsap.utils.random(0.36, 1.12),
      autoAlpha: () => gsap.utils.random(0.24, 1),
      y: () => gsap.utils.random(-18, 18, 1),
      stagger: { amount: 0.9, from: "random" },
      ease: "power2.inOut",
      scrollTrigger: {
        trigger: ".atelier",
        start: "top 72%",
        end: "bottom 45%",
        scrub: true,
      },
    });

    gsap.matchMedia().add("(min-width: 761px)", () => {
      const rite = gsap.timeline({
        scrollTrigger: {
          trigger: ".transformation",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          pin: ".transformation-sticky",
          anticipatePin: 1,
        },
      });

      rite
        .fromTo(
          ".scanline",
          { x: "-320%" },
          { x: "320%", ease: "none", duration: 1 },
          0
        )
        .to(
          ".morph-orbit",
          { rotation: 180, scale: 1.22, ease: "none", duration: 1 },
          0
        )
        .to(
          ".state-card-before",
          { x: -92, y: 32, rotation: -4, autoAlpha: 0.25, ease: "none", duration: 1 },
          0
        )
        .fromTo(
          ".state-card-after",
          { clipPath: "inset(0 100% 0 0)", x: 84, y: -22 },
          { clipPath: "inset(0 0% 0 0)", x: 0, y: 0, ease: "none", duration: 1 },
          0
        );

      return () => rite.kill();
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  buildPixelSwarm();
  const lenis = setupSmoothScroll();
  setupAnchorScroll(lenis);
  setupCanvasArtifact();
  setupMorphWord();
  setupMotion();
})();
