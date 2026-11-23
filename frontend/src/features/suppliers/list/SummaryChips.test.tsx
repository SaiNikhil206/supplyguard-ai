import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { loginAs } from "@/test/loginAs";
import type { Supplier } from "@/api/types";
import { countByLevel } from "./risk";

describe("countByLevel", () => {
  it("counts suppliers per risk level", () => {
    const mk = (risk_level: Supplier["risk_level"]) =>
      ({ risk_level }) as Supplier;
    expect(countByLevel([mk("HIGH"), mk("HIGH"), mk("LOW")])).toEqual({
      LOW: 1,
      MEDIUM: 0,
      HIGH: 2,
      CRITICAL: 0,
    });
    expect(countByLevel(undefined)).toEqual({
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    });
  });
});

describe("SummaryChips on the supplier list", () => {
  beforeEach(async () => {
    await loginAs("admin");
  });

  it("clicking a chip filters by that level and toggles off again", async () => {
    const r = renderWithProviders({ path: "/suppliers" });
    const chip = await screen.findByRole("button", { name: /^High\s*\d+$/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    await waitFor(() =>
      expect(r.router.state.location.search).toContain("risk_level=HIGH"),
    );
    expect(
      screen.getByRole("button", { name: /^High\s*\d+$/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /^High\s*\d+$/ }));
    await waitFor(() =>
      expect(r.router.state.location.search).not.toContain("risk_level"),
    );
  });
});
