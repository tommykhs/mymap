// Shared data loader for MyMap, used by both index.html (gallery) and map.html (viewer).
//   localhost / file://  -> local ./data/ files (development)
//   *.github.io          -> GitHub gist API: map list + each geojson via SHA-pinned raw_url.
// Deployed maps use a gzip+base64 copy (gist serves uncompressed; the 11MB plain file
// fails to download on mobile) inflated in-browser via DecompressionStream.
//
// Every fetch is labelled so failures surface as "<stage>: <reason> (<url>)" both on
// screen and in the console — makes mobile "failed to fetch" diagnosable.
(function(){
  var cfg = window.MYMAP_CONFIG || {};
  var DEPLOYED = /\.github\.io$/i.test(location.hostname);
  var _files = null;

  function log(m){
    try{ if(window.console) console.log('[mymap] ' + m); }catch(e){}
    try{ if(window.__mmlog) window.__mmlog(m); }catch(e){}   // mirror to on-screen log
  }

  // fetch + body-read with a labelled error, an abort-on-stall timeout, and retry.
  // The retry wraps BOTH the fetch AND fn(r) (the body read) — mobile failures
  // here are the body stream stalling after headers arrive, so we abort a stuck
  // transfer after TIMEOUT ms and try again on a fresh connection.
  var TIMEOUT = 15000, MAX_TRIES = 4;
  function step(label, url, fn, tries){
    tries = (tries == null) ? MAX_TRIES : tries;
    log(label + ' -> ' + url + (tries < MAX_TRIES ? ' [retry ' + (MAX_TRIES - tries + 1) + ']' : ''));
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ log(label + ' stalled — aborting'); ctrl.abort(); }, TIMEOUT) : null;
    return fetch(url, ctrl ? {signal: ctrl.signal} : {}).then(function(r){
      if(!r.ok){ if(timer) clearTimeout(timer); throw new Error(label + ': HTTP ' + r.status + ' (' + url + ')'); }
      log(label + ' headers ok (' + (r.headers.get('content-length') || '?') + ' B) — reading…');
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

  function gistFiles(){
    if(!_files){
      // cache-bust the API so we always get the current map list (with file_gz),
      // never a stale one that would fall back to the big uncompressed file.
      _files = step('gist-api', 'https://api.github.com/gists/' + cfg.gistId + '?_=' + Date.now(), function(r){ return r.json(); })
        .then(function(j){ return j.files || {}; });
    }
    return _files;
  }

  // base64(gzip(json)) text -> Promise<parsed object> via DecompressionStream
  function gunzipB64(b64){
    log('inflating gzip+base64 (' + b64.length + ' chars)');
    var bin = atob(b64.trim());
    var bytes = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text().then(function(t){ log('inflated -> ' + t.length + ' chars'); return JSON.parse(t); });
  }

  // -> Promise<Array> of library entries
  function loadLibrary(){
    if(!DEPLOYED) return step('library-local', 'data/library.json', function(r){ return r.json(); });
    return gistFiles().then(function(files){
      var f = files['library.json'];
      if(!f) throw new Error('library.json missing from gist ' + cfg.gistId);
      if(f.truncated || !f.content) return step('library-raw', f.raw_url, function(r){ return r.json(); });
      return JSON.parse(f.content);
    });
  }

  // fetch the gz.b64 parts one at a time (small bodies stream reliably on mobile)
  // and concatenate them back into the full base64 string.
  function loadParts(files, parts){
    var acc = '', i = 0, N = parts.length;
    function next(){
      if(i >= N) return Promise.resolve(acc);
      var nm = parts[i], f = files[nm];
      if(!f) throw new Error('part missing from gist: ' + nm);
      if(window.setLoading) window.setLoading('Downloading map… ' + (i + 1) + ' / ' + N);
      return step('part ' + (i + 1) + '/' + N, f.raw_url, function(r){ return r.text(); })
        .then(function(t){ acc += t; i++; return next(); });
    }
    return next();
  }

  // entry: one library row. -> Promise<FeatureCollection>
  function loadMap(entry){
    var name = (entry && entry.file) || '';
    if(!DEPLOYED) return step('geojson-local', 'data/maps/' + name, function(r){ return r.json(); });
    return gistFiles().then(function(files){
      var parts = entry && entry.file_gz_parts;
      if(parts && parts.length && typeof DecompressionStream !== 'undefined'){
        return loadParts(files, parts).then(gunzipB64);
      }
      var f = files[name];   // fallback: plain (uncompressed) geojson
      if(!f) throw new Error('geojson "' + name + '" missing from gist ' + cfg.gistId);
      return step('geojson-plain', f.raw_url, function(r){ return r.json(); });
    });
  }

  window.MyMapData = { loadLibrary: loadLibrary, loadMap: loadMap, deployed: DEPLOYED };
})();
