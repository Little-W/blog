import Layout from '@theme/Layout';
import Hero from '@site/src/components/Hero';

export default function Home(): JSX.Element {
  return (
    <Layout wrapperClassName="blog=-list__page">
      <Hero />
    </Layout>
  );
}
