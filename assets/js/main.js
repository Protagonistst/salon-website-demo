(function () {
  'use strict';

  /* ---- settings: edit these for a real salon ---- */
  var CONFIG = {
    whatsapp: '995000000000',
    openHour: 10,
    closeHour: 20,
    timeZone: 'Asia/Tbilisi',
    leadMinutes: 60,
    bookingDays: 14
  };
  var I18N = window.SALON_I18N;
  var THEMES = {"a": "#faf6f0", "b": "#f7f2ea", "c": "#f6f7f3"};

  var d = document;
  function $(s, c)  { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function pad(n)   { return (n < 10 ? '0' : '') + n; }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k)    { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var lang = 'ka';
  function t(key, vars) {
    var s = I18N[lang][key];
    if (s == null) { s = I18N.ka[key]; }
    if (s == null) { return key; }
    if (vars) { Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); }
    return s;
  }

  var header  = $('#siteHeader');
  var burger  = $('#burger');
  var menu    = $('#mobileMenu');
  var callbar = $('#callbar');
  var flow    = $('#booking-flow');

  $('#year').textContent = new Date().getFullYear();

  /* ---- header + call bar ---- */
  var ticking = false, bookingInView = false;
  function paintBars() {
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle('scrolled', y > 20);
    callbar.classList.toggle('show', y > 400);
    callbar.classList.toggle('tuck', bookingInView || menu.classList.contains('open'));
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(paintBars); ticking = true; }
  }, { passive: true });

  /* ---- mobile menu ---- */
  function setMenu(open) {
    menu.classList.toggle('open', open);
    burger.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', t(open ? 'menu.close' : 'menu.open'));
    paintBars();
  }
  burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) { setMenu(false); } });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); burger.focus(); }
  });
  window.addEventListener('resize', function () { if (window.innerWidth >= 900) { setMenu(false); } });

  /* ---- colour themes ---- */
  function setTheme(id, remember) {
    if (!THEMES[id]) { id = 'a'; }
    d.documentElement.setAttribute('data-theme', id);
    $$('[data-theme-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === id ? 'true' : 'false');
    });
    $('meta[name="theme-color"]').setAttribute('content', THEMES[id]);
    if (remember) { save('tpl-theme', id); }
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-set]');
    if (b) { setTheme(b.getAttribute('data-theme-set'), true); }
  });

  /* ---- opening hours ---- */
  function cityNow() {
    try {
      var o = {};
      new Intl.DateTimeFormat('en-GB', {
        timeZone: CONFIG.timeZone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute };
    } catch (err) {
      var n = new Date();
      return { y: n.getFullYear(), mo: n.getMonth() + 1, d: n.getDate(), h: n.getHours(), mi: n.getMinutes() };
    }
  }
  function paintStatus() {
    var n = cityNow();
    var open = n.h >= CONFIG.openHour && n.h < CONFIG.closeHour;
    var text = open ? t('status.open', { h: CONFIG.closeHour }) : t('status.closed', { h: CONFIG.openHour });
    $$('[data-status]').forEach(function (el) {
      el.hidden = false;
      el.classList.toggle('is-open', open);
      el.classList.toggle('is-closed', !open);
      $('[data-status-text]', el).textContent = text;
    });
  }
  window.setInterval(paintStatus, 60000);

  /* ---- tabs ---- */
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list);
    function select(tab, focus) {
      tabs.forEach(function (x) {
        var on = x === tab;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tabIndex = on ? 0 : -1;
        d.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) { tab.focus(); }
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var j;
        if (e.key === 'ArrowRight') { j = (i + 1) % tabs.length; }
        else if (e.key === 'ArrowLeft') { j = (i - 1 + tabs.length) % tabs.length; }
        else if (e.key === 'Home') { j = 0; }
        else if (e.key === 'End') { j = tabs.length - 1; }
        else { return; }
        e.preventDefault();
        select(tabs[j], true);
      });
    });
  });

  /* ---- gallery: filter + lightbox ---- */
  var tiles = $$('.tile');
  $$('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      $$('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      tiles.forEach(function (tile) { tile.hidden = f !== 'all' && tile.getAttribute('data-cat') !== f; });
    });
  });

  var lb = $('#lightbox'), stage = $('#lbStage'), lbList = [], lbIndex = 0, lbReturn = null, startX = null;
  function lbShow(i) {
    lbIndex = (i + lbList.length) % lbList.length;
    var tile = lbList[lbIndex];
    var thumb = $('img', tile), big = new Image();
    big.alt = thumb.alt;
    big.src = thumb.getAttribute('data-full') || thumb.src;
    stage.innerHTML = '';
    stage.appendChild(big);
    $('#lbCap').textContent = $('figcaption', tile).textContent;
    $('#lbCount').textContent = (lbIndex + 1) + ' / ' + lbList.length;
  }
  function lbOpen(tile) {
    lbList = tiles.filter(function (x) { return !x.hidden; });
    lbReturn = $('.tile-btn', tile);
    lbShow(lbList.indexOf(tile));
    if (typeof lb.showModal === 'function') { lb.showModal(); } else { lb.setAttribute('open', ''); }
  }
  function lbClose() {
    if (typeof lb.close === 'function') { lb.close(); } else { lb.removeAttribute('open'); }
  }
  tiles.forEach(function (tile) {
    $('.tile-btn', tile).addEventListener('click', function () { lbOpen(tile); });
  });
  lb.addEventListener('close', function () { if (lbReturn) { lbReturn.focus(); } });
  $('#lbPrev').addEventListener('click', function () { lbShow(lbIndex - 1); });
  $('#lbNext').addEventListener('click', function () { lbShow(lbIndex + 1); });
  $('#lbClose').addEventListener('click', lbClose);
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { lbShow(lbIndex + 1); }
    if (e.key === 'ArrowLeft')  { lbShow(lbIndex - 1); }
  });
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.classList.contains('lb-inner')) { lbClose(); }
  });
  stage.addEventListener('pointerdown', function (e) { startX = e.clientX; });
  stage.addEventListener('pointerup', function (e) {
    if (startX === null) { return; }
    var dx = e.clientX - startX; startX = null;
    if (Math.abs(dx) > 40) { lbShow(lbIndex + (dx < 0 ? 1 : -1)); }
  });

  /* ---- booking ---- */
  var booking = null;
  if (flow) {
    booking = (function () {
      var panels  = $$('.bk-panel', flow);
      var dots    = $$('.bk-step', flow);
      var hint    = $('#bkHint');
      var send    = $('#bkSend');
      var resend  = $('#bkResend');
      var daysBox = $('#bkDays');
      var state   = { service: '', stylist: 'any', date: '', time: '', name: '', phone: '' };
      var hintKey = '';
      var today   = cityNow();
      var todayISO = today.y + '-' + pad(today.mo) + '-' + pad(today.d);
      var byPointer = false;
      var slotInputs = $$('input[name="bk-time"]', flow);

      function slotOpenToday(v) {
        var p = v.split(':');
        return (+p[0]) * 60 + (+p[1]) >= today.h * 60 + today.mi + CONFIG.leadMinutes;
      }
      var todayHasSlots = slotInputs.some(function (i) { return slotOpenToday(i.value); });

      function syncChoice(sel) {
        $$(sel, flow).forEach(function (label) {
          var input = $('input', label);
          label.classList.toggle('is-selected', !!(input && input.checked));
        });
      }
      function buildDays() {
        var wd = t('cal.weekdays').split(','), mo = t('cal.months').split(','), html = '';
        for (var i = 0; i < CONFIG.bookingDays; i++) {
          var dt  = new Date(Date.UTC(today.y, today.mo - 1, today.d + i));
          var iso = dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
          var top = i === 0 ? t('cal.today') : (i === 1 ? t('cal.tomorrow') : wd[dt.getUTCDay()]);
          var off = i === 0 && !todayHasSlots;
          html += '<label class="bk-day' + (off ? ' is-off' : '') + '">' +
                  '<input type="radio" name="bk-date" value="' + iso + '"' +
                  (off ? ' disabled' : '') + (state.date === iso ? ' checked' : '') + '>' +
                  '<small>' + top + '</small><b>' + dt.getUTCDate() + '</b>' +
                  '<small>' + mo[dt.getUTCMonth()] + '</small></label>';
        }
        daysBox.innerHTML = html;
        syncChoice('.bk-day');
      }
      function pretty(v) {
        var p = v ? v.split('-') : [];
        return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : '';
      }
      function syncSlots() {
        var isToday = state.date === todayISO;
        slotInputs.forEach(function (input) {
          var off = isToday && !slotOpenToday(input.value);
          input.disabled = off;
          input.parentNode.classList.toggle('is-off', off);
          if (off && input.checked) { input.checked = false; state.time = ''; }
        });
        syncChoice('.bk-slot');
      }
      function warn(key) { hintKey = key; hint.textContent = t(key); hint.hidden = false; }
      function show(n, quiet) {
        panels.forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-step') === String(n));
        });
        dots.forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === n - 1);
          dot.classList.toggle('is-done', i < n - 1);
          if (i === n - 1) { dot.setAttribute('aria-current', 'step'); } else { dot.removeAttribute('aria-current'); }
        });
        hint.hidden = true; hintKey = '';
        if (quiet) { return; }
        var title = $('.bk-panel.is-active .bk-title', flow);
        if (title) { title.focus({ preventScroll: true }); }
        if (flow.getBoundingClientRect().top < 70) {
          window.scrollTo({ top: window.pageYOffset + flow.getBoundingClientRect().top - 90, behavior: 'smooth' });
        }
      }
      function stylistName() {
        return state.stylist === 'any' ? t('bk.any') : t('team.' + state.stylist + '.name');
      }
      function message() {
        var when = [pretty(state.date), state.time].filter(Boolean).join(', ');
        var what = [state.service ? t('svc.' + state.service + '.name') : '', when].filter(Boolean).join(', ');
        function end(x) { return /[.!?]$/.test(x) ? x : x + '.'; }
        var parts = [end(t('msg.hello') + ' ' + what)];
        if (state.stylist !== 'any') { parts.push(end(t('msg.stylist') + ' ' + stylistName())); }
        if (state.name)  { parts.push(end(t('msg.name') + ' ' + state.name)); }
        if (state.phone) { parts.push(end(t('msg.phone') + ' ' + state.phone)); }
        return parts.join(' ');
      }
      function refresh() {
        $('#bkSumService').textContent = state.service ? t('svc.' + state.service + '.name') : '';
        $('#bkSumStylist').textContent = stylistName();
        $('#bkSumDate').textContent    = pretty(state.date);
        $('#bkSumTime').textContent    = state.time;
        var msg = message();
        $('#bkPreview').textContent = msg;
        send.href = resend.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg);
      }
      function pick(name, value, sel) {
        $$('input[name="' + name + '"]', flow).forEach(function (i) { i.checked = i.value === value; });
        syncChoice(sel);
      }

      flow.addEventListener('pointerdown', function () { byPointer = true; });
      flow.addEventListener('keydown', function () { byPointer = false; });

      function onEdit(e) {
        var el = e.target;
        if (el.name === 'bk-service') {
          state.service = el.value; syncChoice('.bk-option');
          if (byPointer && e.type === 'change') { window.setTimeout(function () { show(2); }, 220); }
        }
        if (el.name === 'bk-stylist') { state.stylist = el.value; syncChoice('.bk-chip'); }
        if (el.name === 'bk-date') { state.date = el.value; syncChoice('.bk-day'); syncSlots(); }
        if (el.name === 'bk-time') { state.time = el.value; syncChoice('.bk-slot'); }
        if (el.id === 'bkName')  { state.name  = el.value.trim(); }
        if (el.id === 'bkPhone') { state.phone = el.value.trim(); }
        hint.hidden = true; hintKey = '';
        refresh();
      }
      flow.addEventListener('change', onEdit);
      flow.addEventListener('input',  onEdit);

      flow.addEventListener('click', function (e) {
        var next = e.target.closest('[data-next]');
        var prev = e.target.closest('[data-prev]');
        if (next) {
          var to = +next.getAttribute('data-next');
          if (to === 2 && !state.service) { return warn('err.service'); }
          if (to === 3 && (!state.date || !state.time)) { return warn('err.time'); }
          show(to);
        }
        if (prev) { show(+prev.getAttribute('data-prev')); }
      });

      send.addEventListener('click', function (e) {
        if (!state.name) { e.preventDefault(); warn('err.name'); $('#bkName').focus(); return; }
        if (state.phone.replace(/\D/g, '').length < 9) {
          e.preventDefault(); warn('err.phone'); $('#bkPhone').focus(); return;
        }
        window.setTimeout(function () { show(4); }, 400);
      });

      $('#bkReset').addEventListener('click', function () {
        $$('input', flow).forEach(function (i) {
          if (i.type === 'radio') { i.checked = i.name === 'bk-stylist' && i.value === 'any'; } else { i.value = ''; }
        });
        state = { service: '', stylist: 'any', date: '', time: '', name: '', phone: '' };
        ['.bk-option', '.bk-chip', '.bk-day', '.bk-slot'].forEach(syncChoice);
        syncSlots(); refresh(); show(1);
      });

      $$('[data-book]').forEach(function (link) {
        link.addEventListener('click', function () {
          state.service = link.getAttribute('data-book');
          pick('bk-service', state.service, '.bk-option');
          refresh(); show(2, true);
        });
      });
      $$('[data-stylist]').forEach(function (link) {
        link.addEventListener('click', function () {
          state.stylist = link.getAttribute('data-stylist');
          pick('bk-stylist', state.stylist, '.bk-chip');
          refresh();
        });
      });

      buildDays(); syncChoice('.bk-chip'); refresh();
      return {
        relabel: function () {
          buildDays(); refresh();
          if (hintKey) { hint.textContent = t(hintKey); }
        }
      };
    })();
  }

  /* ---- language ---- */
  function setLang(l, remember) {
    if (!I18N[l]) { l = 'ka'; }
    lang = l;
    d.documentElement.lang = l;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var kv = pair.split('=');
        el.setAttribute(kv[0], t(kv[1]));
      });
    });
    d.title = t('meta.title');
    $('meta[name="description"]').setAttribute('content', t('meta.desc'));
    $$('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === l ? 'true' : 'false');
    });
    burger.setAttribute('aria-label', t(menu.classList.contains('open') ? 'menu.close' : 'menu.open'));
    paintStatus();
    if (booking) { booking.relabel(); }
    if (remember) { save('tpl-lang', l); }
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) { setLang(b.getAttribute('data-lang'), true); }
  });

  var params = new URLSearchParams(window.location.search);
  setTheme(params.get('theme') || load('tpl-theme') || 'a', false);
  setLang(params.get('lang') || load('tpl-lang') || 'ka', false);

  /* ---- reviews: a keyboard stop only while it actually scrolls sideways ---- */
  var reviews = $('.reviews');
  function reviewsFocus() {
    if (reviews.scrollWidth > reviews.clientWidth + 1) { reviews.tabIndex = 0; } else { reviews.removeAttribute('tabindex'); }
  }
  reviewsFocus();
  window.addEventListener('resize', reviewsFocus);

  /* ---- observers ---- */
  var items  = $$('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO  = 'IntersectionObserver' in window;

  if (reduce || !hasIO) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    items.forEach(function (el) { io.observe(el); });
  }

  if (hasIO) {
    var links = $$('#navLinks a');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { spy.observe(s); });

    if (flow) {
      new IntersectionObserver(function (entries) {
        bookingInView = entries[0].isIntersecting;
        paintBars();
      }, { rootMargin: '0px 0px -20% 0px' }).observe(flow);
    }
  }

  paintBars();
})();
