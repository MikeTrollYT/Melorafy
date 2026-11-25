import Melorafy from "../Melorafy";
import { variantFromStyle } from "../variants";

export default async function Embed({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const variant = variantFromStyle(style);
  return (
    <div className="embed">
      <Melorafy variant={variant} />
    </div>
  );
}
