import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import { computeWhatIf } from "@/mocks/whatif";
import { renderWithProviders } from "@/test/renderWithProviders";
import { loginAs } from "@/test/loginAs";

vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart-part">{children}</div>
  );
  return {
    ResponsiveContainer: Stub,
    ComposedChart: Stub,
    Area: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

async function openPage(user = "admin") {
  await loginAs(user);
  renderWithProviders({ path: "/what-if" });
  await screen.findByRole("heading", { level: 1, name: "What-if Simulator" });
}

async function clickPreset() {
  const btn = screen.getByRole("button", { name: "Supplier A out 7 days" });
  await vi.waitFor(() => expect(btn).toBeEnabled());
  // Suppliers must have loaded before the preset can pick the first one.
  await screen.findByRole("option", { name: /Bharat Steelworks/ });
  await userEvent.click(btn);
}

describe("What-if Simulator", () => {
  it("shows an idle hint, then runs the preset and renders results", async () => {
    await openPage();
    expect(screen.getByText("No simulation yet")).toBeInTheDocument();
    await clickPreset();
    expect(await screen.findByText("Estimated exposure")).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getByText("Best option")).toBeInTheDocument();
    expect(screen.getByText(/Computed in \d+ ms/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Supplier" })).toHaveValue(
      "SUP-1001",
    );
    expect(screen.getByRole("slider")).toHaveValue("7");
    expect(
      screen
        .getByText(/Inventory falls below requirement on \d{4}-\d{2}-\d{2}/)
        .closest(".sr-only"),
    ).not.toBeNull();
    const gapTable = screen.getByRole("table", { name: /inventory gap data/i });
    expect(within(gapTable).getAllByRole("row").length).toBeGreaterThan(2);
    expect(
      screen.getByText(
        /Largest shortfall: \d+ units on \d{4}-\d{2}-\d{2}\. Range: \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/,
      ),
    ).toBeInTheDocument();
  });

  it("runs other preset chips with their own event, duration and severity", async () => {
    await openPage();
    await screen.findByRole("option", { name: /Bharat Steelworks/ });
    await userEvent.click(
      screen.getByRole("button", { name: "Quality hold 5 days" }),
    );
    expect(await screen.findByText("Estimated exposure")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("5");
    expect(screen.getByRole("radio", { name: "Quality hold" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "High" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Supplier" })).toHaveValue(
      "SUP-1001",
    );
  });

  it("shows the idle illustration copy and event tiles", async () => {
    await openPage();
    expect(
      screen.getByRole("radiogroup", { name: "Event type" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio", { name: /Factory outage/ })[0],
    ).toBeChecked();
    expect(screen.getByTestId("duration-bubble")).toHaveTextContent("7 days");
  });

  it("shows pending state then results in under 3 seconds", async () => {
    await openPage();
    await screen.findByRole("option", { name: /Bharat Steelworks/ });
    await userEvent.click(
      screen.getByRole("button", { name: "Supplier A out 7 days" }),
    );
    expect(screen.getByTestId("whatif-skeleton")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Run simulation/ }),
    ).toBeDisabled();
    await waitFor(
      () => expect(screen.getByText(/Computed in/)).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("disables running for a viewer and explains why", async () => {
    await openPage("viewer");
    expect(
      screen.getByRole("button", { name: /Run simulation/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Supplier A out 7 days" }),
    ).toBeDisabled();
    expect(screen.getByText(/read-only/)).toBeInTheDocument();
  });

  it("allows a procurement manager to run", async () => {
    await openPage("manager");
    await clickPreset();
    expect(await screen.findByText("Estimated exposure")).toBeInTheDocument();
  });

  it("shows an error for a 404", async () => {
    server.use(
      http.post("*/api/v1/what-if", () =>
        HttpResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Supplier SUP-1001 not found.",
              correlation_id: "cid-404",
            },
          },
          { status: 404 },
        ),
      ),
    );
    await openPage();
    await clickPreset();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Simulation failed")).toBeInTheDocument();
    expect(
      within(alert).getByText("Supplier SUP-1001 not found."),
    ).toBeInTheDocument();
  });

  it("shows an error for a 500", async () => {
    server.use(
      http.post("*/api/v1/what-if", () =>
        HttpResponse.json(
          {
            error: {
              code: "DOWNSTREAM_ERROR",
              message: "Simulator unavailable.",
            },
          },
          { status: 500 },
        ),
      ),
    );
    await openPage();
    await clickPreset();
    expect(
      await screen.findByText("Simulator unavailable."),
    ).toBeInTheDocument();
  });

  it('shows "No viable option" when best_option is null', async () => {
    const base = computeWhatIf({
      supplier_id: "SUP-1001",
      event_type: "FACTORY_OUTAGE",
      duration_days: 7,
    })!;
    server.use(
      http.post("*/api/v1/what-if", () =>
        HttpResponse.json({ ...base, best_option: null }),
      ),
    );
    await openPage();
    await clickPreset();
    expect(await screen.findByText("No viable option")).toBeInTheDocument();
  });

  it("labels assumptions and missing data", async () => {
    await openPage();
    await clickPreset();
    await screen.findByText("Estimated exposure");
    const assumptions = screen
      .getByText("Assumptions")
      .closest("div")!.parentElement!;
    expect(
      within(assumptions).getAllByText("Assumption").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Missing data" }),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-evidence="ASSUMPTION"]').length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll('[data-evidence="MISSING_DATA"]').length,
    ).toBeGreaterThan(0);
  });
});
