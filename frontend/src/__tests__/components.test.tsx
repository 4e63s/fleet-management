import { render, screen } from "@testing-library/react";
import { HealthRing } from "../components/HealthRing";
import { Sparkline } from "../components/Sparkline";
import { StatusBadge } from "../components/StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["ACTIVE", "On the road"],
    ["IDLE", "Parked"],
    ["MAINTENANCE", "In workshop"],
    ["RETIRED", "Retired"]
  ] as const)("renders %s as %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("HealthRing", () => {
  it("announces the score to assistive technology", () => {
    render(<HealthRing score={73} />);
    expect(screen.getByRole("img", { name: "Health score 73 out of 100" })).toBeInTheDocument();
    expect(screen.getByText("73")).toBeInTheDocument();
  });

  it("handles missing data", () => {
    render(<HealthRing score={null} />);
    expect(screen.getByRole("img", { name: "No health data" })).toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("asks for more data when there are fewer than two points", () => {
    render(<Sparkline values={[90]} label="trend" />);
    expect(screen.getByText(/Not enough readings/)).toBeInTheDocument();
  });

  it("draws a polyline with one point per value", () => {
    const { container } = render(<Sparkline values={[100, 80, 60, 90]} label="trend" />);
    const points = container.querySelector("polyline")!.getAttribute("points")!.trim().split(" ");
    expect(points).toHaveLength(4);
    expect(screen.getByRole("img", { name: "trend" })).toBeInTheDocument();
  });
});
