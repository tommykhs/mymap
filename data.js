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

  function log(m){ try{ if(window.console) console.log('[mymap] ' + m); }catch(e){} }

  // fetch with a labelled error (HTTP status AND network/CORS rejection), then apply fn(response)
  function step(label, url, fn){
    log(label + ' -> ' + url);
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error(label + ': HTTP ' + r.status + ' (' + url + ')');
      return fn(r);
    }, function(err){
      // network-level failure (TypeError: Failed to fetch) lands here
      throw new Error(label + ': ' + ((err && err.message) || err) + ' (' + url + ')');
    });
  }

  function gistFiles(){
    if(!_files){
      _files = step('gist-api', 'https://api.github.com/gists/' + cfg.gistId, function(r){ return r.json(); })
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
    return new Response(stream).text().then(function(t){ return JSON.parse(t); });
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

  // entry: one library row. -> Promise<FeatureCollection>
  function loadMap(entry){
    var name = (entry && entry.file) || '';
    if(!DEPLOYED) return step('geojson-local', 'data/maps/' + name, function(r){ return r.json(); });
    return gistFiles().then(function(files){
      var gz = entry && entry.file_gz;
      if(gz && files[gz] && typeof DecompressionStream !== 'undefined'){
        return step('geojson-gz', files[gz].raw_url, function(r){ return r.text(); }).then(gunzipB64);
      }
      var f = files[name];
      if(!f) throw new Error('geojson "' + name + '" missing from gist ' + cfg.gistId);
      return step('geojson-plain', f.raw_url, function(r){ return r.json(); });
    });
  }

  window.MyMapData = { loadLibrary: loadLibrary, loadMap: loadMap, deployed: DEPLOYED };
})();
