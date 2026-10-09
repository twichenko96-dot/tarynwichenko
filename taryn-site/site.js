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

  document.querySelectorAll('.reveal').forEach(function(el){
    revealObserver.observe(el);
  });

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

  /* ---------- Contact form (sent by email via Formspree) ----------
     Sends in the background so visitors stay on the page. Formspree also
     keeps a copy of every message in its dashboard. Without JavaScript the
     form still posts normally and Formspree shows its own thank-you page. */
  var form = document.getElementById('vo-form');
  if (form) {
    var statusEl = form.querySelector('.vo-form-status');
    var submitBtn = form.querySelector('button[type="submit"]');
    var fallbackMsg = 'Sorry, that didn\u2019t send. Please email tarynwichenko@gmail.com directly.';

    function setStatus(kind, text){
      statusEl.className = 'vo-form-status' + (kind ? ' ' + kind : '');
      statusEl.textContent = text;
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var valid = true;
      form.querySelectorAll('[required]').forEach(function(field){
        var ok = field.checkValidity() && field.value.trim() !== '';
        field.closest('.vo-field').classList.toggle('invalid', !ok);
        if (!ok && valid) { field.focus(); valid = false; }
      });
      if (!valid) {
        setStatus('err', 'Please add your name, a valid email, and a message.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending\u2026';
      setStatus('', '');

      fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function(res){
          return res.json().catch(function(){ return {}; }).then(function(body){
            if (!res.ok) {
              var msg = body.errors && body.errors.map(function(err){ return err.message; }).join(' ');
              var err = new Error(msg || fallbackMsg);
              err.fromFormspree = true;
              throw err;
            }
          });
        })
        .then(function(){
          form.reset();
          setStatus('ok', 'Thanks! Your message is on its way. Taryn will reply by the next business day.');
          trackDemoEvent('contact-form/sent', 'Contact form sent');
        })
        .catch(function(err){
          setStatus('err', err && err.fromFormspree ? err.message : fallbackMsg);
        })
        .then(function(){
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send message';
        });
    });

    form.querySelectorAll('[required]').forEach(function(field){
      field.addEventListener('input', function(){ field.closest('.vo-field').classList.remove('invalid'); });
    });
  }

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
