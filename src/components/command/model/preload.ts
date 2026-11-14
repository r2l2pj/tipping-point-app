// Frame preloader. The images are requested in CORS mode, the same mode
// MapLibre uses for an image source. A plain <img> request sends no Origin
// header; a host that answers "allow-origin" only to requests with an Origin
// then leaves a cached response that the map is not allowed to read.
export interface PreloadImage {
  crossOrigin: string | null;
  decoding: string;
  src: string;
}

export function preloadFrames(
  urls: Iterable<string>,
  make: () => PreloadImage = () => new Image()
): () => void {
  const images = [...new Set(urls)].map((url) => {
    const img = make();
    // Must be set before `src`: the request starts when `src` is set.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
    return img;
  });
  return () => {
    for (const img of images) img.src = "";
  };
}
