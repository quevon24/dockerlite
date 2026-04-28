import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "../test/mocks/tauri";
import ImageDetailPanel from "../components/images/ImageDetailPanel";
import type { ImageInfo, ImageLayer } from "../lib/types";

const baseImage: ImageInfo = {
  id: "sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  shortId: "abc123def456",
  repoTags: ["nginx:latest", "nginx:1.25"],
  repoDigests: ["nginx@sha256:deadbeef"],
  created: 1700000000,
  size: 56_000_000,
  sharedSize: 10_000_000,
  dangling: false,
};

const mockLayers: ImageLayer[] = [
  {
    id: "sha256:layer1",
    created: 1699000000,
    createdBy: '/bin/sh -c #(nop) CMD ["nginx"]',
    tags: [],
    size: 0,
    comment: "",
  },
  {
    id: "sha256:layer2",
    created: 1698000000,
    createdBy: "/bin/sh -c apt-get install -y nginx",
    tags: [],
    size: 40_000_000,
    comment: "",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  invoke.mockResolvedValue(mockLayers);
});

describe("ImageDetailPanel", () => {
  it("renders nothing when image is null", () => {
    render(<ImageDetailPanel image={null} onClose={vi.fn()} />);
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("renders image name and short ID in header", async () => {
    render(<ImageDetailPanel image={baseImage} onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "nginx:latest" })).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
  });

  it("renders all tags", async () => {
    render(<ImageDetailPanel image={baseImage} onClose={vi.fn()} />);
    // tags appear in both the header and the Tags section
    expect(screen.getAllByText("nginx:latest").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("nginx:1.25")).toBeInTheDocument();
  });

  it("renders digest", () => {
    render(<ImageDetailPanel image={baseImage} onClose={vi.fn()} />);
    expect(screen.getByText("nginx@sha256:deadbeef")).toBeInTheDocument();
  });

  it("fetches and renders layers", async () => {
    render(<ImageDetailPanel image={baseImage} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Layers (2)")).toBeInTheDocument());
    expect(screen.getByText('CMD ["nginx"]')).toBeInTheDocument();
    expect(screen.getByText("RUN apt-get install -y nginx")).toBeInTheDocument();
  });

  it("calls getImageLayers with the image id", async () => {
    render(<ImageDetailPanel image={baseImage} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("get_image_layers", { id: baseImage.id }),
    );
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImageDetailPanel image={baseImage} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImageDetailPanel image={baseImage} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImageDetailPanel image={baseImage} onClose={onClose} />);
    const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error message when layer fetch fails", async () => {
    invoke.mockRejectedValueOnce(new Error("Docker not reachable"));
    render(<ImageDetailPanel image={baseImage} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Error: Docker not reachable")).toBeInTheDocument(),
    );
  });
});
