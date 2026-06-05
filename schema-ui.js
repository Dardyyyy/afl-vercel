// Schema-Lesbarkeitsverbesserungen

const SchemaUI = (() => {
  let overlayActive = false;
  let textOverlayMode = 'auto'; // 'off', 'overlay', 'auto'
  
  function init() {
    setupTextOverlay();
    addSchemaControls();
  }
  
  function setupTextOverlay() {
    const riWrap = document.getElementById('ri-wrap');
    if (!riWrap) return;
    
    // SVG Canvas für lesbare Text-Overlay
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'schema-text-overlay');
    svg.setAttribute('width', '2200');
    svg.setAttribute('height', '1400');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '15';
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'textShadow');
    
    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('in', 'SourceGraphic');
    feGaussianBlur.setAttribute('stdDeviation', '2');
    
    const feOffset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
    feOffset.setAttribute('dx', '1');
    feOffset.setAttribute('dy', '1');
    feOffset.setAttribute('result', 'offsetblur');
    
    const feFlood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
    feFlood.setAttribute('floodColor', '#000000');
    feFlood.setAttribute('floodOpacity', '0.7');
    feFlood.setAttribute('result', 'offsetcolor');
    
    const feComposite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
    feComposite.setAttribute('in', 'offsetcolor');
    feComposite.setAttribute('in2', 'offsetblur');
    feComposite.setAttribute('operator', 'in');
    feComposite.setAttribute('result', 'offsetblur');
    
    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode1.setAttribute('in', 'offsetblur');
    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');
    
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feGaussianBlur);
    filter.appendChild(feOffset);
    filter.appendChild(feFlood);
    filter.appendChild(feComposite);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    svg.appendChild(defs);
    
    riWrap.appendChild(svg);
    renderTextOverlay();
  }
  
  function renderTextOverlay() {
    const svg = document.getElementById('schema-text-overlay');
    if (!svg) return;
    
    // Leere alle Text-Elemente (behalte nur defs)
    const texts = svg.querySelectorAll('text');
    texts.forEach(t => t.remove());
    
    if (textOverlayMode === 'off') return;
    
    // Stelle sicher, dass we Valve-Daten haben
    if (!window.VSP || !window.VSP.vi) return;
    
    // Häufig verwendete Ventile aus der App extrahieren
    const importantValves = [
      'V1.1', 'V1.2', 'V1.3', 'V1.4',
      'V2.1', 'V2.2', 'V3.1', 'V3.2',
      'SV1', 'SV2', 'SV3', 'SV4', 'SV5',
      'PT1', 'PT2', 'PT3', 'PT4', 'PT5'
    ];
    
    // Index der Valve-Dots von der aktiven Step-Anzeige
    const dots = document.querySelectorAll('.vdot');
    dots.forEach(dot => {
      const x = parseFloat(dot.style.left);
      const y = parseFloat(dot.style.top);
      const title = dot.title || dot.getAttribute('data-valve');
      
      if (title && x && y) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x + 20);
        text.setAttribute('y', y - 10);
        text.setAttribute('font-family', 'JetBrains Mono, monospace');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', '#00d4ff');
        text.setAttribute('filter', 'url(#textShadow)');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('text-anchor', 'start');
        text.textContent = title;
        
        svg.appendChild(text);
      }
    });
  }
  
  function addSchemaControls() {
    const fTools = document.querySelector('.f-tools');
    if (!fTools) return;
    
    const btn = document.createElement('button');
    btn.className = 'f-nav';
    btn.textContent = '📝 Text';
    btn.title = 'Ventil-Labels anzeigen';
    btn.onclick = toggleTextOverlay;
    fTools.insertBefore(btn, fTools.firstChild);
  }
  
  function toggleTextOverlay() {
    textOverlayMode = textOverlayMode === 'off' ? 'auto' : 'off';
    renderTextOverlay();
    toast(`Ventil-Labels ${textOverlayMode === 'off' ? 'verborgen' : 'sichtbar'}`);
  }
  
  function enhanceVdotInfo(valve) {
    // Wenn ein Ventil angeklickt wird, zeige mehr Infos
    const info = window.VSP?.vi?.[valve];
    if (!info) return '';
    
    return `
      <strong>${valve}</strong><br/>
      ${info.n || '—'}<br/>
      <small style="color:var(--t3)">${info.d || ''}</small>
    `;
  }
  
  return {
    init,
    renderTextOverlay,
    toggleTextOverlay,
    enhanceVdotInfo
  };
})();

// Nach dem Laden initialisieren
window.addEventListener('load', () => {
  setTimeout(() => SchemaUI.init(), 500);
});

// Bei Schritt-Wechsel Text-Overlay neuzeichnen
const origFlowDots = window.rFlowDots;
window.rFlowDots = function() {
  if (origFlowDots) origFlowDots.call(this);
  setTimeout(() => SchemaUI.renderTextOverlay(), 100);
};

window.SchemaUI = SchemaUI;
