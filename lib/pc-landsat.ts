// Landsat Collection 2 Level-2 through Microsoft Planetary Computer's
// mosaic API, as a date-driven medium-resolution timeline source, quarterly
// from 1982 to today: the only keyless route to Landsat 4 to 9 scenes before
// HLS (2013) and Sentinel-2 (2015), and the one on-the-fly complement to
// Google Earth Timelapse's fixed yearly mosaics (lib/google-timelapse.ts).
//
// The Planetary Computer data API takes a STAC search (collection, date
// range, filter, sort) with a POST to /mosaic/register, answers a search id,
// then tiles that search on demand from the Landsat COGs in Azure: for each
// pixel the first scene in sort order that has data there, so with the
// scenes sorted least cloudy first a tile is a "least cloudy scene" mosaic,
// not a per-pixel composite. Seams between neighbouring scenes and some
// residual cloud remain; Timelapse's median mosaics are cleaner, these are
// any quarter of forty years, not one frame a year.
//
// No token is needed: the register and tiles endpoints answer with an open
// CORS header, the API signs the COG reads itself. It is a public service
// Microsoft runs for the Planetary Computer catalog, not an SLA.
//
// The registration is a POST, which a MapLibre `tiles` template cannot do,
// hence the protocol:
//
//   pcmosaic://landsat-c2-l2/{z}/{x}/{y}?from=1990-04-01&to=1990-06-30
//
// The handler registers the search once per window (cached), then fetches
// the tile. Tiles only exist from zoom 8: the API answers 204 (empty)
// below, so the source's minzoom keeps MapLibre from asking.

const PC_DATA_API = "https://planetarycomputer.microsoft.com/api/data/v1"
const COLLECTION = "landsat-c2-l2"

export const PC_LANDSAT_TILE_SIZE = 256
export const PC_LANDSAT_MINZOOM = 8
/** Landsat is 30 m: zoom 13 is about 19 m a pixel at the equator, MapLibre
 *  magnifies past it. */
export const PC_LANDSAT_MAXZOOM = 13
export const PC_LANDSAT_ATTRIBUTION = "Landsat Collection 2 (USGS/NASA), Microsoft Planetary Computer"

/** Landsat 4 TM's first scene in the collection. */
const COVERAGE_START = Date.UTC(1982, 7, 22)
/** Scenes with more cloud than this are left out of the search; the rest are
 *  sorted least cloudy first. Tight enough to skip overcast passes, loose
 *  enough that a cloudy region still has candidates. */
const MAX_CLOUD_COVER = 40

/** Render parameters: Planetary Computer's own Landsat true-colour recipe
 *  (its Explorer's "Natural color" render config), nodata 0 so scene edges
 *  fall through to the next scene. */
const RENDER_PARAMS = new URLSearchParams([
  ["assets", "red"], ["assets", "green"], ["assets", "blue"],
  ["nodata", "0"],
  ["color_formula", "gamma RGB 2.7, saturation 1.5, sigmoidal RGB 15 0.55"],
  ["collection", COLLECTION],
]).toString()

/** The calendar quarter holding a date, as ISO day bounds. */
export function quarterOf(dateMs: number): { from: string; to: string; label: string } {
  const d = new Date(dateMs)
  const y = d.getUTCFullYear(), q = Math.floor(d.getUTCMonth() / 3)
  const from = new Date(Date.UTC(y, q * 3, 1)), to = new Date(Date.UTC(y, q * 3 + 3, 0))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), label: `${y} Q${q + 1}` }
}

/** A tile template for the quarter around `dateMs`. */
export function pcLandsatTileUrl(dateMs: number): string {
  const { from, to } = quarterOf(dateMs)
  return `pcmosaic://${COLLECTION}/{z}/{x}/{y}?from=${from}&to=${to}`
}

/** One tick per quarter from Landsat 4's first pass to the current quarter,
 *  on the 5th of the quarter's first month (each synthetic series uses its
 *  own day offset so cadences never share a tick date, see lib/planet.ts). */
export function pcLandsatTicks(): { dateMs: number; label: string }[] {
  const ticks: { dateMs: number; label: string }[] = []
  const now = Date.now()
  for (let y = 1982; ; y++) {
    for (let q = 0; q < 4; q++) {
      const dateMs = Date.UTC(y, q * 3, 5)
      if (dateMs > now) return ticks
      if (Date.UTC(y, q * 3 + 3, 0) < COVERAGE_START) continue
      ticks.push({ dateMs, label: `${y} Q${q + 1}` })
    }
  }
}

// ── Search registration ───────────────────────────────────────────────────
const searches = new Map<string, Promise<string>>()

function registerSearch(collection: string, from: string, to: string): Promise<string> {
  const key = `${collection}|${from}|${to}`
  const hit = searches.get(key)
  if (hit) return hit
  const p = (async () => {
    const res = await fetch(`${PC_DATA_API}/mosaic/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collections: [collection],
        datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
        "filter-lang": "cql2-json",
        filter: { op: "<=", args: [{ property: "eo:cloud_cover" }, MAX_CLOUD_COVER] },
        sortby: [{ field: "eo:cloud_cover", direction: "asc" }],
      }),
    })
    if (!res.ok) throw new Error(`Planetary Computer mosaic register ${res.status}`)
    const json = (await res.json()) as { searchid?: string; id?: string }
    const id = json.searchid ?? json.id
    if (!id) throw new Error("Planetary Computer mosaic register: no search id")
    return id
  })()
  p.catch(() => searches.delete(key))
  searches.set(key, p)
  return p
}

const URL_RE = /^pcmosaic:\/\/([a-z0-9-]+)\/(\d+)\/(\d+)\/(\d+)\?from=(\d{4}-\d{2}-\d{2})&to=(\d{4}-\d{2}-\d{2})$/

/** One tile as encoded PNG bytes; null when the API has nothing there (204:
 *  no scene in the window, or a zoom below 8). */
export async function fetchPcMosaicTile(url: string, signal?: AbortSignal): Promise<Uint8Array | null> {
  const m = url.match(URL_RE)
  if (!m) throw new Error(`Invalid pcmosaic protocol URL: ${url}`)
  const [, collection, z, x, y, from, to] = m
  const searchId = await registerSearch(collection, from, to)
  const res = await fetch(`${PC_DATA_API}/mosaic/${searchId}/tiles/WebMercatorQuad/${z}/${x}/${y}@1x.png?${RENDER_PARAMS}`, { signal })
  if (res.status === 204 || res.status === 404) return null
  if (!res.ok) throw new Error(`Planetary Computer tile ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function pcMosaicProtocol(params: { url: string }, abortController: AbortController): Promise<{ data: Uint8Array }> {
  const data = await fetchPcMosaicTile(params.url, abortController.signal)
  if (!data) throw new Error(`No Landsat scene for ${params.url.slice(0, 80)}`)
  return { data }
}

/** For the Export Multi mosaic, which cannot fetch() a custom scheme. */
export async function fetchPcLandsatTileBlob(z: number, x: number, y: number, dateMs: number, signal?: AbortSignal): Promise<Blob> {
  const data = await fetchPcMosaicTile(pcLandsatTileUrl(dateMs).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)), signal)
  if (!data) throw new Error(`No Landsat scene at z${z} for ${quarterOf(dateMs).label}`)
  return new Blob([data as BlobPart], { type: "image/png" })
}
