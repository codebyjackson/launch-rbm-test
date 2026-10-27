// MapLibre's CSP build (components/map/CountryMap.tsx) has the same API as
// the package's main file, which is where the types are.
declare module "maplibre-gl/dist/maplibre-gl-csp.js" {
  export * from "maplibre-gl";
}
