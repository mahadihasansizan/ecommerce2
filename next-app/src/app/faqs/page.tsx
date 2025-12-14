import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils';
import { getHSEOHeadForRoute, HSEOHeadData } from '@/lib/hseo';
import { generateFAQSchema, generateOrganizationSchema, generateWebsiteSchema } from '@/lib/schema-generator';
import { getSiteName } from '@/lib/tenant-config';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';

const faqs = [
  {
    question: 'কিভাবে অর্ডার করবো?',
    answer:
      'আপনি আমাদের নেেক্সট স্টোর থেকে আপনার পছন্দের পণ্য বেছে নিয়ে কার্টে যোগ করে নিরাপদে অর্ডার করতে পারেন।',
  },
  {
    question: 'ডেলিভারি চার্জ কত?',
    answer:
      'ঢাকার মধ্যে ডেলিভারি চার্জ ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা এবং দূরবর্তী এলাকায় আলাদা চার্জ প্রযোজ্য হতে পারে।',
  },
  {
    question: 'কতদিনে পণ্য পৌঁছাবে?',
    answer:
      'ঢাকার ভিতরের অর্ডার সাধারণত ১-২ কর্মদিবসের মধ্যে, ঢাকার বাইরে ২-৪ কর্মদিবসের মধ্যে ডেলিভারি করা হয়।',
  },
  {
    question: 'রিটার্ন বা রিফান্ড কিভাবে করবো?',
    answer:
      'পণ্য পাওয়ার ২৪ ঘণ্টার মধ্যে আমাদের কাস্টমার কেয়ারে প্রমাণসহ যোগাযোগ করলে শর্তপূরণে রিটার্ন বা রিফান্ড করা হয়।',
  },
  {
    question: 'কাস্টমার কেয়ার নম্বর কী?',
    answer: 'হটলাইন: 01835868877 (শনিবার-শুক্রবার ১০টা-৮টা)।',
  },
  {
    question: 'অর্ডার কনফার্মেশন কিভাবে পাব?',
    answer:
      'অর্ডার করার পর আপনার মোবাইল ও ইমেইলে কনফার্মেশন ও ট্র্যাকিং ডিটেইলস পাঠানো হবে।',
  },
];

const buildMetadataFromSeo = (seoData: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || `FAQs - ${getSiteName()}`;
  const description =
    seoData?.description || 'Find answers to questions about ordering, delivery, refunds, and accounts.';

  return {
    title,
    description,
    alternates: { canonical: seoData?.canonical || `${siteUrl}/faqs` },
    openGraph: {
      title,
      description,
      url: seoData?.og_url || `${siteUrl}/faqs`,
      images: seoData?.og_image ? [{ url: seoData.og_image }] : undefined,
      siteName: seoData?.og_site_name || getSiteName(),
      type: normalizeOpenGraphType(seoData?.og_type) ?? 'website',
    },
    twitter: {
      card: normalizeTwitterCard(seoData?.twitter_card) ?? 'summary_large_image',
      title,
      description,
      images: seoData?.twitter_image || seoData?.og_image,
    },
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const seoData = await getHSEOHeadForRoute('/faqs');
  return buildMetadataFromSeo(seoData);
}

const FaqPage = async () => {
  const seoData = await getHSEOHeadForRoute('/faqs');
  const structuredData = [
    generateFAQSchema(faqs),
    generateOrganizationSchema(),
    generateWebsiteSchema(),
    ...(seoData?.json_ld ?? []),
  ];

  return (
    <>
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">FAQ</p>
          <h1 className="text-3xl font-bold mt-2">সাধারণ জিজ্ঞাসা</h1>
          <p className="text-muted-foreground">
            যদি এখানে আপনার প্রশ্নের উত্তর না থাকে, তবে Contact পেজে যোগাযোগ করুন।
          </p>
        </div>
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-border bg-background p-5 space-y-2">
              <p className="text-lg font-semibold">{faq.question}</p>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
};

export default FaqPage;
