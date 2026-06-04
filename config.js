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
  // OpenRouteService key for the route "Extend along basemap" feature (⤴ icon
  // in the route popup). Free tier at https://openrouteservice.org/ — 2000
  // req/day. ORS does NOT support HTTP-referrer restrictions, so this key is
  // effectively public once committed; mirror is kept in Bitwarden under
  // "🏠 MyMap — APIs" (rotate from openrouteservice.org/dev if abused).
  openRouteServiceApiKey: "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjJjMDY3MTllNzk2YjRkZmNhMDk4NjFiNWVmNjMwMTQyIiwiaCI6Im11cm11cjY0In0=",
  openRouteServiceProfile: "cycling-regular",   // cycling-regular | cycling-road | cycling-mountain | foot-walking
  // Target repo for the admin "Save pins to repo" button (writes data/maps/<id>/pins.json
  // via the GitHub API using a token YOU paste at runtime — the token is NOT stored here).
  repo: { owner: "tommykhs", name: "mymap", branch: "master" }
};
