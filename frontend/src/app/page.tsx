import { Hero } from '@/components/Hero';
import { FeaturedSlider } from '@/components/FeaturedSlider';
import NewListings from '@/components/NewListings';
import { CTA } from '@/components/CTA';
import CountySearch from '@/components/CountySearch';
import BlogSlider from '@/components/BlogSlider';

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedSlider />
      <NewListings />
      <CTA />
      <CountySearch />
      <BlogSlider />
    </>
  );
}