/* Undefined Behavior — vinyl liner notes portfolio */

(function () {
  'use strict';

  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
  }

  /* ── Needle-drop init ─────────────────────────────────────
     Heavy grain + content blur on load → scratch sweep → reveal.
     Skipped on repeat visits (sessionStorage) and when the user
     has prefers-reduced-motion. Also dismissable via click / Esc.
  ──────────────────────────────────────────────────────────── */
  function initNeedleDrop() {
    const body    = document.body;
    const scratch = document.getElementById('scratch-line');
    const grain   = document.querySelector('.grain-overlay');

    if (!scratch) return;

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let visited = false;
    try { visited = sessionStorage.getItem('rz-visited') === '1'; } catch (_) {}

    if (reducedMotion || visited) {
      body.classList.remove('is-loading');
      if (grain) grain.style.setProperty('--grain-opacity', '0.5');
      return;
    }

    try { sessionStorage.setItem('rz-visited', '1'); } catch (_) {}

    if (grain) grain.style.setProperty('--grain-opacity', '0.75');
    body.classList.add('is-loading');

    const timers = [];
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      body.classList.remove('is-loading');
      if (grain) grain.style.setProperty('--grain-opacity', '0.5');
      scratch.classList.remove('animating');
      document.removeEventListener('click', skipClick, true);
      document.removeEventListener('keydown', skipKey, true);
    }

    function skipClick(e) {
      // Let real link / button clicks through unmolested
      if (e.target.closest && e.target.closest('a, button, .vinyl-wrapper')) {
        finish();
        return;
      }
      finish();
    }
    function skipKey(e) {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') finish();
    }

    document.addEventListener('click', skipClick, true);
    document.addEventListener('keydown', skipKey, true);

    timers.push(setTimeout(function () { scratch.classList.add('animating'); }, 200));
    timers.push(setTimeout(finish, 1100));
  }

  /* ── Grain fades as cover scrolls away ───────────────────── */
  function initGrainFade() {
    const grain = document.querySelector('.grain-overlay');
    const cover = document.getElementById('cover');
    if (!grain || !cover) return;

    function update() {
      const bottom = cover.getBoundingClientRect().bottom;
      const vh     = window.innerHeight;
      const pct    = Math.max(0, Math.min(1, bottom / (vh * 0.25)));
      const opacity = 0.12 + pct * (0.5 - 0.12);
      grain.style.setProperty('--grain-opacity', opacity.toFixed(3));
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ── Scroll progress bar ─────────────────────────────────── */
  function initScrollProgress() {
    const fill  = document.getElementById('progress-fill');
    const fader = document.getElementById('progress-fader');
    if (!fill) return;

    function update() {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = (total > 0 ? (window.scrollY / total) * 100 : 0).toFixed(2);
      fill.style.width = pct + '%';
      if (fader) fader.style.left = pct + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ── Active nav link + side indicator ───────────────────── */
  const SIDE_LABELS = {
    'cover':       'SIDE A · Track 1',
    'tracks':      'SIDE A · Track Listing',
    'liner-notes': 'SIDE A · Liner Notes',
    'sessions':    'SIDE B · Sessions',
    'credits':     'SIDE B · Credits',
  };

  function initActiveSection() {
    const links     = Array.from(document.querySelectorAll('.nav-link'));
    const indicator = document.getElementById('side-indicator');
    const sections  = Array.from(document.querySelectorAll('.section'));
    const navH      = parseInt(getComputedStyle(document.documentElement)
                        .getPropertyValue('--nav-h')) || 40;

    function update() {
      const mid = window.scrollY + window.innerHeight * 0.4;
      let active = sections[0];
      sections.forEach(function (s) {
        if (mid >= s.getBoundingClientRect().top + window.scrollY - navH) active = s;
      });

      const id = active.id;
      links.forEach(function (l) { l.classList.toggle('active', l.dataset.section === id); });
      if (indicator && SIDE_LABELS[id]) {
        // Music takeover: stash the section label in a data attr so the
        // music toggle can restore it without us fighting on every scroll.
        indicator.dataset.sectionLabel = SIDE_LABELS[id];
        if (!document.body.classList.contains('music-playing')) {
          indicator.textContent = SIDE_LABELS[id];
        }
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ── Vinyl disc pauses when cover is offscreen ───────────
     Adds/removes .paused on .disc-stage so the spinning CD AND
     the conic-gradient reflection both pause together. Music
     playback overrides this — when music plays the disc keeps
     spinning regardless of scroll position. */
  function initVinylPause() {
    const stage = document.querySelector('.disc-stage');
    const cover = document.getElementById('cover');
    if (!stage || !cover) return;

    new IntersectionObserver(function (entries) {
      if (document.body.classList.contains('music-playing')) {
        stage.classList.remove('paused');
        return;
      }
      if (entries[0].isIntersecting) stage.classList.remove('paused');
      else stage.classList.add('paused');
    }, { threshold: 0.05 }).observe(cover);
  }

  /* ── Stylus arm rotates with overall scroll position ──────
     The arm physically tracks across the disc as the user scrolls,
     going from ~14° (outer edge / track 1) to ~44° (inner / run-out
     groove). On top of that, a tiny continuous wobble (±0.45°) keeps
     it "alive" even when stationary — like a needle riding micro-
     grooves. Reduced-motion users get scroll tracking only, no
     wobble. The base transform is set inline every frame so the
     CSS static rotation never wins specificity. */
  function initStylusScrollTracking() {
    const arm = document.getElementById('stylusarm');
    if (!arm) return;

    const MIN = 14;
    const MAX = 44;

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let scrollDeg = MIN;
    let raf = 0;

    function recalc() {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0
        ? Math.min(1, Math.max(0, window.scrollY / total))
        : 0;
      scrollDeg = MIN + pct * (MAX - MIN);
    }

    function tick(now) {
      // Two-frequency wobble — slow drift + quick jitter, summed
      const slow = Math.sin(now / 1100) * 0.35;
      const fast = Math.sin(now / 230)  * 0.12;
      const wobble = reducedMotion ? 0 : (slow + fast);
      arm.style.transform = 'rotate(' + (scrollDeg + wobble).toFixed(3) + 'deg)';
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('resize', recalc, { passive: true });
    recalc();
    raf = requestAnimationFrame(tick);
  }

  /* ── Mini VU meter — scroll velocity → bar heights ───────
     Each scroll event measures dy/dt; bars heights respond and
     decay back down on idle, like real VU needles bouncing. */
  function initVU() {
    const bars = Array.from(document.querySelectorAll('.vu-bar'));
    if (!bars.length) return;

    let vel = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let raf = 0;

    window.addEventListener('scroll', function () {
      const now = performance.now();
      const dy = window.scrollY - lastY;
      const dt = now - lastT;
      if (dt > 0) {
        const v = Math.abs(dy) / dt * 18;
        vel = Math.max(vel, Math.min(75, v));
      }
      lastY = window.scrollY;
      lastT = now;
    }, { passive: true });

    function tick() {
      bars.forEach(function (bar, i) {
        const jitter = 0.65 + Math.random() * 0.45;
        const h = 22 + vel * jitter * (i === 1 ? 1 : 0.85);
        bar.style.height = Math.min(95, h).toFixed(0) + '%';
        bar.style.opacity = (0.45 + Math.min(0.45, vel / 100)).toFixed(2);
      });
      vel *= 0.86;  // decay toward rest
      raf = requestAnimationFrame(tick);
    }
    tick();
  }

  /* ── lotsofCD: scroll-driven blur → clear ────────────────
     Continuously updates blur and opacity based on how far the
     tracks section has scrolled into view.
  ──────────────────────────────────────────────────────────── */
  function initCDScrollBlur() {
    const img     = document.getElementById('tracks-cd-deco');
    const section = document.getElementById('tracks');
    if (!img || !section) return;

    const trackSides = section.querySelector('.tracks-sides');

    function update() {
      const top  = section.getBoundingClientRect().top;
      const vh   = window.innerHeight;

      // progress: 0 when section.top = 60% of vh; 1 when section.top = 0
      const progress = Math.min(1, Math.max(0, (vh * 0.6 - top) / (vh * 0.6)));

      // Image: blur 15→0, opacity 0.18→0.36
      const blur    = 15 * (1 - progress);
      const gray    = 0.2 * (1 - progress);
      const opacity = 0.18 + progress * 0.18;

      img.style.filter  = 'blur(' + blur.toFixed(1) + 'px) grayscale(' + gray.toFixed(2) + ')';
      img.style.opacity = opacity.toFixed(3);

      // Track content: whole section clears together with scroll
      if (trackSides) {
        trackSides.style.filter  = 'blur(' + (5 * (1 - progress)).toFixed(1) + 'px)';
        trackSides.style.opacity = (0.35 + progress * 0.65).toFixed(3);
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ── Typewriter effect for Liner Notes ───────────────────
     Text in liner-dropcap and liner-body types out char-by-char
     when the section enters view. Skills section fades in after.
  ──────────────────────────────────────────────────────────── */
  function initTypewriter() {
    const section  = document.getElementById('liner-notes');
    if (!section) return;

    const typedEls = Array.from(document.querySelectorAll('#liner-notes .liner-body'));
    const skillsEl = document.querySelector('#liner-notes .liner-skills');
    if (!typedEls.length) return;

    // Normalize whitespace and store original text
    typedEls.forEach(function (el) {
      el.dataset.twText = el.textContent.replace(/\s+/g, ' ').trim();
      el.textContent = '';
    });

    // Skills hidden initially; fade in after typing completes
    if (skillsEl) {
      skillsEl.style.opacity = '0';
      skillsEl.style.transition = 'opacity 0.7s ease';
    }

    // Blinking cursor that moves between elements
    var cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    cursor.textContent = '|';

    var started = false;

    var obs = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || started) return;
      started = true;
      obs.disconnect();

      var elIdx   = 0;
      var charIdx = 0;
      var SPEED   = 8;   // ms per character — fast but visible
      var PAUSE   = 55;  // ms pause between paragraphs

      function type() {
        if (elIdx >= typedEls.length) {
          // All done: remove cursor, reveal skills
          cursor.remove();
          if (skillsEl) skillsEl.style.opacity = '1';
          return;
        }

        var el   = typedEls[elIdx];
        var text = el.dataset.twText;

        if (charIdx < text.length) {
          // Rebuild: text node + cursor (avoids innerHTML injection)
          while (el.firstChild) el.removeChild(el.firstChild);
          el.appendChild(document.createTextNode(text.slice(0, charIdx + 1)));
          el.appendChild(cursor);
          charIdx++;
          setTimeout(type, SPEED);
        } else {
          // This element done: set final text, move on
          el.textContent = text;
          elIdx++;
          charIdx = 0;
          setTimeout(type, PAUSE);
        }
      }

      // Small initial delay before typing starts
      setTimeout(type, 250);
    }, { threshold: 0.15 });

    obs.observe(section);
  }

  /* ── Sessions: parallax waveform background ─────────────── */
  function initSessionsWaveform() {
    const waveEl  = document.getElementById('sessions-waveform');
    const section = document.getElementById('sessions');
    if (!waveEl || !section) return;

    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) waveEl.classList.add('revealed');
    }, { threshold: 0.05 }).observe(section);

    function updateParallax() {
      const top = section.getBoundingClientRect().top;
      waveEl.style.transform = 'translateY(' + (top * -0.22).toFixed(1) + 'px)';
    }

    window.addEventListener('scroll', updateParallax, { passive: true });
    updateParallax();
  }

  /* ── Credits stamp: scale-in "stamp slap" ─────────────── */
  function initStamp() {
    const stamp = document.getElementById('credits-stamp');
    if (!stamp) return;

    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) stamp.classList.add('revealed');
    }, { threshold: 0.5 }).observe(stamp);
  }

  /* ── Track items → smooth scroll to section ─────────────── */
  function initTrackNav() {
    document.querySelectorAll('.track-item[data-target]').forEach(function (item) {
      item.addEventListener('click', function () {
        var target = document.querySelector(item.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ── Tab switching with vinyl-flip animation ────────────
     Active grid rotateY's edge-on, then the new grid rotates in
     from the opposite side. data-side attribute on the section
     drives a subtle background tint shift between A / B / Bonus. */
  const TAB_SIDES = { experience: 'a', projects: 'b', research: 'bonus' };

  function initTabs() {
    const btns    = Array.from(document.querySelectorAll('.tab-btn'));
    const panels  = Array.from(document.querySelectorAll('.tab-content'));
    const section = document.querySelector('.sessions-section');
    if (!btns.length) return;

    // Initialise data-side on first paint
    const initialActive = document.querySelector('.tab-btn.active');
    if (section && initialActive) {
      section.setAttribute('data-side', TAB_SIDES[initialActive.dataset.tab] || 'a');
    }

    let busy = false;

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        const current = document.querySelector('.tab-content.active');
        const next    = document.getElementById('tab-' + btn.dataset.tab);
        if (!current || !next || current === next) return;

        busy = true;
        current.classList.add('flipping-out');

        setTimeout(function () {
          current.classList.remove('active', 'flipping-out');
          next.classList.add('active', 'flipping-in');

          // Force reflow so the flipping-in starting transform applies
          void next.offsetWidth;
          next.classList.remove('flipping-in');

          btns.forEach(function (b) {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');

          if (section) {
            section.setAttribute('data-side', TAB_SIDES[btn.dataset.tab] || 'a');
          }

          setTimeout(function () { busy = false; }, 420);
        }, 320);
      });
    });
  }

  /* ── Keyboard section navigation (↑ ↓) ──────────────────── */
  function initKeyboardNav() {
    var sections = Array.from(document.querySelectorAll('.section'));
    var navH     = parseInt(getComputedStyle(document.documentElement)
                     .getPropertyValue('--nav-h')) || 40;

    document.addEventListener('keydown', function (e) {
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();

      var mid = window.scrollY + window.innerHeight * 0.4;
      var idx = 0;
      sections.forEach(function (s, i) {
        if (mid >= s.getBoundingClientRect().top + window.scrollY - navH) idx = i;
      });

      var next = e.key === 'ArrowDown'
        ? Math.min(idx + 1, sections.length - 1)
        : Math.max(idx - 1, 0);

      sections[next].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ── Fade-in for cards and credit blocks ─────────────────── */
  function initFadeIn() {
    var targets = document.querySelectorAll('.session-card, .margin-note, .credit-block');
    if (!('IntersectionObserver' in window)) return;

    targets.forEach(function (el) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(14px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.opacity   = '1';
        el.style.transform = '';
        // After transition completes, wipe all inline styles so CSS
        // hover transitions (transform, box-shadow) can take over cleanly
        setTimeout(function () {
          el.style.opacity         = '';
          el.style.transform       = '';
          el.style.transition      = '';
          el.style.transitionDelay = '';
        }, 600);
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

    targets.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 0.07 + 's';
      obs.observe(el);
    });
  }

  /* ── Disc click → play / stop vinyl music ────────────────
     Click toggles playback. Tries to load `public/vinyl-music.mp3`
     first — if the user has dropped a real MP3 there, that plays.
     If not, falls back to a synthesized lo-fi piano arpeggio
     (Em–C–G–D, slow, with reverb-ish feedback delay). A constant
     vinyl crackle plays underneath either source. Click again to
     stop. While playing, the disc spins regardless of scroll, the
     side-indicator in the nav switches to NOW PLAYING. */
  const MUSIC_FILE_PATH = 'public/vinyl-music.mp3';

  function initDiscMusic() {
    const wrapper   = document.getElementById('vinyl-wrapper');
    const disc      = document.getElementById('vinyl-disc');
    const stage     = document.querySelector('.disc-stage');
    const indicator = document.getElementById('side-indicator');
    if (!wrapper) return;

    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', 'Drop the needle — play vinyl music. Click again to stop.');
    wrapper.setAttribute('aria-pressed', 'false');

    let ctx = null;
    let masterGain = null;
    let activeNodes = [];
    let synthLoopId = 0;
    let isPlaying = false;
    let preloadPromise = null;
    let preloadedBuffer = null;
    let preloadFailed = false;

    function ensureCtx() {
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return false;
        ctx = new Ctor();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(ctx.destination);
      }
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return true;
    }

    function preload() {
      if (preloadPromise) return preloadPromise;
      if (preloadFailed) return Promise.resolve(null);
      preloadPromise = fetch(MUSIC_FILE_PATH)
        .then(function (r) {
          if (!r.ok) throw new Error('no-file');
          return r.arrayBuffer();
        })
        .then(function (ab) { return ctx.decodeAudioData(ab); })
        .then(function (buf) { preloadedBuffer = buf; return buf; })
        .catch(function () { preloadFailed = true; return null; });
      return preloadPromise;
    }

    /* Layered crackle (continuous loop while music plays) */
    function startCrackle() {
      const sr  = ctx.sampleRate;
      const len = Math.floor(sr * 2.0);
      const buf = ctx.createBuffer(1, len, sr);
      const d   = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 4;
      }
      for (let p = 0; p < 14; p++) {
        const idx = Math.floor(Math.random() * (len - 80));
        for (let j = 0; j < 60; j++) {
          d[idx + j] += (Math.random() * 2 - 1) * Math.exp(-j / 14) * 0.55;
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5200;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.6);

      src.connect(hp).connect(lp).connect(g).connect(masterGain);
      src.start();
      activeNodes.push({ src: src, gain: g });
    }

    /* Loaded MP3 path: simple loop into the master bus */
    function startLoadedTrack(buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.85;
      src.connect(g).connect(masterGain);
      src.start();
      activeNodes.push({ src: src, gain: g });
    }

    /* Synthesized fallback: slow Em–C–G–D arpeggio with reverb-ish
       feedback delay and chorus detune. Loops by re-scheduling. */
    function playSynthChunk(startAt) {
      const beat = 0.95;                    // ~63 BPM
      // Frequencies (Hz)
      const N = {
        E2: 82.41,  G2: 98.00, A2: 110.00, B2: 123.47,
        C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00,
        A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66,
        E4: 329.63, G4: 392.00, B4: 493.88, D5: 587.33
      };
      // bass + arpeggio + soft top note per chord
      const chords = [
        { bass: N.E2, arp: [N.E3, N.G3, N.B3, N.E4], top: N.G4 }, // Em
        { bass: N.C3, arp: [N.C3, N.E3, N.G3, N.C4], top: N.E4 }, // C
        { bass: N.G2, arp: [N.G2, N.B2, N.D3, N.G3], top: N.D4 }, // G
        { bass: N.D3, arp: [N.D3, N.A3, N.D4, N.B3], top: N.G4 }  // D
      ];

      // Reverb-ish feedback delay
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.32;
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.27;
      const fb = ctx.createGain();
      fb.gain.value = 0.42;
      delay.connect(fb).connect(delay);
      delay.connect(wetGain).connect(masterGain);

      const dry = ctx.createGain();
      dry.gain.value = 0.6;
      dry.connect(masterGain);

      const sources = [];
      let totalEnd = startAt;

      chords.forEach(function (c, ci) {
        const chordStart = startAt + ci * 4 * beat;

        // Bass — sustained sine, soft attack
        sources.push(scheduleNote({
          freq: c.bass, start: chordStart, dur: beat * 4,
          type: 'sine', gain: 0.18, dryGain: dry, wetGain: wetGain
        }));

        // Arpeggio — 4 notes, triangle with slight detune for chorus
        c.arp.forEach(function (f, ni) {
          const t = chordStart + ni * beat;
          sources.push(scheduleNote({
            freq: f, start: t, dur: beat * 1.8,
            type: 'triangle', gain: 0.13, dryGain: dry, wetGain: wetGain,
            detune: -6
          }));
          sources.push(scheduleNote({
            freq: f, start: t, dur: beat * 1.8,
            type: 'triangle', gain: 0.10, dryGain: dry, wetGain: wetGain,
            detune: 7
          }));
        });

        // Top sustain — held airy note for whole chord
        sources.push(scheduleNote({
          freq: c.top, start: chordStart, dur: beat * 4,
          type: 'sine', gain: 0.07, dryGain: dry, wetGain: wetGain,
          lpFreq: 2400
        }));

        totalEnd = chordStart + 4 * beat;
      });

      activeNodes.push({ sources: sources, dryGain: dry, wetGain: wetGain });
      return totalEnd;  // when this 4-bar chunk ends
    }

    function scheduleNote(o) {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.setValueAtTime(o.freq, o.start);
      if (o.detune) osc.detune.setValueAtTime(o.detune, o.start);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lpFreq || 1700;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, o.start);
      g.gain.linearRampToValueAtTime(o.gain, o.start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0008, o.start + o.dur);

      osc.connect(lp).connect(g);
      g.connect(o.dryGain);
      g.connect(o.wetGain);
      osc.start(o.start);
      osc.stop(o.start + o.dur + 0.05);
      return osc;
    }

    function startSynthLoop() {
      let nextAt = ctx.currentTime + 0.05;
      const myId = ++synthLoopId;

      function schedule() {
        if (!isPlaying || myId !== synthLoopId) return;
        nextAt = playSynthChunk(nextAt);
        // schedule next chunk slightly before this one ends for seamless loop
        const wait = (nextAt - ctx.currentTime - 0.5) * 1000;
        setTimeout(schedule, Math.max(50, wait));
      }
      schedule();
    }

    function setIndicatorPlaying(on) {
      if (!indicator) return;
      if (on) {
        indicator.classList.add('is-playing');
        indicator.textContent = 'NOW PLAYING';
      } else {
        indicator.classList.remove('is-playing');
        // Restore whatever section the user is currently looking at
        const restore = indicator.dataset.sectionLabel || 'SIDE A · Track 1';
        indicator.textContent = restore;
      }
    }

    function start() {
      if (!ensureCtx()) return;
      if (isPlaying) return;
      isPlaying = true;
      wrapper.setAttribute('aria-pressed', 'true');
      document.body.classList.add('music-playing');
      if (stage) stage.classList.remove('paused');
      setIndicatorPlaying(true);

      // Fade master in
      const t = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.linearRampToValueAtTime(1.0, t + 0.5);

      startCrackle();

      preload().then(function (buf) {
        if (!isPlaying) return;
        if (buf) startLoadedTrack(buf);
        else     startSynthLoop();
      });

      // Brief disc press flash
      if (disc) {
        disc.style.transition = 'filter 0.18s ease';
        disc.style.filter = 'drop-shadow(0 14px 34px rgba(0,0,0,0.28)) brightness(1.1)';
        setTimeout(function () {
          disc.style.filter = '';
          disc.style.transition = '';
        }, 360);
      }
    }

    function stop() {
      if (!isPlaying) return;
      isPlaying = false;
      synthLoopId++;  // invalidate any pending synth chunks
      wrapper.setAttribute('aria-pressed', 'false');
      document.body.classList.remove('music-playing');
      setIndicatorPlaying(false);

      const t = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.linearRampToValueAtTime(0, t + 0.6);

      // Stop all sources after fade
      const toStop = activeNodes.slice();
      activeNodes = [];
      setTimeout(function () {
        toStop.forEach(function (n) {
          try { if (n.src) n.src.stop(); } catch (_) {}
          if (n.sources) n.sources.forEach(function (s) {
            try { s.stop(); } catch (_) {}
          });
        });
      }, 700);
    }

    function toggle() { isPlaying ? stop() : start(); }

    wrapper.addEventListener('click', toggle);
    wrapper.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    initNeedleDrop();
    initGrainFade();
    initScrollProgress();
    initActiveSection();
    initVinylPause();
    initStylusScrollTracking();
    initVU();
    initCDScrollBlur();
    initTypewriter();
    initSessionsWaveform();
    initStamp();
    initTrackNav();
    initTabs();
    initKeyboardNav();
    initFadeIn();
    initDiscMusic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
