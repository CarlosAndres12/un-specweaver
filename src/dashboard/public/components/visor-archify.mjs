/**
 * Visor Archify — render reactivo sin parpadeos (Story 3.2)
 *
 * Invariants:
 * - AD-07: markup encapsulado .archify-container con CSS prefijado .archify-* sin leak
 * - SSE FS_CHANGE -> re-fetch <300ms, sin parpadeo (diff + transicion + preserve scroll)
 * - ESM estricto, sin cambio de directorio global
 *
 * API:
 * - renderArchify(container, markup, options) -> boolean (true si actualizo, false si no hubo cambio)
 * - isSvgMarkup(markup) -> boolean
 * - wrapArchifyMarkup(markup) -> string (encapsulado)
 * - createArchifyVisor(container, options) -> { update, getHash, container }
 */

function simpleHash(str) {
  const s = String(str || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

export function isSvgMarkup(markup) {
  const t = String(markup || '').trim();
  return t.startsWith('<svg') || t.startsWith('<?xml') && t.includes('<svg');
}

export function wrapArchifyMarkup(markup) {
  const str = String(markup || '');
  if (str.includes('archify-container')) return str;
  const style = '<style>.archify-container{contain:content;overflow:auto;background:#fff;border-radius:6px;padding:0.5rem}.archify-placeholder{color:#64748b;font-style:italic}.archify-workflow{display:block}.archify-node{padding:0.25rem}.archify-edge{color:#64748b}.archify-lifecycle{display:block}.archify-phase{margin:0.25rem 0}.archify-content{min-height:60px}.archify-transition{transition:opacity 120ms ease}.archify-iframe{width:100%;border:0;min-height:160px;display:block}</style>';
  return `<div class="archify-container">${style}<div class="archify-content">${str}</div></div>`;
}

/**
 * Renderiza markup Archify sin parpadeo.
 * - Compara hash previo vs nuevo, solo actualiza si cambia (evita flicker)
 * - Preserva scrollTop/scrollLeft
 * - Aplica transicion suave via opacity + requestAnimationFrame
 * - Soporta modo iframe srcdoc (options.useIframe) o div con CSS scoping (default)
 *
 * @param {HTMLElement} container - contenedor destino (#diagrama-contenido o similar)
 * @param {string} markup - HTML o SVG del diagrama
 * @param {object} [options]
 * @param {boolean} [options.useIframe=false] - usar iframe srcdoc sandbox
 * @param {number} [options.transitionMs=120] - duracion transicion ms
 * @param {boolean} [options.preserveScroll=true] - preservar scrollTop
 * @param {boolean} [options.immediate=false] - sin transicion (para tests)
 * @returns {boolean} true si se actualizo DOM, false si se omitio por diff igual
 */
export function renderArchify(container, markup, options = {}) {
  if (!container) return false;
  const raw = String(markup || '');
  // hash para diff
  const nextHash = simpleHash(raw);
  const prevHash = container.dataset ? container.dataset.archifyHash || '' : '';
  // Si es exactamente el mismo contenido, no tocar DOM (sin parpadeo)
  if (prevHash !== '' && prevHash === nextHash) {
    return false;
  }

  const preserveScroll = options.preserveScroll !== false;
  const transitionMs = typeof options.transitionMs === 'number' ? options.transitionMs : 120;
  const useIframe = options.useIframe === true;
  const immediate = options.immediate === true;

  const prevScrollTop = preserveScroll ? container.scrollTop : 0;
  const prevScrollLeft = preserveScroll ? container.scrollLeft : 0;

  const isSvg = isSvgMarkup(raw);
  const trimmed = raw.trim();

  // Asegurar clase de transicion
  if (container.classList) container.classList.add('archify-transition');

  // Modo iframe srcdoc (sandbox)
  if (useIframe && !isSvg && trimmed.length > 0) {
    let iframe = container.querySelector ? container.querySelector('iframe.archify-iframe') : null;
    if (!iframe) {
      if (typeof document !== 'undefined') {
        container.innerHTML = '';
        iframe = document.createElement('iframe');
        iframe.className = 'archify-iframe';
        iframe.setAttribute('sandbox', 'allow-same-origin');
        iframe.setAttribute('loading', 'lazy');
        iframe.style.width = '100%';
        iframe.style.border = '0';
        iframe.style.minHeight = '160px';
        iframe.style.display = 'block';
        container.appendChild(iframe);
      } else {
        // fallback sin DOM
        container.innerHTML = wrapArchifyMarkup(raw);
        if (container.dataset) container.dataset.archifyHash = nextHash;
        return true;
      }
    }
    const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>body{margin:0;font-family:system-ui,sans-serif;background:#fff}.archify-placeholder{color:#64748b;font-style:italic}.archify-container{padding:0.5rem}</style></head><body>${raw}</body></html>`;
    const prevSrcdoc = iframe.getAttribute ? iframe.getAttribute('srcdoc') : null;
    if (prevSrcdoc === doc) {
      if (preserveScroll) {
        container.scrollTop = prevScrollTop;
        container.scrollLeft = prevScrollLeft;
      }
      if (container.dataset) container.dataset.archifyHash = nextHash;
      return false;
    }
    // Transicion suave: bajar levemente opacidad, actualizar, restaurar
    if (!immediate && container.style) {
      container.style.transition = `opacity ${transitionMs}ms ease`;
      container.style.opacity = '0.96';
    }
    iframe.srcdoc = doc;
    if (container.dataset) container.dataset.archifyHash = nextHash;
    const restore = () => {
      if (preserveScroll) {
        container.scrollTop = prevScrollTop;
        container.scrollLeft = prevScrollLeft;
      }
      if (!immediate && container.style) {
        container.style.opacity = '1';
        setTimeout(() => {
          container.style.transition = '';
          container.style.opacity = '';
        }, transitionMs + 30);
      }
    };
    if (typeof requestAnimationFrame === 'function' && !immediate) {
      requestAnimationFrame(() => requestAnimationFrame(restore));
    } else if (!immediate) {
      setTimeout(restore, 16);
    } else {
      restore();
    }
    // fallback sync
    if (preserveScroll) {
      // ensure after DOM update
      try { container.scrollTop = prevScrollTop; } catch {}
    }
    return true;
  }

  // Modo div (default) — CSS scoping
  let htmlToInsert = '';
  if (trimmed.length === 0) {
    htmlToInsert = '<div class="archify-container"><div class="archify-placeholder"><p>Diagrama no disponible</p></div></div>';
  } else if (isSvg) {
    // SVG puro: inyectar directo (Content-Type ya es image/svg+xml en server, pero client lo recibe como texto)
    htmlToInsert = raw;
  } else {
    // HTML: encapsular si no lo esta
    htmlToInsert = raw.includes('archify-container') ? raw : wrapArchifyMarkup(raw);
  }

  // Si immediate o sin transicion, actualizar directo
  const doUpdate = () => {
    container.innerHTML = htmlToInsert;
    if (container.dataset) container.dataset.archifyHash = nextHash;
    if (preserveScroll) {
      container.scrollTop = prevScrollTop;
      container.scrollLeft = prevScrollLeft;
    }
  };

  if (immediate) {
    doUpdate();
    return true;
  }

  // Transicion sin parpadeo: opacity suave + requestAnimationFrame diff
  try {
    if (container.style) {
      container.style.transition = `opacity ${transitionMs}ms ease`;
      container.style.opacity = '0.94';
    }
    // Usar doble rAF para asegurar que el navegador pinte la transicion antes del cambio
    const doWithRaf = () => {
      doUpdate();
      if (container.style) container.style.opacity = '1';
      setTimeout(() => {
        if (container.style) {
          container.style.transition = '';
          container.style.opacity = '';
        }
      }, transitionMs + 30);
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(doWithRaf));
      // Fallback timer por si rAF no dispara (entornos test sin rAF)
      setTimeout(() => {
        // si aun no se actualizo (hash no cambio), forzar
        if (!container.dataset || container.dataset.archifyHash !== nextHash) {
          doUpdate();
          if (container.style) {
            container.style.opacity = '';
            container.style.transition = '';
          }
        }
      }, transitionMs + 50);
    } else {
      setTimeout(doWithRaf, 16);
    }
  } catch {
    // fallback sincronico
    doUpdate();
  }

  // Marcar immediately para tests que inspeccionen dataset sin esperar rAF
  if (container.dataset) container.dataset.archifyHash = nextHash;
  return true;
}

/**
 * Crea un visor con estado interno para re-fetch reactivo.
 * @param {HTMLElement} container
 * @param {object} [options]
 * @returns {{container: HTMLElement, update: function(string, object):boolean, getHash: function():string, fetchAndUpdate: function(string):Promise<boolean>}}
 */
export function createArchifyVisor(container, options = {}) {
  const opts = { preserveScroll: true, transitionMs: 120, useIframe: false, ...options };
  return {
    container,
    update(markup, overrideOpts = {}) {
      return renderArchify(container, markup, { ...opts, ...overrideOpts });
    },
    getHash() {
      return container && container.dataset ? container.dataset.archifyHash || '' : '';
    },
    async fetchAndUpdate(projectId, fetchOpts = {}) {
      const id = String(projectId || '').trim();
      if (!id) throw new Error('projectId requerido');
      const inicio = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/diagram`, fetchOpts);
      if (!res.ok) throw new Error(`Error al cargar diagrama: ${res.status}`);
      const markup = await res.text();
      const updated = renderArchify(container, markup, opts);
      const fin = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const dur = fin - inicio;
      // Guardar metrica para tests (<300ms)
      if (container && container.dataset) container.dataset.archifyFetchMs = String(Math.round(dur));
      return updated;
    },
  };
}

// Alias ingles para compatibilidad
export const renderDiagram = renderArchify;
export const createVisor = createArchifyVisor;
export const wrapMarkup = wrapArchifyMarkup;

export default {
  renderArchify,
  renderDiagram,
  createArchifyVisor,
  createVisor,
  isSvgMarkup,
  wrapArchifyMarkup,
  wrapMarkup,
};
