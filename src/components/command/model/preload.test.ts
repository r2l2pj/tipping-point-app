import { describe, expect, test } from "bun:test";
import { preloadFrames, type PreloadImage } from "./preload";

// Records the request mode at the moment `src` is set, as a browser does.
function fakeImages() {
  const requests: { url: string; mode: string | null }[] = [];
  const make = (): PreloadImage => {
    let src = "";
    return {
      crossOrigin: null,
      decoding: "auto",
      get src() {
        return src;
      },
      set src(v: string) {
        src = v;
        if (v) requests.push({ url: v, mode: this.crossOrigin });
      },
    };
  };
  return { requests, make };
}

describe("preloadFrames", () => {
  test("requests every frame in CORS mode, like the map does", () => {
    const { requests, make } = fakeImages();
    preloadFrames(["https://bucket/a.png", "https://bucket/b.png"], make);
    expect(requests).toEqual([
      { url: "https://bucket/a.png", mode: "anonymous" },
      { url: "https://bucket/b.png", mode: "anonymous" },
    ]);
  });

  test("requests a repeated URL once", () => {
    const { requests, make } = fakeImages();
    preloadFrames(["/a.png", "/a.png"], make);
    expect(requests).toHaveLength(1);
  });

  test("the returned function cancels the downloads", () => {
    const made: PreloadImage[] = [];
    const cancel = preloadFrames(["/a.png"], () => {
      const img = { crossOrigin: null, decoding: "auto", src: "" };
      made.push(img);
      return img;
    });
    cancel();
    expect(made[0].src).toBe("");
  });
});
