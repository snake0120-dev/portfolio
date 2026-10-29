/* 천우태 포트폴리오 — 공통 스크립트 */
(function () {
  'use strict';

  var PAGE_W = 1920;
  var PAGE_H = 1080;

  /* ── 페이지 진입 페이드 ───────────────────── */
  var fade = document.querySelector('.fade-layer');
  if (fade) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fade.classList.add('is-clear'); });
    });
  }

  function leaveTo(href) {
    if (!fade) { location.href = href; return; }
    fade.classList.remove('is-clear');
    fade.classList.add('is-out');
    var went = false;
    var go = function () { if (!went) { went = true; location.href = href; } };
    fade.addEventListener('transitionend', go, { once: true });
    setTimeout(go, 600);   // transitionend가 안 오는 경우 대비
  }

  // 내부 링크는 페이드를 거쳐 이동
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-transition]') : null;
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    leaveTo(a.getAttribute('href'));
  });

  /* ── UI 스케일 ──────────────────────────────
     홈은 1920×1080 캔버스를 통째로 줄여 맞춘다. 상세페이지의 버튼들도
     같은 배율(--ui)을 따라가야 홈 버튼과 크기가 맞는다.
     다만 휴대폰처럼 아주 좁은 화면에서는 버튼이 못 쓸 만큼 작아지므로
     버튼 쪽 배율에만 하한을 둔다. */
  var stage = document.getElementById('stage');

  function fit() {
    var s = Math.min(window.innerWidth / PAGE_W, window.innerHeight / PAGE_H);
    if (stage) stage.style.setProperty('--scale', s);
    document.documentElement.style.setProperty('--ui', Math.max(0.5, s));
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  if (stage) {
    // 호버한 항목만 살리고 나머지는 물러나게
    var items = Array.prototype.slice.call(stage.querySelectorAll('.item'));
    items.forEach(function (it) {
      var on = function () {
        stage.classList.add('is-hovering');
        items.forEach(function (o) { o.classList.toggle('is-active', o === it); });
      };
      var off = function () {
        stage.classList.remove('is-hovering');
        items.forEach(function (o) { o.classList.remove('is-active'); });
      };
      it.addEventListener('mouseenter', on);
      it.addEventListener('mouseleave', off);
      it.addEventListener('focus', on);
      it.addEventListener('blur', off);
    });
  }

  /* ── 상세 1: 인트로 게이트 (스킵 없음, 끝까지 재생) ── */
  var gate = document.getElementById('gate');
  if (gate) {
    var video   = gate.querySelector('video');
    var loading = gate.querySelector('.gate-load');
    var playBtn = gate.querySelector('.gate-play');
    var skipBtn = gate.querySelector('.gate-skip');
    var content = document.getElementById('content');
    var opened  = false;

    document.body.classList.add('is-gated');

    function openContent() {
      if (opened) return;
      opened = true;
      gate.classList.add('is-done');
      document.body.classList.remove('is-gated');
      if (content) content.classList.add('is-revealed');
      setTimeout(function () {
        if (gate.parentNode) gate.parentNode.removeChild(gate);
      }, 700);
    }

    video.addEventListener('ended', openContent);

    // 버퍼가 찼으면 로딩 표시를 지운다
    var ready = function () { if (loading) loading.classList.add('is-hidden'); };
    video.addEventListener('canplaythrough', ready);

    // 실제 재생이 시작된 뒤에 스킵 버튼을 올린다
    video.addEventListener('playing', function () {
      ready();
      if (skipBtn) skipBtn.classList.add('is-shown');
    });
    if (skipBtn) skipBtn.addEventListener('click', openContent);

    // 자동재생 시도 — 막히면 재생 버튼을 노출
    var tryPlay = function () {
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          if (loading) loading.classList.add('is-hidden');
          if (playBtn) playBtn.classList.add('is-shown');
        });
      }
    };
    if (video.readyState >= 2) tryPlay();
    else video.addEventListener('loadeddata', tryPlay, { once: true });

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        playBtn.classList.remove('is-shown');
        video.play();
      });
    }

    // 영상을 아예 못 받으면 막다른 길이 되지 않도록 본문을 연다
    video.addEventListener('error', openContent);
    var guard = setTimeout(function () {
      if (!opened && video.readyState < 2) openContent();
    }, 20000);
    video.addEventListener('playing', function () { clearTimeout(guard); }, { once: true });
  }

  /* ── 가로 슬라이드 (상세 1) ── */
  var book = document.getElementById('book');
  if (book) {
    var track   = document.getElementById('track');
    var pages   = Array.prototype.slice.call(book.querySelectorAll('.page'));
    var total   = pages.length;
    var at      = 0;
    var prevBtn = document.querySelector('.nav--prev');
    var nextBtn = document.querySelector('.nav--next');
    var pager   = document.getElementById('pager');

    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    /* ── 한 지면 안에서 여러 컷이 도는 구간 (상세 2의 3·4번) ──
       컷을 겹쳐 쌓아두고, 들어오는 컷만 맨 위에서 서서히 불투명해진다.
       나가는 컷은 디졸브가 끝날 때까지 불투명한 채로 밑에 깔려 있으므로
       도중에 배경이 비쳐 어두워지지 않는다. */
    var HOLD = 1500;   // 한 컷을 세워두는 시간
    var FADE = 900;    // 디졸브에 걸리는 시간

    var seqs = pages.map(function (pg) {
      var shots = Array.prototype.slice.call(pg.querySelectorAll('img'));
      if (!pg.hasAttribute('data-seq') || shots.length < 2) return null;

      var cut = 0, tick = null, settle = null;

      function show(n) {
        clearTimeout(settle);
        cut = n;
        // 나가는 컷을 먼저 한 칸 내린다 — 마지막 컷에서 첫 컷으로 돌아올 때
        // DOM 순서 때문에 들어오는 컷이 가려지는 걸 막는다
        shots.forEach(function (im, k) { if (k !== n) im.style.zIndex = 1; });
        shots[n].style.zIndex = 2;
        shots[n].style.opacity = 1;
        // 다 덮은 뒤에 아래 컷들을 끈다 — 보이지 않는 곳에서 정리되므로 깜빡임이 없다
        settle = setTimeout(function () {
          shots.forEach(function (im, k) {
            if (k === n) return;
            im.style.opacity = 0;
            im.style.zIndex = 0;
          });
        }, FADE + 60);
      }

      function stop() {
        clearInterval(tick); tick = null;
        clearTimeout(settle); settle = null;
      }

      return {
        start: function () {
          if (tick) return;
          tick = setInterval(function () { show((cut + 1) % shots.length); }, HOLD + FADE);
        },
        stop: stop,
        reset: function () {
          stop();
          pg.classList.add('is-cut');        // 되돌리는 동안에는 전환을 끈다
          shots.forEach(function (im, k) {
            im.style.opacity = k === 0 ? 1 : 0;
            im.style.zIndex  = k === 0 ? 2 : 0;
          });
          void pg.offsetWidth;               // 리플로를 강제해 즉시 반영
          pg.classList.remove('is-cut');
          cut = 0;
        }
      };
    });

    // 펼쳐진 지면의 루프만 돌린다 — 들어올 때는 늘 첫 컷부터
    function tune() {
      seqs.forEach(function (sq, k) {
        if (!sq) return;
        if (k === at && !document.hidden) { sq.reset(); sq.start(); }
        else sq.stop();
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { seqs.forEach(function (sq) { if (sq) sq.stop(); }); }
      else tune();
    });

    function paint() {
      track.style.transform = 'translate3d(' + (-at * 100) + '%, 0, 0)';
      if (prevBtn) prevBtn.disabled = (at === 0);
      if (nextBtn) nextBtn.disabled = (at === total - 1);
      if (pager) pager.textContent = pad(at + 1) + ' / ' + pad(total);
      tune();
    }

    // 클릭·키는 막지 않는다. 연속으로 넘겨도 CSS 전환이 알아서 이어받는다.
    // (휠/트랙패드만 아래에서 따로 쿨다운을 둔다 — 한 번 스와이프에 여러 장 넘어가지 않게)
    function go(n) {
      n = Math.max(0, Math.min(total - 1, n));
      if (n === at) return;
      at = n;
      paint();
    }
    var next = function () { go(at + 1); };
    var prev = function () { go(at - 1); };

    if (nextBtn) nextBtn.addEventListener('click', next);
    if (prevBtn) prevBtn.addEventListener('click', prev);

    // 지면을 클릭하면 좌/우 절반으로 넘긴다
    book.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      if (e.clientX < window.innerWidth / 2) prev(); else next();
    });

    // 키보드
    document.addEventListener('keydown', function (e) {
      if (document.body.classList.contains('is-gated')) return;
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': next(); e.preventDefault(); break;
        case 'ArrowLeft':  case 'PageUp':            prev(); e.preventDefault(); break;
        case 'Home': go(0);         e.preventDefault(); break;
        case 'End':  go(total - 1); e.preventDefault(); break;
      }
    });

    // 휠 / 트랙패드 — 가로든 세로든 큰 쪽을 따른다
    var wheelAt = 0;
    book.addEventListener('wheel', function (e) {
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 18) return;
      var now = Date.now();
      if (now - wheelAt < 520) return;
      wheelAt = now;
      if (d > 0) next(); else prev();
    }, { passive: true });

    // 터치 스와이프
    var tx = 0, ty = 0;
    book.addEventListener('touchstart', function (e) {
      tx = e.changedTouches[0].clientX;
      ty = e.changedTouches[0].clientY;
    }, { passive: true });
    book.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx;
      var dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) next(); else prev();
    }, { passive: true });

    // 가만히 두면 조작 UI를 물린다 — 이미지에 박힌 캡션을 가리지 않게
    var idleAt;
    function wake() {
      document.body.classList.remove('is-idle');
      clearTimeout(idleAt);
      idleAt = setTimeout(function () {
        document.body.classList.add('is-idle');
      }, 2600);
    }
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, wake, { passive: true });
    });

    paint();
    wake();
  }

  /* ── 상세 3: 릴 재생과 종료 화면 ── */
  var reel = document.getElementById('reel');
  if (reel) {
    var endUI    = document.getElementById('reelEnd');
    var replay   = document.getElementById('replay');
    var soundBtn = document.getElementById('sound');

    var kick = function () {
      var p = reel.play();
      if (p && typeof p.catch === 'function') { p.catch(function () {}); }
    };

    function paintSound() {
      if (!soundBtn) return;
      soundBtn.textContent = reel.muted ? 'SOUND ON' : 'SOUND OFF';
      soundBtn.setAttribute('aria-pressed', reel.muted ? 'false' : 'true');
    }

    // 소리를 켠 채 자동재생을 먼저 시도하고, 브라우저가 막으면 음소거로 되돌린다.
    // (대부분의 브라우저는 사용자 조작 없이 소리 있는 자동재생을 막는다 —
    //  그 경우 아래 SOUND ON 버튼을 한 번 누르면 켜진다)
    function start() {
      reel.muted = false;
      var p = reel.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          reel.muted = true;
          paintSound();
          kick();
        });
      }
      paintSound();
    }
    if (reel.readyState >= 2) start();
    else reel.addEventListener('loadeddata', start, { once: true });

    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        reel.muted = !reel.muted;
        if (!reel.muted && reel.paused) kick();
        paintSound();
      });
      paintSound();
    }

    // 끝나면 첫 프레임으로 되감아 세우고, 흐린 배경 위로 버튼을 올린다
    reel.addEventListener('ended', function () {
      reel.pause();
      try { reel.currentTime = 0; } catch (e) {}
      document.body.classList.add('is-ended');
      if (endUI) endUI.classList.add('is-shown');
    });

    if (replay) {
      replay.addEventListener('click', function () {
        document.body.classList.remove('is-ended');
        if (endUI) endUI.classList.remove('is-shown');
        try { reel.currentTime = 0; } catch (e) {}
        kick();
      });
    }

    // 탭으로 돌아왔을 때 멈춰 있으면 다시 재생 — 단, 끝난 상태는 그대로 둔다
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (document.body.classList.contains('is-ended')) return;
      if (reel.paused) kick();
    });
  }
})();
