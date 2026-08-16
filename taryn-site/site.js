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

  /* ---------- World toggle (Voiceover / Acting) ---------- */
  var toggle = document.querySelector('.toggle');
  var toggleBtns = document.querySelectorAll('.toggle button');
  var worlds = document.querySelectorAll('.world');
  var gotoEls = document.querySelectorAll('[data-goto]');

  function setWorld(name, updateHash){
    worlds.forEach(function(w){
      w.classList.toggle('active', w.id === 'world-' + name);
    });
    toggleBtns.forEach(function(b){
      b.setAttribute('aria-selected', b.dataset.world === name ? 'true' : 'false');
    });
    if (toggle) toggle.setAttribute('data-active', name);
    if (updateHash !== false && history.replaceState) {
      history.replaceState(null, '', '#' + name);
    }
    // pause any playing audio when switching worlds
    document.querySelectorAll('.player.playing').forEach(stopPlayer);
    refreshReveal();
  }

  toggleBtns.forEach(function(btn){
    btn.addEventListener('click', function(){ setWorld(btn.dataset.world); });
  });
  gotoEls.forEach(function(el){
    el.addEventListener('click', function(e){
      var target = el.dataset.goto;
      if (target) { e.preventDefault(); setWorld(target); window.scrollTo({top:0, behavior:'smooth'}); }
    });
  });

  var initial = (location.hash || '').replace('#', '');
  setWorld(initial === 'acting' ? 'acting' : 'voiceover', false);

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
        if (timeEl) timeEl.textContent = '0:00 / ' + fmtTime(duration);
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

  /* ---------- Contact form (front-end only) ---------- */
  var form = document.getElementById('vo-form');
  if (form) {
    form.addEventListener('submit', function(e){
      e.preventDefault();
      form.classList.add('submitted');
    });
  }

  /* ---------- Footer year ---------- */
  var copyEl = document.querySelector('.footer-copy');
  if (copyEl) {
    copyEl.textContent = copyEl.textContent.replace(/\d{4}/, String(new Date().getFullYear()));
  }

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
