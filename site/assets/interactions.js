(function () {
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- scroll reveal ----
  var revealEls = document.querySelectorAll('.reveal');
  function revealNow(el) { el.classList.add('in-view'); }
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(revealNow);
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            revealNow(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = (i % 6) * 70 + 'ms';
      // Elements already on/near screen at load (above-the-fold content,
      // or a very tall viewport) may never fire a fresh IO callback since
      // nothing changes after this point — reveal them immediately.
      var rect = el.getBoundingClientRect();
      var alreadyVisible = rect.top < window.innerHeight * 1.1 && rect.bottom > 0;
      if (alreadyVisible) {
        revealNow(el);
      } else {
        io.observe(el);
      }
    });
  }
  // Safety net: never let content stay invisible if the observer
  // misbehaves for any reason (e.g. font-swap layout shifts).
  setTimeout(function () { revealEls.forEach(revealNow); }, 1200);

  // ---- count-up stats ----
  var statEls = document.querySelectorAll('.stat b[data-target]');
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = el.getAttribute('data-decimals') ? parseInt(el.getAttribute('data-decimals'), 10) : 0;
    if (reduceMotion) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }
    var duration = 1200;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = target * eased;
      el.textContent = val.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (statEls.length) {
    if ('IntersectionObserver' in window) {
      var statIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              countUp(entry.target);
              statIo.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      statEls.forEach(function (el) { statIo.observe(el); });
    } else {
      statEls.forEach(countUp);
    }
  }

  // ---- card spotlight tracking ----
  document.querySelectorAll('.card, .price-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
    });
  });

  // ---- hero particle network ----
  var canvas = document.querySelector('canvas.hero-net');
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [];
    var w, h;
    var mouse = { x: null, y: null };

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initNodes() {
      var count = Math.max(18, Math.min(46, Math.floor((w * h) / 26000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
        });
      }
    }

    resize();
    initNodes();
    window.addEventListener('resize', function () {
      resize();
      initNodes();
    });
    window.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    window.addEventListener('mouseleave', function () {
      mouse.x = null;
      mouse.y = null;
    });

    var linkDist = 150;
    function tick() {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach(function (n) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x;
          var dy = nodes[i].y - nodes[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDist) {
            ctx.strokeStyle = 'rgba(201,160,110,' + (0.16 * (1 - dist / linkDist)) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        if (mouse.x !== null) {
          var mdx = nodes[i].x - mouse.x;
          var mdy = nodes[i].y - mouse.y;
          var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < linkDist * 1.3) {
            ctx.strokeStyle = 'rgba(201,160,110,' + (0.3 * (1 - mdist / (linkDist * 1.3))) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(201,160,110,0.75)';
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
