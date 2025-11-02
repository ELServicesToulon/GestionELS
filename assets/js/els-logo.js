(function () {
  var win = typeof window !== 'undefined' ? window : null;
  var doc = typeof document !== 'undefined' ? document : null;
  if (!win || !doc) return;

  var LOGO_URL = 'https://drive.google.com/uc?export=view&id=1vbZ9kTYPso7KC4WGINEvVbJwHLCV7BfD';
  var HOME_URL = '/';
  var fallbackName = 'EL Services';
  var altSuffix = ' - Logo';
  var knownTargets = [
    'site-header .brand',
    '#site-header .brand',
    '#site-header .hero__logo',
    'header .brand',
    'header .logo',
    'header .site-title',
    'header .left',
    'header'
  ];

  function clean(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  function readDataset(dataset, key, fallback) {
    if (!dataset) return fallback;
    var value = dataset[key];
    return value ? clean(value) : fallback;
  }

  function resolveBrand() {
    var body = doc.body || doc.documentElement;
    var dataset = body && body.dataset ? body.dataset : {};
    var canonical = doc.querySelector('link[rel="canonical"]');
    var baseEl = doc.querySelector('base');

    var brand = Object.assign(
      { name: fallbackName, homeUrl: '', logoUrl: '', logoDataUrl: '' },
      win.ELS_BRAND || {}
    );

    brand.name = readDataset(dataset, 'brandName', readDataset(dataset, 'companyName', brand.name));
    brand.homeUrl = readDataset(dataset, 'brandHome', readDataset(dataset, 'homeUrl', brand.homeUrl || HOME_URL));
    brand.logoUrl = readDataset(dataset, 'brandLogo', readDataset(dataset, 'logoUrl', brand.logoUrl || LOGO_URL));

    if (!brand.homeUrl && canonical && canonical.href) {
      brand.homeUrl = clean(canonical.href);
    }
    if (!brand.homeUrl && baseEl && baseEl.href) {
      brand.homeUrl = clean(baseEl.href);
    }
    if (!brand.homeUrl) {
      brand.homeUrl = HOME_URL || '#';
    }
    if (!brand.name) {
      brand.name = fallbackName;
    }
    brand.logoDataUrl = clean(brand.logoDataUrl);
    if (!brand.logoUrl && brand.logoDataUrl) {
      brand.logoUrl = brand.logoDataUrl;
    }

    win.ELS_BRAND = brand;
    return brand;
  }

  function makeLogo(anchorClass) {
    var brand = resolveBrand();
    var link = doc.createElement('a');
    link.className = anchorClass || 'els-logo';
    var homeHref = brand.homeUrl || HOME_URL || '#';
    var name = brand.name || fallbackName;
    link.href = homeHref;
    link.setAttribute('aria-label', name + altSuffix);

    var img = doc.createElement('img');
    img.src = brand.logoUrl || LOGO_URL;
    img.alt = name + altSuffix;
    img.loading = 'eager';
    img.decoding = 'async';
    img.className = 'app-logo';
    link.appendChild(img);

    return link;
  }

  function injectLogo(slot, brand) {
    if (!slot || (slot.dataset && slot.dataset.brandingInjected === 'true')) {
      return;
    }

    if (slot.classList && !slot.classList.contains('app-logo-container')) {
      slot.classList.add('app-logo-container');
    }

    var slotData = slot.dataset || {};
    var href = clean(slotData.logoHref) || brand.homeUrl || HOME_URL || '#';
    var anchorClass = clean(slotData.logoClass) || 'els-logo';
    var alt = clean(slotData.logoAlt || '');
    var effectiveAlt = alt || (brand.name + altSuffix);

    var fallbackNode = slot.querySelector('[data-logo-fallback]') || slot.querySelector('.app-logo--fallback');
    var anchor = doc.createElement('a');
    anchor.className = anchorClass;
    anchor.href = href;
    anchor.setAttribute('aria-label', effectiveAlt);

    slot.innerHTML = '';

    if (brand.logoUrl) {
      var img = doc.createElement('img');
      img.className = 'app-logo';
      img.src = brand.logoUrl;
      img.alt = effectiveAlt;
      img.loading = 'lazy';
      anchor.appendChild(img);
    } else if (fallbackNode) {
      anchor.appendChild(fallbackNode);
    } else {
      var span = doc.createElement('span');
      span.className = 'app-logo--fallback';
      span.textContent = brand.name;
      anchor.appendChild(span);
    }

    slot.appendChild(anchor);
    slot.dataset.brandingInjected = 'true';
  }

  function injectAll(scope) {
    var brand = resolveBrand();
    var root = scope || doc;
    if (!root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[data-logo-slot]');
    for (var i = 0; i < nodes.length; i += 1) {
      injectLogo(nodes[i], brand);
    }
  }

  function onReady(callback) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  onReady(function () {
    injectAll(doc);
    win.injectHeader();
    win.injectModals();
    win.injectViaDataAttribute();
  });

  if (win.MutationObserver && doc.body) {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (!mutation.addedNodes) continue;
        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          var node = mutation.addedNodes[j];
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches('[data-logo-slot]')) {
            injectLogo(node, resolveBrand());
          }
          if (node.querySelectorAll) {
            var descendants = node.querySelectorAll('[data-logo-slot]');
            for (var k = 0; k < descendants.length; k += 1) {
              injectLogo(descendants[k], resolveBrand());
            }
          }
        }
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  win.refreshBrandingLogo = function () {
    injectAll(doc);
  };

  win.makeLogo = makeLogo;
  win.injectViaDataAttribute = function injectViaDataAttribute() {
    var nodes = doc.querySelectorAll('[data-els-logo]');
    var results = [];
    if (!nodes.length) return results;
    var brand = resolveBrand();
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || node.querySelector('.els-logo')) continue;
      var slot = node.matches('[data-logo-slot]') ? node : node.querySelector('[data-logo-slot]');
      if (slot) {
        injectLogo(slot, brand);
        results.push(slot.querySelector('.els-logo'));
        continue;
      }
      var title = node.querySelector('h1, h2, h3, h4, h5');
      var logo = makeLogo();
      if (title) {
        node.insertBefore(logo, title);
      } else {
        node.prepend(logo);
      }
      results.push(node.querySelector('.els-logo'));
    }
    return results;
  };
  win.injectModals = function injectModals() {
    var injected = [];
    var modals = doc.querySelectorAll('.modale-contenu');
    for (var i = 0; i < modals.length; i += 1) {
      var modal = modals[i];
      if (!modal) continue;
      var header = modal.querySelector('.modal__header') || modal;
      if (!header || header.querySelector('.els-logo')) continue;
      var slot = header.matches && header.matches('[data-logo-slot]') ? header : header.querySelector('[data-logo-slot]');
      if (slot) {
        injectLogo(slot, resolveBrand());
        injected.push(slot.querySelector('.els-logo'));
        continue;
      }
      header.prepend(makeLogo());
      injected.push(header.querySelector('.els-logo'));
    }

    var headers = doc.querySelectorAll('.modal .modal-header');
    for (var j = 0; j < headers.length; j += 1) {
      var h = headers[j];
      if (!h || h.querySelector('.els-logo')) continue;
      var title = h.querySelector('h5, h4, h3, .modal-title');
      var logo = makeLogo('els-logo');
      if (title) {
        h.insertBefore(logo, title);
      } else {
        h.prepend(logo);
      }
      injected.push(h.querySelector('.els-logo'));
    }

    return injected;
  };
  win.injectHeader = function injectHeader() {
    var container = null;
    for (var i = 0; i < knownTargets.length; i += 1) {
      var sel = knownTargets[i];
      var el = null;
      try {
        el = doc.querySelector(sel);
      } catch (_err) {
        el = null;
      }
      if (el && !el.querySelector('.els-logo')) {
        el.prepend(makeLogo());
        return el.querySelector('.els-logo');
      }
    }

    if (!doc.querySelector('.els-logo')) {
      var body = doc.body;
      if (body) {
        var wrapper = doc.createElement('div');
        wrapper.style.padding = '8px 16px';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.appendChild(makeLogo());
        body.insertBefore(wrapper, body.firstChild || null);
        return wrapper.querySelector('.els-logo');
      }
    }

    container = doc.querySelector('header');
    if (!container) return null;

    var brand = resolveBrand();
    var slot = container.matches && container.matches('[data-logo-slot]') ? container : container.querySelector('[data-logo-slot]');
    if (slot) {
      injectLogo(slot, brand);
      return slot.querySelector('.els-logo');
    }
    var existing = container.querySelector('.els-logo');
    if (existing) return existing;
    var logoNode = makeLogo();
    container.insertBefore(logoNode, container.firstChild || null);
    return logoNode;
  };

  if (win.addEventListener) {
    win.addEventListener('branding:refresh-logo', function () {
      injectAll(doc);
    });
  }
  if (doc && doc.addEventListener) {
    doc.addEventListener('shown.bs.modal', function () {
      win.injectModals();
    }, false);
  }
})();
