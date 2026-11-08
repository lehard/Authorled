import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Privacy } from "./pages/Privacy";
import type { PageKey } from "./site";

const COMPONENTS: Record<PageKey, () => React.JSX.Element> = {
  home: Home,
  privacy: Privacy,
  notFound: NotFound,
};

export function App({ page }: { page: PageKey }) {
  const Page = COMPONENTS[page];
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
