import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "../components/ui/ConfirmDialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const props = {
    open: true,
    title: "Remove container?",
    description: "This action cannot be undone.",
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props} />);
  return props;
}

describe("ConfirmDialog", () => {
  it("renders title and description", () => {
    renderDialog();
    expect(screen.getByText("Remove container?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("uses default button labels", () => {
    renderDialog();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("uses custom button labels", () => {
    renderDialog({ confirmLabel: "Delete", cancelLabel: "Go back" });
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Go back")).toBeInTheDocument();
  });

  it("calls onConfirm and closes when confirm is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();
    await user.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes without calling onConfirm when cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();
    await user.click(screen.getByText("Cancel"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows warning icon when destructive", () => {
    renderDialog({ destructive: true });
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Remove container?")).not.toBeInTheDocument();
  });
});
