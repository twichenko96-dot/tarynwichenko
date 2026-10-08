(function(){
  'use strict';

  /* ---------- Reveal on scroll ---------- */
  var revealObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  function refreshReveal(){
    document.querySelectorAll('.world.active .reveal').forEach(function(el){
      revealObserver.observe(el);
    });
  }

  /* ---------- World switch (Voiceover / Acting) ---------- */
  var worlds = document.querySelectorAll('.world');
  var worldLinks = document.querySelectorAll('[data-world-link]');
  var gotoEls = document.querySelectorAll('[data-goto]');

  function setWorld(name){
    worlds.forEach(function(w){
      w.classList.toggle('active', w.id === 'world-' + name);
    });
    worldLinks.forEach(function(a){
      if (a.dataset.worldLink === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.classList.toggle('theme-vo', name === 'voiceover');
    document.body.classList.toggle('theme-acting', name === 'acting');
    // pause any playing audio when switching worlds
    document.querySelectorAll('.player.playing').forEach(stopPlayer);
    refreshReveal();
  }

  // Links without data-goto (e.g. "About") scroll within whichever world is showing.
  document.querySelectorAll('[data-scroll]:not([data-goto])').forEach(function(el){
    el.addEventListener('click', function(e){
      var section = document.querySelector('.world.active [data-section="' + el.dataset.scroll + '"]');
      if (!section) return;
      e.preventDefault();
      section.scrollIntoView({behavior:'smooth'});
    });
  });

  gotoEls.forEach(function(el){
    el.addEventListener('click', function(e){
      var target = el.dataset.goto;
      if (!target) return;
      e.preventDefault();
      setWorld(target);
      var section = el.dataset.scroll && document.getElementById(el.dataset.scroll);
      if (section) section.scrollIntoView({behavior:'smooth'});
      else window.scrollTo({top:0, behavior:'smooth'});
    });
  });

  // Always open on the Voiceover main page, at the top, whatever hash or
  // scroll position the browser remembers from a previous visit.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash && history.replaceState) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  setWorld('voiceover');
  window.scrollTo(0, 0);

  /* ---------- About: read the full story ---------- */
  var moreBtn = document.querySelector('.vo-more-toggle');
  var moreBody = document.getElementById('about-full');
  if (moreBtn && moreBody) {
    moreBtn.addEventListener('click', function(){
      var open = moreBody.hidden;
      moreBody.hidden = !open;
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      moreBtn.textContent = open ? 'Show less ↑' : 'Read the full story →';
    });
  }

  /* ---------- Audio players ---------- */
  var players = document.querySelectorAll('.player[data-cat]:not(.soon)');
  var audioMap = new Map();

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function stopPlayer(player){
    var audio = audioMap.get(player);
    if (audio) audio.pause();
    player.classList.remove('playing');
  }

  /* ---------- Demo play / listen-time tracking (GoatCounter events) ---------- */
  function trackDemoEvent(path, title){
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: path, title: title, event: true });
    } else {
      window._gcQueue = window._gcQueue || [];
      window._gcQueue.push({ path: path, title: title });
    }
  }

  function bucketListenSeconds(sec){
    if (sec < 10) return '0-10s';
    if (sec < 30) return '10-30s';
    if (sec < 60) return '30-60s';
    if (sec < 90) return '60-90s';
    return '90s+';
  }

  players.forEach(function(player){
    var btn = player.querySelector('.play-btn');
    var wave = player.querySelector('.wave');
    var timeEl = player.querySelector('.player-time');
    var srcUrl = player.dataset.src;
    var duration = parseInt(player.dataset.dur || '0', 10);
    var category = player.dataset.cat || 'demo';
    var audio = null;
    var listenAccum = 0;
    var lastTime = 0;

    function flushListenTime(){
      if (listenAccum >= 1) {
        trackDemoEvent(
          'demo-listen/' + category + '/' + bucketListenSeconds(listenAccum),
          'Listened to ' + category + ' demo (~' + Math.round(listenAccum) + 's)'
        );
      }
      listenAccum = 0;
    }

    if (srcUrl) {
      audio = new Audio(srcUrl);
      audio.preload = 'none';
      audioMap.set(player, audio);

      audio.addEventListener('loadedmetadata', function(){
        duration = audio.duration || duration;
      });
      audio.addEventListener('timeupdate', function(){
        var pct = duration ? (audio.currentTime / duration) * 100 : 0;
        wave.style.setProperty('--progress', pct + '%');
        if (timeEl) timeEl.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(duration);

        var delta = audio.currentTime - lastTime;
        if (delta > 0 && delta < 1.5) listenAccum += delta;
        lastTime = audio.currentTime;
      });
      audio.addEventListener('seeking', function(){
        lastTime = audio.currentTime;
      });
      audio.addEventListener('pause', flushListenTime);
      audio.addEventListener('ended', function(){
        player.classList.remove('playing');
        wave.style.setProperty('--progress', '0%');
        if (timeEl) timeEl.textContent = fmtTime(duration);
        trackDemoEvent('demo-complete/' + category, 'Finished ' + category + ' demo');
      });
    }

    btn.addEventListener('click', function(){
      if (!audio) {
        // No local audio file configured yet — fall back to the external link.
        var fallback = player.querySelector('.player-link');
        if (fallback) window.open(fallback.href, '_blank', 'noopener');
        return;
      }
      var isPlaying = player.classList.contains('playing');
      // stop all other players first
      players.forEach(function(p){ if (p !== player) stopPlayer(p); });
      if (isPlaying) {
        audio.pause();
        player.classList.remove('playing');
      } else {
        lastTime = audio.currentTime;
        trackDemoEvent('demo-play/' + category, 'Played ' + category + ' demo');
        audio.play().catch(function(){ /* ignore autoplay/network errors */ });
        player.classList.add('playing');
      }
    });

    wave.addEventListener('click', function(e){
      if (!audio || !duration) return;
      var rect = wave.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      pct = Math.min(1, Math.max(0, pct));
      audio.currentTime = pct * duration;
    });
  });

  /* ---------- Contact form (sent by email via FormSubmit) ----------
     A plain form POST: FormSubmit emails the message to Taryn, then
     redirects back here with ?sent=1. Any notice FormSubmit needs to show
     (such as the one-time activation step) appears on its own page. */
  var form = document.getElementById('vo-form');
  if (form) {
    var statusEl = form.querySelector('.vo-form-status');
    var submitBtn = form.querySelector('button[type="submit"]');
    var nextInput = form.querySelector('input[name="_next"]');

    function setStatus(kind, text){
      statusEl.className = 'vo-form-status' + (kind ? ' ' + kind : '');
      statusEl.textContent = text;
    }

    if (nextInput) nextInput.value = location.origin + location.pathname + '?sent=1';

    form.addEventListener('submit', function(e){
      var valid = true;
      form.querySelectorAll('[required]').forEach(function(field){
        var ok = field.checkValidity() && field.value.trim() !== '';
        field.closest('.vo-field').classList.toggle('invalid', !ok);
        if (!ok && valid) { field.focus(); valid = false; }
      });
      if (!valid) {
        e.preventDefault();
        setStatus('err', 'Please add your name, a valid email, and a message.');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    });

    form.querySelectorAll('[required]').forEach(function(field){
      field.addEventListener('input', function(){ field.closest('.vo-field').classList.remove('invalid'); });
    });

    // Back from FormSubmit after a successful send.
    if (/[?&]sent=1\b/.test(location.search)) {
      setStatus('ok', 'Thanks! Your message is on its way. Taryn will reply by the next business day.');
      trackDemoEvent('contact-form/sent', 'Contact form sent');
      if (history.replaceState) history.replaceState(null, '', location.pathname);
      var contact = document.getElementById('contact');
      if (contact) setTimeout(function(){ contact.scrollIntoView(); }, 0);
    }
  }

  // Re-enable the button if the visitor comes back with the browser's Back button.
  window.addEventListener('pageshow', function(){
    var btn = document.querySelector('#vo-form button[type="submit"]');
    if (btn) { btn.disabled = false; btn.textContent = 'Send message'; }
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll('.footer-copy').forEach(function(copyEl){
    copyEl.textContent = copyEl.textContent.replace(/\d{4}/, String(new Date().getFullYear()));
  });

  /* ---------- Lightbox ---------- */
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = '<button class="lightbox-close" aria-label="Close image"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6"/></svg></button><img class="lightbox-img" src="" alt=""><p class="lightbox-credit"></p>';
  document.body.appendChild(lightbox);
  var lightboxImg = lightbox.querySelector('.lightbox-img');
  var lightboxCredit = lightbox.querySelector('.lightbox-credit');

  function openLightbox(img){
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    var credit = img.dataset.credit;
    lightboxCredit.textContent = credit || '';
    lightboxCredit.style.display = credit ? 'block' : 'none';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function(e){
    var img = e.target.closest('img.photo');
    if (img) openLightbox(img);
  });
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e){
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeLightbox();
  });
})();
