// Shared data loader for MyMap (gallery + viewer).
// Data lives in THIS repo and is served by GitHub Pages from the SAME origin —
// Pages gzip-compresses it on the wire and the browser decompresses it for free,
// so there's no gist, no GitHub API, no manual gzip/base64/parts. Just fetch JSON.
// (library.json + data/maps/<id>/routes.geojson, both same-origin relative URLs.)
(function(){
  function log(m){
    try{ if(window.console) console.log('[mymap] ' + m); }catch(e){}
    try{ if(window.__mmlog) window.__mmlog(m); }catch(e){}   // mirror to the on-screen log
  }
  // fetch + body-read with a labelled error and a small abort-on-stall retry
  var TIMEOUT = 15000, MAX_TRIES = 3;
  function step(label, url, fn, tries){
    tries = (tries == null) ? MAX_TRIES : tries;
    log(label + ' -> ' + url + (tries < MAX_TRIES ? ' [retry]' : ''));
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ log(label + ' stalled — aborting'); ctrl.abort(); }, TIMEOUT) : null;
    return fetch(url, ctrl ? {signal: ctrl.signal} : {}).then(function(r){
      if(!r.ok){ if(timer) clearTimeout(timer); throw new Error(label + ': HTTP ' + r.status); }
      log(label + ' ok (' + (r.headers.get('content-length') || '?') + ' B over the wire) — reading…');
      return Promise.resolve(fn(r)).then(function(v){ if(timer) clearTimeout(timer); return v; });
    }).catch(function(err){
      if(timer) clearTimeout(timer);
      var msg = (err && err.message) || String(err);
      if(tries > 1 && !/: HTTP \d/.test(msg)){
        log(label + ' failed (' + msg + ') — retrying');
        return new Promise(function(res){ setTimeout(res, 600); }).then(function(){ return step(label, url, fn, tries - 1); });
      }
      throw new Error(label + ': ' + msg + ' (' + url + ')');
    });
  }
  function loadLibrary(){ return step('library', 'data/library.json', function(r){ return r.json(); }); }
  function loadMap(entry){ return step('geojson', 'data/maps/' + ((entry && entry.file) || ''), function(r){ return r.json(); }); }
  window.MyMapData = { loadLibrary: loadLibrary, loadMap: loadMap };
})();
