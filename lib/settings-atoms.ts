import { atomWithStorage } from "jotai/utils"

export const mapboxKeyAtom = atomWithStorage("mapboxKey", "")
export const googleKeyAtom = atomWithStorage("googleKey", "")
export const maptilerKeyAtom = atomWithStorage("maptilerKey", "")
export const titilerEndpointAtom = atomWithStorage("titilerEndpoint", "https://titiler.xyz")
export const maxResolutionAtom = atomWithStorage("maxResolution", 4096)
export const themeAtom = atomWithStorage<"light" | "dark">("theme", "light")
