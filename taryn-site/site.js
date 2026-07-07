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

  players.forEach(function(player){
    var btn = player.querySelector('.play-btn');
    var wave = player.querySelector('.wave');
    var timeEl = player.querySelector('.player-time');
    var srcUrl = player.dataset.src;
    var duration = parseInt(player.dataset.dur || '0', 10);
    var audio = null;

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
      });
      audio.addEventListener('ended', function(){
        player.classList.remove('playing');
        wave.style.setProperty('--progress', '0%');
        if (timeEl) timeEl.textContent = '0:00 / ' + fmtTime(duration);
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
})();
