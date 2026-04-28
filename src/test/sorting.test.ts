import { describe, it, expect } from "vitest";
import type { ImageInfo, VolumeInfo } from "../lib/types";

// --- helpers mirrored from page components ---

function imageName(repoTags: string[], shortId: string): string {
  const tag = repoTags.find((t) => t !== "<none>:<none>");
  return tag ?? shortId;
}

type ImageSortKey = "name" | "id" | "created" | "size";
type SortDir = "asc" | "desc";

function sortImages(images: ImageInfo[], key: ImageSortKey, dir: SortDir): ImageInfo[] {
  return [...images].sort((a, b) => {
    let cmp = 0;
    if (key === "name") {
      cmp = imageName(a.repoTags, a.shortId)
        .toLowerCase()
        .localeCompare(imageName(b.repoTags, b.shortId).toLowerCase());
    } else if (key === "id") {
      cmp = a.shortId.localeCompare(b.shortId);
    } else if (key === "created") {
      cmp = a.created - b.created;
    } else if (key === "size") {
      cmp = a.size - b.size;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

type VolumeSortKey = "name" | "driver" | "size" | "containers";

function sortVolumes(volumes: VolumeInfo[], key: VolumeSortKey, dir: SortDir): VolumeInfo[] {
  return [...volumes].sort((a, b) => {
    let cmp = 0;
    if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "driver") cmp = a.driver.localeCompare(b.driver);
    else if (key === "size") cmp = a.size - b.size;
    else if (key === "containers") cmp = a.refCount - b.refCount;
    return dir === "asc" ? cmp : -cmp;
  });
}

// --- fixtures ---

function makeImage(overrides: Partial<ImageInfo>): ImageInfo {
  return {
    id: "sha256:aabbccdd",
    shortId: "aabbccdd0000",
    repoTags: [],
    repoDigests: [],
    created: 1000,
    size: 1000,
    sharedSize: 0,
    dangling: false,
    ...overrides,
  };
}

function makeVolume(overrides: Partial<VolumeInfo>): VolumeInfo {
  return {
    name: "vol",
    driver: "local",
    mountpoint: "/var/lib/docker/volumes/vol/_data",
    createdAt: null,
    size: -1,
    refCount: 0,
    labels: {},
    ...overrides,
  };
}

// --- image sorting ---

describe("sortImages", () => {
  const alpha = makeImage({ shortId: "aaa", repoTags: ["alpine:latest"], created: 100, size: 500 });
  const beta = makeImage({ shortId: "bbb", repoTags: ["busybox:1.0"], created: 200, size: 300 });
  const gamma = makeImage({ shortId: "ccc", repoTags: ["<none>:<none>"], created: 300, size: 800 });

  it("sorts by name asc", () => {
    const result = sortImages([gamma, beta, alpha], "name", "asc");
    expect(result.map((i) => i.shortId)).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("sorts by name desc", () => {
    const result = sortImages([alpha, beta, gamma], "name", "desc");
    expect(result.map((i) => i.shortId)).toEqual(["ccc", "bbb", "aaa"]);
  });

  it("sorts by id asc", () => {
    const result = sortImages([gamma, alpha, beta], "id", "asc");
    expect(result.map((i) => i.shortId)).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("sorts by created asc (oldest first)", () => {
    const result = sortImages([gamma, beta, alpha], "created", "asc");
    expect(result.map((i) => i.created)).toEqual([100, 200, 300]);
  });

  it("sorts by created desc (newest first)", () => {
    const result = sortImages([alpha, beta, gamma], "created", "desc");
    expect(result.map((i) => i.created)).toEqual([300, 200, 100]);
  });

  it("sorts by size asc", () => {
    const result = sortImages([alpha, gamma, beta], "size", "asc");
    expect(result.map((i) => i.size)).toEqual([300, 500, 800]);
  });

  it("does not mutate the original array", () => {
    const images = [beta, alpha];
    sortImages(images, "name", "asc");
    expect(images[0].shortId).toBe("bbb");
  });
});

// --- volume sorting ---

describe("sortVolumes", () => {
  const a = makeVolume({ name: "aardvark", driver: "local", size: 100, refCount: 2 });
  const b = makeVolume({ name: "bravo", driver: "nfs", size: 50, refCount: 0 });
  const c = makeVolume({ name: "charlie", driver: "local", size: 200, refCount: 5 });

  it("sorts by name asc", () => {
    const result = sortVolumes([c, a, b], "name", "asc");
    expect(result.map((v) => v.name)).toEqual(["aardvark", "bravo", "charlie"]);
  });

  it("sorts by name desc", () => {
    const result = sortVolumes([a, b, c], "name", "desc");
    expect(result.map((v) => v.name)).toEqual(["charlie", "bravo", "aardvark"]);
  });

  it("sorts by driver asc", () => {
    const result = sortVolumes([b, a, c], "driver", "asc");
    expect(result.map((v) => v.driver)).toEqual(["local", "local", "nfs"]);
  });

  it("sorts by size asc", () => {
    const result = sortVolumes([c, a, b], "size", "asc");
    expect(result.map((v) => v.size)).toEqual([50, 100, 200]);
  });

  it("sorts by containers desc", () => {
    const result = sortVolumes([a, b, c], "containers", "desc");
    expect(result.map((v) => v.refCount)).toEqual([5, 2, 0]);
  });

  it("does not mutate the original array", () => {
    const volumes = [c, a];
    sortVolumes(volumes, "name", "asc");
    expect(volumes[0].name).toBe("charlie");
  });
});
