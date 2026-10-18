import Layout from '@theme/Layout';
import Hero from '@site/src/components/Hero';
import HomeArticleRecommendations from '@site/src/components/HomeArticleRecommendations';
import {GalleryPreview} from '@site/src/components/ImageGallery';

export default function Home(): JSX.Element {
  return (
    <Layout wrapperClassName="blog=-list__page">
      <Hero />
      <HomeArticleRecommendations />
      <GalleryPreview />
    </Layout>
  );
}
