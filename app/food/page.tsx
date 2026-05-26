import { Overline } from "@/app/_components/overline";

export const dynamic = "force-static";

export default function FoodPage() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-3xl) var(--space-2xl)",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <Overline>FOOD LOG</Overline>
        <h1
          className="text-display-sm"
          style={{
            color: "var(--color-text-primary)",
            margin: "var(--space-sm) 0 var(--space-md)",
            fontSize: 40,
            lineHeight: 1.05,
          }}
        >
          Coming soon.
        </h1>
        <p
          className="text-body-md"
          style={{ color: "var(--color-text-secondary)", margin: 0 }}
        >
          Photo and text food logging is in progress. For now, log workouts on
          the Overview and use a paper notebook for meals.
        </p>
      </div>
    </div>
  );
}
