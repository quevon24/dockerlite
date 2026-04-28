import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NetworkDetailPanel from "../components/networks/NetworkDetailPanel";
import type { NetworkInfo } from "../lib/types";

const baseNetwork: NetworkInfo = {
  id: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  name: "my-bridge",
  driver: "bridge",
  scope: "local",
  internal: false,
  enableIpv6: false,
  attachable: true,
  ingress: false,
  containers: [
    { containerId: "c0ffee000000", name: "web", ipv4Address: "172.18.0.2/16", ipv6Address: "" },
  ],
  labels: { "com.example.env": "prod" },
  options: { "com.docker.network.bridge.name": "docker1" },
};

describe("NetworkDetailPanel", () => {
  it("renders nothing when network is null", () => {
    render(<NetworkDetailPanel network={null} onClose={vi.fn()} />);
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("renders network name and driver badge", () => {
    render(<NetworkDetailPanel network={baseNetwork} onClose={vi.fn()} />);
    expect(screen.getAllByText("my-bridge").length).toBeGreaterThan(0);
    expect(screen.getAllByText("bridge").length).toBeGreaterThan(0);
  });

  it("renders boolean detail rows", () => {
    render(<NetworkDetailPanel network={baseNetwork} onClose={vi.fn()} />);
    expect(screen.getByText("Attachable")).toBeInTheDocument();
    expect(screen.getByText("IPv6")).toBeInTheDocument();
    expect(screen.getByText("Internal")).toBeInTheDocument();
    expect(screen.getByText("Ingress")).toBeInTheDocument();
  });

  it("renders connected containers", () => {
    render(<NetworkDetailPanel network={baseNetwork} onClose={vi.fn()} />);
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("172.18.0.2/16")).toBeInTheDocument();
  });

  it("renders labels", () => {
    render(<NetworkDetailPanel network={baseNetwork} onClose={vi.fn()} />);
    expect(screen.getByText("com.example.env")).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
  });

  it("renders options", () => {
    render(<NetworkDetailPanel network={baseNetwork} onClose={vi.fn()} />);
    expect(screen.getByText("com.docker.network.bridge.name")).toBeInTheDocument();
    expect(screen.getByText("docker1")).toBeInTheDocument();
  });

  it("shows 'internal' badge when network is internal", () => {
    render(<NetworkDetailPanel network={{ ...baseNetwork, internal: true }} onClose={vi.fn()} />);
    expect(screen.getByText("internal")).toBeInTheDocument();
  });

  it("shows 'No containers connected' when empty", () => {
    render(<NetworkDetailPanel network={{ ...baseNetwork, containers: [] }} onClose={vi.fn()} />);
    expect(screen.getByText("No containers connected")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NetworkDetailPanel network={baseNetwork} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NetworkDetailPanel network={baseNetwork} onClose={onClose} />);
    const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
