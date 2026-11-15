import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

(globalThis as unknown as { jest: typeof vi }).jest = vi;