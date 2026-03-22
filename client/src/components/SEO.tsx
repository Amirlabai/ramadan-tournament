import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SEO = ({
  title,
  description = "טורניר כפר כמא - תוצאות בזמן אמת, טבלאות, סטטיסטיקות וחדשות. עקבו אחרי טורניר כפר כמא.",
  keywords = "טורניר, כדורגל, כפר כמא, תוצאות כדורגל, ליגה , Ramadan Tournament, Kfar Kama, Football, amir labai, amir labay, אמיר לבאי, אמיר לבי, מרכז צעירים, מרכז צעירים כפר כמא",
  image = "https://ramadan-tournament-client.vercel.app/og-image.jpg",
  url = "https://ramadan-tournament-client.vercel.app/",
  type = "website"
}: SEOProps) => {
  const fullTitle = title ? `${title} | טורניר כפר כמא` : "טורניר כפר כמא - 2026";

  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};

export default SEO;
