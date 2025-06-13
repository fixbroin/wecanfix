
"use client";

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic
import { Button } from '@/components/ui/button';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getGlobalSEOSettings } from '@/lib/seoUtils';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GlobalWebSettings, FirestoreSEOSettings, FirestoreCity, FirestoreArea } from '@/types/firestore';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import type { BreadcrumbItem } from '@/types/ui';
import { useLoading } from '@/contexts/LoadingContext';

// Lazy load components
const HeroCarousel = dynamic(() => import('@/components/home/HeroCarousel').then(mod => mod.HeroCarousel), {
  loading: () => <Skeleton className="h-[180px] sm:h-[250px] md:h-[300px] lg:h-[400px] xl:h-[450px] w-full rounded-lg" />,
  ssr: true, // Keep SSR for Hero Carousel as it's often above the fold
});

const HomeCategoriesSection = dynamic(() => import('@/components/home/HomeCategoriesSection'), {
  loading: () => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="overflow-hidden h-full flex flex-col group">
          <Skeleton className="w-full aspect-square bg-muted" />
          <div className="p-3 text-center"><Skeleton className="h-5 w-3/4 mx-auto bg-muted mt-1" /></div>
        </div>
      ))}
    </div>
  ),
});

const WhyChooseUs = dynamic(() => import('@/components/home/WhyChooseUs'), {
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
    </div>
  ),
});

const Testimonials = dynamic(() => import('@/components/home/Testimonials'), {
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-lg" />)}
    </div>
  ),
});


interface HomePageClientProps {
  citySlug?: string;
  areaSlug?: string;
  breadcrumbItems?: BreadcrumbItem[];
}

export default function HomePageClient({ citySlug, areaSlug, breadcrumbItems }: HomePageClientProps) {
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const [isMounted, setIsMounted] = useState(false);
  const { user, triggerAuthRedirect } = useAuth();
  const router = useRouter();
  const [structuredData, setStructuredData] = useState<Record<string, any> | null>(null);
  const [seoSettings, setSeoSettings] = useState<FirestoreSEOSettings | null>(null);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [pageH1, setPageH1] = useState<string | undefined>(undefined);
  const { showLoading } = useLoading();

  useEffect(() => {
    setIsMounted(true);
    const fetchPageSpecificData = async () => {
      setIsLoadingPageData(true);
      const fetchedSeoSettings = await getGlobalSEOSettings();
      setSeoSettings(fetchedSeoSettings);
      
      let currentH1 = fetchedSeoSettings.homepageH1;
      let fetchedCityData: FirestoreCity | null = null;
      let fetchedAreaData: FirestoreArea | null = null;
      let currentCityNameForLd = fetchedSeoSettings.structuredDataLocality;

      if (citySlug) {
        try {
            const cityQuery = query(collection(db, 'cities'), where('slug', '==', citySlug), where('isActive', '==', true), limit(1));
            const citySnap = await getDocs(cityQuery);
            if (!citySnap.empty) {
                fetchedCityData = {id: citySnap.docs[0].id, ...citySnap.docs[0].data()} as FirestoreCity;
                currentH1 = fetchedCityData.h1_title || fetchedSeoSettings.homepageH1?.replace("FixBro", fetchedCityData.name) || `Services in ${fetchedCityData.name}`;
                currentCityNameForLd = fetchedCityData.name;
            }
        } catch (e) { console.error("Error fetching city data for H1/LD:", e); }
      }

      if (citySlug && areaSlug && fetchedCityData) {
        try {
            const areaQuery = query(collection(db, 'areas'), where('slug', '==', areaSlug), where('cityId', '==', fetchedCityData.id), where('isActive', '==', true), limit(1));
            const areaSnap = await getDocs(areaQuery);
            if (!areaSnap.empty) {
                fetchedAreaData = {id: areaSnap.docs[0].id, ...areaSnap.docs[0].data()} as FirestoreArea;
                currentH1 = fetchedAreaData.h1_title || `Services in ${fetchedAreaData.name}, ${fetchedCityData.name}`;
            }
        } catch (e) { console.error("Error fetching area data for H1/LD:", e); }
      }
      setPageH1(currentH1);

      const siteName = fetchedSeoSettings.siteName || 'FixBro';
      const defaultOgImage = (process.env.NEXT_PUBLIC_BASE_URL || 'https://fixbro.in') + '/images/default-fixbro-logo.png';

      let webSettingsData: GlobalWebSettings | null = null;
      try {
        const webSettingsDocRef = doc(db, "webSettings", "global");
        const webSettingsSnap = await getDoc(webSettingsDocRef);
        if (webSettingsSnap.exists()) {
          webSettingsData = webSettingsSnap.data() as GlobalWebSettings;
        }
      } catch (e) { console.error("Error fetching webSettings for LD+JSON:", e); }

      const ogImage = webSettingsData?.websiteIconUrl || webSettingsData?.logoUrl || fetchedSeoSettings.structuredDataImage || defaultOgImage;
      const pageUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fixbro.in';
      let specificPageUrl = pageUrl;
      if (citySlug && areaSlug) specificPageUrl = `${pageUrl}/${citySlug}/${areaSlug}`;
      else if (citySlug) specificPageUrl = `${pageUrl}/${citySlug}`;

      const ldData: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': fetchedSeoSettings.structuredDataType || 'LocalBusiness', 
        name: fetchedAreaData?.name ? `${siteName} - ${fetchedAreaData.name}, ${fetchedCityData?.name}` : (fetchedCityData?.name ? `${siteName} - ${fetchedCityData.name}` : (fetchedSeoSettings.structuredDataName || siteName)),
        image: ogImage,
        url: specificPageUrl,
        telephone: webSettingsData?.contactMobile || fetchedSeoSettings.structuredDataTelephone,
      };
      if (webSettingsData?.contactEmail) ldData.email = webSettingsData.contactEmail;
      
      const addressData: Record<string, any> = { '@type': 'PostalAddress' };
      if (fetchedAreaData?.name) addressData.addressLocality = fetchedAreaData.name; 
      else if (fetchedCityData?.name) addressData.addressLocality = fetchedCityData.name; 
      else if (fetchedSeoSettings.structuredDataLocality) addressData.addressLocality = fetchedSeoSettings.structuredDataLocality;

      if (fetchedCityData?.name && fetchedAreaData?.name) addressData.addressRegion = fetchedCityData.name; 
      else if (fetchedSeoSettings.structuredDataRegion) addressData.addressRegion = fetchedSeoSettings.structuredDataRegion;
      
      if (fetchedSeoSettings.structuredDataStreetAddress) addressData.streetAddress = fetchedSeoSettings.structuredDataStreetAddress;
      if (fetchedSeoSettings.structuredDataPostalCode) addressData.postalCode = fetchedSeoSettings.structuredDataPostalCode;
      addressData.addressCountry = fetchedSeoSettings.structuredDataCountry || 'IN';
      
      if (Object.keys(addressData).length > 1) { 
          ldData.address = addressData;
      }

      if (fetchedSeoSettings.socialProfileUrls) {
        const sameAsUrls = Object.values(fetchedSeoSettings.socialProfileUrls).filter(url => url && url.trim() !== '');
        if (sameAsUrls.length > 0) {
          ldData.sameAs = sameAsUrls;
        }
      }
      setStructuredData(ldData);
      setIsLoadingPageData(false);
    };

    if (!isLoadingAppSettings) {
      fetchPageSpecificData();
    }
  }, [isLoadingAppSettings, citySlug, areaSlug]);

  const handleProtectedNavigation = useCallback((intendedHref: string) => {
    showLoading();
    if (!user) {
      triggerAuthRedirect(intendedHref);
    } else {
      router.push(intendedHref);
    }
  }, [user, triggerAuthRedirect, router, showLoading]);

  const handleViewAllCategoriesClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      let categoriesPath = "/categories";
      handleProtectedNavigation(categoriesPath);
  }, [handleProtectedNavigation]);

  const handleBookServiceCtaClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      let categoriesPath = "/categories";
      handleProtectedNavigation(categoriesPath);
  }, [handleProtectedNavigation]);


  const displayHeroCarousel = !isLoadingAppSettings && (appConfig.enableHeroCarousel ?? true);
  const finalH1 = pageH1 || seoSettings?.homepageH1 || 'Choose Your Service';

  if (!isMounted || isLoadingAppSettings || isLoadingPageData) {
    return (
      <div className="flex flex-col">
        {breadcrumbItems && breadcrumbItems.length > 0 && (
            <div className="container mx-auto px-4 pt-4 md:pt-6">
                <Skeleton className="h-5 w-1/2 mb-4 sm:mb-6" />
            </div>
        )}
        <section className="py-6 md:py-10">
          <div className="container mx-auto px-4 overflow-hidden">
            <Skeleton className="h-[180px] sm:h-[250px] md:h-[300px] lg:h-[400px] xl:h-[450px] w-full rounded-lg" />
          </div>
        </section>
        <section className="py-8 md:py-12 bg-secondary/30">
          <div className="container mx-auto px-4">
            <Skeleton className="h-8 w-1/3 mx-auto mb-4 md:mb-8" />
            <Skeleton className="h-6 w-1/2 mx-auto mb-8" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="overflow-hidden h-full flex flex-col group">
                  <Skeleton className="w-full aspect-square bg-muted" />
                  <div className="p-3 text-center">
                    <Skeleton className="h-5 w-3/4 mx-auto bg-muted mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {structuredData && <JsonLdScript data={structuredData} idSuffix={citySlug || areaSlug || 'homepage'} />}
      <div className="flex flex-col">
        {breadcrumbItems && breadcrumbItems.length > 0 && (
            <div className="container mx-auto px-4 pt-4 md:pt-6">
               <Breadcrumbs items={breadcrumbItems} />
            </div>
        )}
        {displayHeroCarousel && (
          <section className="py-6 md:py-10">
            <div className="container mx-auto px-4 overflow-hidden">
              <HeroCarousel />
            </div>
          </section>
        )}

        <section className="py-8 md:py-12 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 md:mb-12">
              <h1 className="text-2xl md:text-3xl font-headline font-semibold text-foreground">
                {finalH1}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm md:text-base">
                Discover a wide range of services to meet your needs{citySlug ? ` in ${citySlug.charAt(0).toUpperCase() + citySlug.slice(1).replace(/-/g, ' ')}` : ''}{areaSlug ? `, ${areaSlug.charAt(0).toUpperCase() + areaSlug.slice(1).replace(/-/g, ' ')}` : ''}.
              </p>
            </div>
            <HomeCategoriesSection /> 
            <div className="text-center mt-8 md:mt-12">
              <Button
                variant="outline"
                size="lg"
                onClick={handleViewAllCategoriesClick}
              >
                View All Categories
              </Button>
            </div>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-headline font-semibold text-center mb-8 md:mb-12 text-foreground">
              Why Choose FixBro?
            </h2>
            <WhyChooseUs />
          </div>
        </section>

        <section className="py-8 md:py-12 bg-secondary/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-headline font-semibold text-center mb-8 md:mb-12 text-foreground">
              What Our Customers Say
            </h2>
            <Testimonials />
          </div>
        </section>

        <section className="py-8 md:py-12 text-center bg-primary text-primary-foreground">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg mb-6 max-w-xl mx-auto">
              Book your service today and experience the FixBro difference.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="bg-background text-primary hover:bg-background/90"
              onClick={handleBookServiceCtaClick}
            >
              Book a Service
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
