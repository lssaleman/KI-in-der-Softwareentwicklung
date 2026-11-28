import { render } from "@testing-library/react";
import { SportNav } from "./SportNav";
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
it("F2: shows sports", () => { render(<SportNav sports={[{ slug: "fussball", name: "Fußball" }]} />); });
