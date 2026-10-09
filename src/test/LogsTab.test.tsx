import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogsTab from "../components/container-detail/LogsTab";

vi.mock("../lib/hooks/useContainerLogs", () => ({
  useContainerLogs: () => ({
    lines: [
      { id: 0, stream: "stdout", time: null, text: "starting server" },
      { id: 1, stream: "stderr", time: null, text: "Error: port in use" },
      { id: 2, stream: "stdout", time: null, text: "retrying after error" },
    ],
    error: null,
    ended: false,
    clear: vi.fn(),
  }),
}));
vi.mock("../lib/SettingsContext", () => ({
  useSettings: () => ({ settings: { logBufferSize: 10_000 } }),
}));
vi.mock("../components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("LogsTab search", () => {
  it("opens with Ctrl+F, highlights matches and steps through them", async () => {
    const user = userEvent.setup();
    const { container } = render(<LogsTab containerId="abc" />);

    await user.keyboard("{Control>}f{/Control}");
    const input = await screen.findByLabelText("Search logs");
    await user.type(input, "error");

    expect(container.querySelectorAll("mark")).toHaveLength(2);
    // Starts at the newest match.
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(container.querySelector("[data-current-match]")).toHaveTextContent("error");

    await user.keyboard("{Enter}");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(container.querySelector("[data-current-match]")).toHaveTextContent("Error");

    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("supports case-sensitive matching and closes with Escape", async () => {
    const user = userEvent.setup();
    const { container } = render(<LogsTab containerId="abc" />);

    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.type(await screen.findByLabelText("Search logs"), "Error");
    await user.click(screen.getByTitle("Match case"));
    expect(screen.getByText("1 / 1")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search logs"), "zzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Search logs")).not.toBeInTheDocument();
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });

  it("ignores Ctrl+F while the tab is inactive", async () => {
    const user = userEvent.setup();
    render(<LogsTab containerId="abc" active={false} />);
    await user.keyboard("{Control>}f{/Control}");
    expect(screen.queryByLabelText("Search logs")).not.toBeInTheDocument();
  });
});
