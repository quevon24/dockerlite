import { vi } from "vitest";

export const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
