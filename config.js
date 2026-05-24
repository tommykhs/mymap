// MyMap data source. The gist id is filled in at deploy time.
// data.js auto-detects the source: on *.github.io it uses the GitHub gist API;
// elsewhere (localhost / file://) it reads the local ./data/ files, so a plain
// `python3 -m http.server` just works for development.
window.MYMAP_CONFIG = {
  gistUser: "tommykhs",
  gistId:   "37cfca45d433cb1445e136ffe28edcf9"   // "MyMap data" gist
};
