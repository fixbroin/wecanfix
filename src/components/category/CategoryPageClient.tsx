
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } 
from 'next/navigation';
import type { FirestoreCategory, FirestoreSubCategory, FirestoreService, FirestoreCity, FirestoreArea } from '@/types/firestore';
import ServiceCard from '@/components/category/ServiceCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home as HomeIconLucide, ShoppingCart as ShoppingCartIcon, PackageSearch, Loader2, ListFilter } from 'lucide-react'; 
import Link from 'next/link';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Added
import { getOverriddenCategoryName } from '@/lib/adminDataOverrides';
import { Skeleton } from '@/components/ui/skeleton';
import * as IconMapModule from '@/lib/iconMap';
import Image from 'next/image'; 
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import StickyCartContinueButton from '@/components/category/StickyCartContinueButton';
import { useAuth } from '@/hooks/useAuth';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import type { BreadcrumbItem } from '@/types/ui';

interface EnrichedSubCategory extends FirestoreSubCategory {
  services: FirestoreService[];
}

interface CategoryPageClientProps {
  categorySlug: string;
  citySlug?: string; 
  areaSlug?: string; 
  breadcrumbItems?: BreadcrumbItem[]; 
}

const DEFAULT_FALLBACK_SUB_CATEGORY_ICON = "/android-chrome-512x512.png";

export default function CategoryPageClient({ categorySlug, citySlug, areaSlug, breadcrumbItems: initialBreadcrumbItems }: CategoryPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, triggerAuthRedirect } = useAuth();

  const [category, setCategory] = useState<FirestoreCategory | null>(null);
  const [subCategoriesWithServices, setSubCategoriesWithServices] = useState<EnrichedSubCategory[]>([]);
  const [activeSubCategorySlug, setActiveSubCategorySlug] = useState<string | null>(null);
  const [effectiveCategoryName, setEffectiveCategoryName] = useState<string | null>(null);
  const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbItem[]>(initialBreadcrumbItems || []);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const subCategoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stickyNavRef = useRef<HTMLDivElement | null>(null);

  const [isFloatingButtonVisible, setIsFloatingButtonVisible] = useState(false); // Added
  const [isSubCategoryPopoverOpen, setIsSubCategoryPopoverOpen] = useState(false); // Added


  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (!categorySlug || !isMounted) {
        setIsLoading(true); 
        return;
      }

      setIsLoading(true);
      setError(null);
      setCategory(null);
      setSubCategoriesWithServices([]);
      setEffectiveCategoryName(null);
      setActiveSubCategorySlug(null);
      if (!initialBreadcrumbItems) setBreadcrumbItems([]); 

      try {
        const categoriesRef = collection(db, "adminCategories");
        const qCategory = query(categoriesRef, where("slug", "==", categorySlug), limit(1));
        const categorySnapshot = await getDocs(qCategory);

        if (categorySnapshot.empty) {
          setError(`Category "${categorySlug}" not found.`);
          toast({ title: "Not Found", description: `The category "${categorySlug}" could not be found.`, variant: "destructive"});
          setIsLoading(false);
          return;
        }

        const foundCategory = { id: categorySnapshot.docs[0].id, ...categorySnapshot.docs[0].data() } as FirestoreCategory;
        setCategory(foundCategory);
        
        if (!initialBreadcrumbItems) {
          let dynamicBreadcrumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
          let currentCityName: string | null = null;
          let currentAreaName: string | null = null;

          if (citySlug) {
            const cityQuery = query(collection(db, "cities"), where("slug", "==", citySlug), limit(1));
            const citySnap = await getDocs(cityQuery);
            if (!citySnap.empty) {
              currentCityName = (citySnap.docs[0].data() as FirestoreCity).name;
              dynamicBreadcrumbs.push({ label: currentCityName, href: `/${citySlug}` });
            }
          }
          if (citySlug && areaSlug) {
             const cityId = (await getDocs(query(collection(db, "cities"), where("slug", "==", citySlug), limit(1)))).docs[0]?.id;
             if (cityId) {
                const areaQuery = query(collection(db, "areas"), where("slug", "==", areaSlug), where("cityId", "==", cityId), limit(1));
                const areaSnap = await getDocs(areaQuery);
                if (!areaSnap.empty) {
                    currentAreaName = (areaSnap.docs[0].data() as FirestoreArea).name;
                    dynamicBreadcrumbs.push({ label: currentAreaName, href: `/${citySlug}/${areaSlug}`});
                }
             }
          }
          dynamicBreadcrumbs.push({ label: getOverriddenCategoryName(foundCategory.id, foundCategory.name) });
          setBreadcrumbItems(dynamicBreadcrumbs);
          let pageTitlePrefix = currentAreaName ? `${currentAreaName} in ${currentCityName} - ` : (currentCityName ? `${currentCityName} - ` : "");
          setEffectiveCategoryName(pageTitlePrefix + getOverriddenCategoryName(foundCategory.id, foundCategory.name));
        } else {
           setEffectiveCategoryName(getOverriddenCategoryName(foundCategory.id, foundCategory.name));
        }
        
        const subCategoriesRef = collection(db, "adminSubCategories");
        const qSubCategories = query(subCategoriesRef, where("parentId", "==", foundCategory.id), orderBy("order", "asc"));
        const subCategoriesSnapshot = await getDocs(qSubCategories);
        
        const enrichedSubCats: EnrichedSubCategory[] = [];
        
        for (const subDoc of subCategoriesSnapshot.docs) {
          const subCategoryData = { id: subDoc.id, ...subDoc.data() } as FirestoreSubCategory;
          const servicesRef = collection(db, "adminServices");
          const qServices = query(servicesRef, where("subCategoryId", "==", subCategoryData.id), where("isActive", "==", true), orderBy("name", "asc"));
          const servicesSnapshot = await getDocs(qServices);
          const services = servicesSnapshot.docs.map(serviceDoc => ({ id: serviceDoc.id, ...serviceDoc.data() } as FirestoreService));
          enrichedSubCats.push({ ...subCategoryData, services });
        }

        setSubCategoriesWithServices(enrichedSubCats);

        if (enrichedSubCats.length > 0) {
          setActiveSubCategorySlug(enrichedSubCats[0].slug);
        }

      } catch (err: any) {
        console.error("Error fetching category data:", err);
        const errorMessage = err.message || "Failed to load category details. Please try again.";
        setError(errorMessage);
        toast({ 
          title: "Error Loading Data", 
          description: err.code === 'failed-precondition' ? "A required database index is missing. Please check Firebase console." : errorMessage, 
          variant: "destructive",
          duration: 10000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategoryData();
  }, [categorySlug, citySlug, areaSlug, isMounted, toast, initialBreadcrumbItems]);


  useEffect(() => {
    if (typeof window === 'undefined' || !category || !isMounted) return;
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'fixbroCategoryNameOverrides' && category && !initialBreadcrumbItems) { 
        setEffectiveCategoryName(getOverriddenCategoryName(category.id, category.name));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [category, isMounted, initialBreadcrumbItems]);

  // useEffect for scroll-based floating button visibility
  useEffect(() => {
    if (!isMounted) return;
    const scrollThreshold = 300; 

    const handleScroll = () => {
        if (window.scrollY > scrollThreshold) {
            setIsFloatingButtonVisible(true);
        } else {
            setIsFloatingButtonVisible(false);
        }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMounted]);


  const handleSubCategoryClick = useCallback((slug: string) => {
    setActiveSubCategorySlug(slug);
    const element = subCategoryRefs.current[slug];
    if (element) {
       element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setIsSubCategoryPopoverOpen(false); // Close popover on selection
  }, []);
  
  const handleProtectedNav = useCallback((e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, intendedHref: string) => {
    if (!user) {
      e.preventDefault();
      triggerAuthRedirect(intendedHref);
    } else {
      router.push(intendedHref);
    }
  }, [user, triggerAuthRedirect, router]);


  if (!isMounted || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-6 w-1/2 mb-6" /> 
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-10 w-3/4 mb-2" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <Skeleton className="h-12 w-full mb-6" /> 
        <div className="pt-6">
          <Skeleton className="h-8 w-1/3 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-72 w-full" /> 
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Category</h2>
        <p className="text-destructive mb-6">{error}</p>
        <Button variant="outline" onClick={(e) => handleProtectedNav(e, '/categories')}>View All Categories</Button>
      </div>
    );
  }
  
  if (!category) {
     return ( 
      <div className="container mx-auto px-4 py-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Category Not Found</h2>
        <p className="text-muted-foreground mb-6">The category "${categorySlug}" does not exist.</p>
        <Button variant="outline" onClick={(e) => handleProtectedNav(e, '/categories')}>View All Categories</Button>
      </div>
    );
  }

  const pageTitle = effectiveCategoryName || category.h1_title || category.name;

  return (
    <div className="container mx-auto px-4 py-8 pb-24"> {/* Added pb-24 for space for floating buttons */}
      {breadcrumbItems.length > 0 && <Breadcrumbs items={breadcrumbItems} />}
      <nav className="mb-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button variant="ghost" className="text-sm text-muted-foreground hover:text-primary" onClick={(e) => handleProtectedNav(e, '/')}>
            <HomeIconLucide className="mr-2 h-4 w-4" /> Home
        </Button>
      </nav>
      
      <h1 className="text-3xl md:text-4xl font-headline font-semibold mb-2 text-foreground">
        {pageTitle}
      </h1>
      <p className="text-muted-foreground mb-8">Browse services under {pageTitle}.</p>

      {subCategoriesWithServices.length > 0 ? (
        <>
          <div ref={stickyNavRef} className="sticky top-16 z-30 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 border-b mb-6 shadow-sm">
            <ScrollArea className="w-full rounded-md">
              <div className="flex flex-nowrap gap-2 pb-2">
                {subCategoriesWithServices.map(subCat => {
                  return (
                    <Button
                      key={subCat.id}
                      variant={activeSubCategorySlug === subCat.slug ? "default" : "outline"}
                      onClick={() => handleSubCategoryClick(subCat.slug)}
                      className="flex items-center gap-2 px-3 py-1.5 h-auto md:px-4 md:py-2 md:h-10 text-xs md:text-sm whitespace-nowrap"
                    >
                      {subCat.imageUrl ? (
                        <div className="w-4 h-4 md:w-5 md:h-5 relative rounded-sm overflow-hidden mr-1 md:mr-1.5 flex-shrink-0">
                           <Image src={subCat.imageUrl} alt={subCat.name} fill sizes="20px" className="object-cover" data-ai-hint={subCat.imageHint || "sub-category icon"}/>
                        </div>
                      ) : (
                        <div className="w-4 h-4 md:w-5 md:h-5 relative mr-1 md:mr-1.5 flex-shrink-0">
                           <Image src={DEFAULT_FALLBACK_SUB_CATEGORY_ICON} alt={`${subCat.name} icon`} fill sizes="20px" className="object-contain"/>
                        </div>
                      )}
                      {subCat.name}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <div className="space-y-12">
            {subCategoriesWithServices.map(subCat => {
              return (
                <section 
                  key={subCat.id} 
                  id={`section-${subCat.slug}`} 
                  ref={el => subCategoryRefs.current[subCat.slug] = el}
                  className="scroll-mt-40 md:scroll-mt-32 pt-2" 
                >
                  <div className="flex items-center mb-6">
                    {subCat.imageUrl ? (
                       <div className="w-10 h-10 relative rounded-md overflow-hidden mr-3 shadow">
                           <Image src={subCat.imageUrl} alt={subCat.name} fill sizes="40px" className="w-full h-full object-cover" data-ai-hint={subCat.imageHint || "sub-category title"}/>
                       </div>
                    ) : (
                      <div className="w-8 h-8 relative mr-3 flex-shrink-0">
                        <Image src={DEFAULT_FALLBACK_SUB_CATEGORY_ICON} alt={`${subCat.name} icon`} fill sizes="32px" className="object-contain"/>
                      </div>
                    )}
                    <h2 className="text-2xl font-headline font-medium text-foreground">{subCat.name}</h2>
                  </div>
                  {subCat.services.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {subCat.services.map(service => (
                        <ServiceCard key={service.id} service={service} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No services available in this sub-category yet.</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-10">
            <PackageSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No sub-categories or services available for {pageTitle} yet.</p>
        </div>
      )}
      
      {/* Floating Shortcut Menu Button and Popover */}
      {isFloatingButtonVisible && subCategoriesWithServices.length > 1 && (
        <Popover open={isSubCategoryPopoverOpen} onOpenChange={setIsSubCategoryPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="fixed bottom-28 right-6 h-14 w-14 rounded-full shadow-xl z-40 flex items-center justify-center" // Increased size and bottom
              aria-label="Sub-category shortcuts"
            >
              <ListFilter className="h-7 w-7" /> {/* Increased icon size */}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 max-h-[50vh] overflow-y-auto mb-1" side="top" align="end">
            <div className="text-sm font-medium text-muted-foreground px-2 py-1.5">Jump to Sub-category</div>
            <ScrollArea className="max-h-[calc(50vh-40px)]"> {/* Limit height for scrolling within popover */}
                <div className="space-y-1 py-1">
                    {subCategoriesWithServices.map(subCat => (
                        <Button
                            key={`popover-${subCat.id}`}
                            variant="ghost"
                            className="w-full justify-start text-sm h-auto py-2 px-3" // Adjusted padding and height
                            onClick={() => handleSubCategoryClick(subCat.slug)}
                        >
                            {subCat.imageUrl ? (
                                <div className="w-5 h-5 relative rounded-sm overflow-hidden mr-2 flex-shrink-0">
                                <Image src={subCat.imageUrl} alt="" fill sizes="20px" className="object-cover" data-ai-hint={subCat.imageHint || "icon"}/>
                                </div>
                            ) : (
                                <div className="w-5 h-5 relative mr-2 flex-shrink-0">
                                <Image src={DEFAULT_FALLBACK_SUB_CATEGORY_ICON} alt="" fill sizes="20px" className="object-contain"/>
                                </div>
                            )}
                            <span className="truncate">{subCat.name}</span>
                        </Button>
                    ))}
                </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      <StickyCartContinueButton />
    </div>
  );
}

