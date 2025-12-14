import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const CollectionCards = () => {
  const [loading, setLoading] = useState(true);
  
  const collections = [
    {
      name: 'Cat Collection',
      slug: 'cat',
      description: 'Adorable cat-themed designs for cat lovers',
      image: 'https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?w=400&h=600&fit=crop',
      emoji: '🐱',
      color: 'from-anime-pink to-anime-purple'
    },
    {
      name: 'Cute Collection',
      slug: 'cute',
      description: 'Super kawaii designs that melt hearts',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
      emoji: '💖',
      color: 'from-anime-yellow to-anime-pink'
    },
    {
      name: 'Summer Collection',
      slug: 'summer',
      description: 'Bright and vibrant summer vibes',
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=600&fit=crop',
      emoji: '☀️',
      color: 'from-anime-blue to-anime-yellow'
    }
  ];

  // Simulate loading for skeleton effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Skeleton component for collection card
  const SkeletonCollectionCard = () => (
    <div className="relative overflow-hidden rounded-2xl aspect-[9/16] card-anime animate-pulse">
      <Skeleton className="absolute inset-0 w-full h-full" />
      <div className="relative h-full flex flex-col justify-end p-6">
        <Skeleton className="h-10 w-10 rounded-full mb-4" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <Skeleton className="h-5 w-40" />
      </div>
    </div>
  );

  return (
    <section className="py-16 lg:py-24">
  <div className="container mx-auto px-4 text-left">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Featured <span className="text-gradient">Collections</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover our carefully curated collections, each with its own unique anime-inspired style
          </p>
        </div>

        {/* Collection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`skeleton-${index}`}>
                <SkeletonCollectionCard />
              </div>
            ))
          ) : (
            collections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group"
            >
              <div className="relative overflow-hidden rounded-2xl aspect-[9/16] card-anime">
                {/* Background Image */}
                <img
                  src={collection.image}
                  alt={collection.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                
                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${collection.color} opacity-80 group-hover:opacity-90 transition-opacity duration-300`}></div>
                
                {/* Content */}
                <div className="relative h-full flex flex-col justify-end p-6 text-white">
                  {/* Emoji */}
                  <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                    {collection.emoji}
                  </div>
                  
                  {/* Collection Name */}
                  <h3 className="text-2xl font-bold mb-2 group-hover:translate-y-[-4px] transition-transform duration-300">
                    {collection.name}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-white/90 mb-4 group-hover:translate-y-[-4px] transition-transform duration-300">
                    {collection.description}
                  </p>
                  
                  {/* CTA */}
                  <div className="flex items-center text-sm font-medium group-hover:translate-y-[-4px] transition-transform duration-300">
                    <span>Explore Collection</span>
                    <svg 
                      className="ml-2 w-4 h-4 transform group-hover:translate-x-2 transition-transform duration-300" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </Link>
          ))
          )}
        </div>
      </div>
    </section>
  );
};

export default CollectionCards;
