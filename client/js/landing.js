/* ============================================================================
   Landing page interactions: animated network canvas
   ========================================================================== */

(function networkBackground() {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w, h, nodes;
  const NODE_COUNT = 70;
  const MAX_DIST = 150;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function init() {
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }

    // links
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.35;
          ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // nodes
    for (const n of nodes) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  resize();
  init();
  step();
  window.addEventListener('resize', () => { resize(); init(); });
})();

// Redirect already-authenticated visitors straight to the dashboard
(async function checkSession() {
  try {
    await Marsh.auth.me();
    const cta = document.getElementById('open-dashboard');
    if (cta) cta.textContent = 'Go to Dashboard';
  } catch (_) {
    /* not logged in — stay on landing */
  }
})();
