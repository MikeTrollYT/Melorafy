import HomeControls from "./HomeControls";
import { variantFromStyle } from "./variants";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const initialVariant = variantFromStyle(style);
  return (
    <main className="page">
      <div className="page-content">
        <header className="site-header">
          <a className="brand" href="/" aria-label="Melorafy, página de inicio">
            <img src="/img/logo.svg" alt="" />
            <span>Melorafy</span>
          </a>
        </header>
        <HomeControls initialVariant={initialVariant} />
        <footer className="site-footer">
          Made by{" "}
          <a href="http://miketrollyt.github.io/JC" target="_blank" rel="noreferrer">
            JC
          </a>
        </footer>
      </div>
    </main>
  );
}
