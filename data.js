// Shared data loader for MyMap, used by both index.html (gallery) and map.html (viewer).
//   localhost / file://  -> local ./data/ files (development)
//   *.github.io          -> GitHub gist API (deployed): the map list comes fresh from
//                           the API `content` (library.json is <1MB), and each geojson
//                           is fetched from its SHA-pinned raw_url (always current,
//                           and permanently cached so repeat loads are fast).
// This sidesteps the 5-min staleness of plain gist raw URLs (query-string busting
// does NOT work on gist raw — verified); the API caches only ~60s.
(function(){
  var cfg = window.MYMAP_CONFIG || {};
  var DEPLOYED = /\.github\.io$/i.test(location.hostname);
  var _files = null;  // memoized gist file map (one API call per page load)

  function gistFiles(){
    if(!_files){
      _files = fetch('https://api.github.com/gists/' + cfg.gistId)
        .then(function(r){ if(!r.ok) throw new Error('gist API HTTP ' + r.status); return r.json(); })
        .then(function(j){ return j.files || {}; });
    }
    return _files;
  }

  // -> Promise<Array> of library entries
  function loadLibrary(){
    if(!DEPLOYED) return fetch('data/library.json').then(function(r){ return r.json(); });
    return gistFiles().then(function(files){
      var f = files['library.json'];
      if(!f) throw new Error('library.json missing from gist ' + cfg.gistId);
      // <1MB so .content is present + fresh; fall back to raw_url if it ever truncates
      if(f.truncated) return fetch(f.raw_url).then(function(r){ return r.json(); });
      return JSON.parse(f.content);
    });
  }

  // base64(gzip(json)) text -> Promise<parsed object>, via the browser's
  // DecompressionStream. This is what makes big maps load on mobile: gist serves
  // geojson UNCOMPRESSED (verified), so we ship a ~3.4MB .gz.b64 instead of 11MB.
  function gunzipB64(b64){
    var bin = atob(b64.trim());
    var bytes = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text().then(function(t){ return JSON.parse(t); });
  }

  // entry: one library row; entry.file is the bare filename. -> Promise<FeatureCollection>
  function loadMap(entry){
    var name = (entry && entry.file) || '';
    if(!DEPLOYED) return fetch('data/maps/' + name).then(function(r){ return r.json(); });
    return gistFiles().then(function(files){
      // Prefer the compressed copy (~3.4MB) when the browser can inflate it;
      // fall back to the plain geojson otherwise.
      var gz = entry && entry.file_gz;
      if(gz && files[gz] && typeof DecompressionStream !== 'undefined'){
        return fetch(files[gz].raw_url).then(function(r){ return r.text(); }).then(gunzipB64);
      }
      var f = files[name];
      if(!f) throw new Error('geojson "' + name + '" missing from gist ' + cfg.gistId);
      return fetch(f.raw_url).then(function(r){ return r.json(); });  // SHA-pinned, full, fresh
    });
  }

  window.MyMapData = { loadLibrary: loadLibrary, loadMap: loadMap, deployed: DEPLOYED };
})();
