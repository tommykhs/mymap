// MyMap runtime config.
//
// googleMapsApiKey is a CLIENT key for a PUBLIC, static site — it is visible in
// the page source by design. Committing it is safe ONLY because it is locked
// down in Google Cloud Console with an HTTP-referrer restriction
// (https://tommykhs.github.io/mymap/* + http://localhost:8801/*) and restricted
// to the Maps JavaScript API + Places API (New). Leave it "" to disable the
// Google base map + place search and fall back to free OSM / Esri maps.
window.MYMAP_CONFIG = {
  googleMapsApiKey: "AIzaSyDBYbqFsFJF6OBylMihGdhmbS1rpw3zVSU",
  googleMapType: "roadmap",       // roadmap | satellite | hybrid | terrain
  // Target repo for the admin "Save pins to repo" button (writes data/maps/<id>/pins.json
  // via the GitHub API using a token YOU paste at runtime — the token is NOT stored here).
  repo: { owner: "tommykhs", name: "mymap", branch: "master" }
};
