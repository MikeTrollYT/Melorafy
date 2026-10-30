import Melorafy from "../Melorafy";
import type { Variant } from "../Melorafy";

export default async function Embed({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const variant: Variant =
    style === "classic" || style === "full"
      ? "classic"
      : style === "classic-compact" || style === "compact"
        ? "classic-compact"
        : style === "paper-compact"
          ? "paper-compact"
      : "paper";
  return (
    <div className="embed">
      <Melorafy variant={variant} />
    </div>
  );
}
