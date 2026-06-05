// Error Logging System für AFL App
// Speichert Fehler lokal und optional in Firebase

const ErrLog = (() => {
  const STORAGE_KEY = 'afl-errors-v1';
  const MAX_ERRORS = 50;
  
  let errors = [];
  
  function load() {
    try {
      errors = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      errors = [];
    }
  }
  
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(-MAX_ERRORS)));
    } catch (e) {
      console.error('Error log storage failed');
    }
  }
  
  function log(error, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || '',
      context: context,
      severity: context.severity || 'warn',
      user: window.U?.name || 'anonymous'
    };
    
    errors.push(entry);
    save();
    
    // Firebase speichern
    if (window.fbReady && window.db) {
      fbSaveError(entry).catch(e => console.warn('Firebase error log failed', e));
    }
    
    // Console output
    const prefix = `[${entry.severity.toUpperCase()}]`;
    const msg = `${prefix} ${entry.type}: ${entry.message}`;
    
    if (entry.severity === 'error') console.error(msg, context);
    else if (entry.severity === 'warn') console.warn(msg, context);
    else console.log(msg, context);
    
    return entry;
  }
  
  function getAll() {
    return [...errors];
  }
  
  function getSince(minsSago = 60) {
    const cutoff = Date.now() - (minsSago * 60 * 1000);
    return errors.filter(e => new Date(e.timestamp).getTime() > cutoff);
  }
  
  function clear() {
    errors = [];
    localStorage.removeItem(STORAGE_KEY);
  }
  
  function getStats() {
    const stats = {
      total: errors.length,
      byType: {},
      bySeverity: { error: 0, warn: 0, info: 0 },
      recent1h: getSince(60).length,
      recent24h: getSince(1440).length
    };
    
    errors.forEach(e => {
      stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
      stats.bySeverity[e.severity] = (stats.bySeverity[e.severity] || 0) + 1;
    });
    
    return stats;
  }
  
  // Global error handlers
  function setupGlobalHandlers() {
    window.addEventListener('error', e => {
      log(e.error || new Error(e.message), {
        severity: 'error',
        source: 'window.onerror',
        filename: e.filename,
        lineno: e.lineno
      });
    });
    
    window.addEventListener('unhandledrejection', e => {
      log(e.reason || new Error('Unhandled Promise Rejection'), {
        severity: 'error',
        source: 'unhandledrejection'
      });
    });
  }
  
  load();
  return {
    log,
    getAll,
    getSince,
    clear,
    getStats,
    setupGlobalHandlers,
    get length() { return errors.length; }
  };
})();

// Firebase Error Storage
async function fbSaveError(entry) {
  if (!window.fbReady || !window.db) return;
  try {
    await db.collection('machines').doc(MACHINE).collection('errors').add({
      ...entry,
      createdAt: new Date()
    });
  } catch (e) {
    console.warn('Firebase error save failed', e);
  }
}

// Expose to window for debugging
window.ErrLog = ErrLog;
