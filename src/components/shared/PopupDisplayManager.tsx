
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { XIcon, Mail } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { FirestorePopup, PopupDisplayFrequency } from '@/types/firestore';
import { usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const POPUP_SESSION_STORAGE_KEY_PREFIX = 'fixbroPopupShown_';
const POPUP_DAY_STORAGE_KEY_PREFIX = 'fixbroPopupDayShown_'; // For 'once_per_day'

const PopupDisplayManager = () => {
  const [allActivePopups, setAllActivePopups] = useState<FirestorePopup[]>([]);
  const [currentPopupToDisplay, setCurrentPopupToDisplay] = useState<FirestorePopup | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isLoadingPopups, setIsLoadingPopups] = useState(true);
  const pathname = usePathname();
  const { toast } = useToast();
  const [emailForSubscription, setEmailForSubscription] = useState('');

  const popupShownThisLoadRef = useRef(false);
  const exitIntentListenerRef = useRef<(() => void) | null>(null);
  const scrollListenerRef = useRef<(() => void) | null>(null);
  const timerRefs = useRef<NodeJS.Timeout[]>([]);

  const checkFrequency = useCallback((popupId: string, frequency: PopupDisplayFrequency): boolean => {
    if (frequency === "always") return true;

    if (frequency === "once_per_session") {
      const sessionKey = `${POPUP_SESSION_STORAGE_KEY_PREFIX}${popupId}`;
      if (sessionStorage.getItem(sessionKey) === 'true') {
        return false;
      }
    }

    if (frequency === "once_per_day") {
      const dayKey = `${POPUP_DAY_STORAGE_KEY_PREFIX}${popupId}`;
      const lastShownTimestamp = localStorage.getItem(dayKey);
      if (lastShownTimestamp) {
        const today = new Date().toDateString();
        const lastShownDate = new Date(parseInt(lastShownTimestamp, 10)).toDateString();
        if (today === lastShownDate) {
          return false;
        }
      }
    }
    return true;
  }, []);

  const markAsShown = useCallback((popupId: string, frequency: PopupDisplayFrequency) => {
    if (frequency === "once_per_session") {
      const sessionKey = `${POPUP_SESSION_STORAGE_KEY_PREFIX}${popupId}`;
      sessionStorage.setItem(sessionKey, 'true');
    }
    if (frequency === "once_per_day") {
      const dayKey = `${POPUP_DAY_STORAGE_KEY_PREFIX}${popupId}`;
      localStorage.setItem(dayKey, Date.now().toString());
    }
  }, []);

  const activatePopup = useCallback((popup: FirestorePopup) => {
    if (popupShownThisLoadRef.current) return;

    if (checkFrequency(popup.id, popup.displayFrequency)) {
      console.log(`PopupDisplayManager: Activating popup "${popup.name}" (Rule: ${popup.displayRuleType})`);
      setCurrentPopupToDisplay(popup);
      setIsPopupVisible(true);
      markAsShown(popup.id, popup.displayFrequency);
      popupShownThisLoadRef.current = true;

      if (exitIntentListenerRef.current) {
        exitIntentListenerRef.current();
        exitIntentListenerRef.current = null;
      }
      if (scrollListenerRef.current) {
        scrollListenerRef.current();
        scrollListenerRef.current = null;
      }
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
    } else {
      console.log(`PopupDisplayManager: Frequency check failed for popup "${popup.name}"`);
    }
  }, [checkFrequency, markAsShown]);


  useEffect(() => {
    const fetchPopupsAndSetupTriggers = async () => {
      setIsLoadingPopups(true);
      popupShownThisLoadRef.current = false;

      try {
        const popupsCollectionRef = collection(db, "adminPopups");
        const q = query(popupsCollectionRef, where("isActive", "==", true), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedPopups = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestorePopup));
        setAllActivePopups(fetchedPopups);

        const pageLoadPopup = fetchedPopups.find(p => p.displayRuleType === 'on_page_load');
        if (pageLoadPopup) {
          activatePopup(pageLoadPopup);
        }
        if (popupShownThisLoadRef.current) { setIsLoadingPopups(false); return; }

        fetchedPopups.filter(p => p.displayRuleType === 'after_x_seconds').forEach(popup => {
          if (!popupShownThisLoadRef.current && checkFrequency(popup.id, popup.displayFrequency)) {
            const delay = (popup.displayRuleValue || 5) * 1000;
            const timerId = setTimeout(() => {
              if (!popupShownThisLoadRef.current) {
                activatePopup(popup);
              }
            }, delay);
            timerRefs.current.push(timerId);
          }
        });
        if (popupShownThisLoadRef.current) { setIsLoadingPopups(false); return; }

        const scrollPopup = fetchedPopups.find(p => p.displayRuleType === 'on_scroll_percentage');
        if (scrollPopup && !popupShownThisLoadRef.current && checkFrequency(scrollPopup.id, scrollPopup.displayFrequency)) {
          const handleScroll = () => {
            if (popupShownThisLoadRef.current) {
              window.removeEventListener('scroll', handleScroll);
              return;
            }
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollPercent >= (scrollPopup.displayRuleValue || 50)) {
              activatePopup(scrollPopup);
              window.removeEventListener('scroll', handleScroll);
            }
          };
          window.addEventListener('scroll', handleScroll, { passive: true });
          scrollListenerRef.current = () => window.removeEventListener('scroll', handleScroll);
        }
        if (popupShownThisLoadRef.current) { setIsLoadingPopups(false); return; }

        const exitIntentPopup = fetchedPopups.find(p => p.displayRuleType === 'on_exit_intent');
        if (exitIntentPopup && !popupShownThisLoadRef.current && checkFrequency(exitIntentPopup.id, exitIntentPopup.displayFrequency)) {
          const isDesktop = window.innerWidth >= 768;

          if (isDesktop) {
            const handleDesktopMouseOut = (e: MouseEvent) => {
              if (popupShownThisLoadRef.current) {
                document.documentElement.removeEventListener('mouseout', handleDesktopMouseOut);
                return;
              }
              if (e.clientY <= 0) {
                activatePopup(exitIntentPopup);
                document.documentElement.removeEventListener('mouseout', handleDesktopMouseOut);
              }
            };
            document.documentElement.addEventListener('mouseout', handleDesktopMouseOut);
            exitIntentListenerRef.current = () => document.documentElement.removeEventListener('mouseout', handleDesktopMouseOut);
          } else { // Mobile: Attempt to detect back button press
            const mobileExitIntentStateKey = 'fixbroMobileExitIntentMarker';
            let statePushedByManager = false;

            // Function to push state if our marker isn't already the current state
            const pushOurState = () => {
                if (history.state?.[mobileExitIntentStateKey] !== true) {
                    history.pushState({ [mobileExitIntentStateKey]: true }, "");
                    statePushedByManager = true;
                }
            };

            pushOurState(); // Push state when setting up the listener

            const handleMobilePopState = (event: PopStateEvent) => {
              // If the state we are navigating TO does NOT have our marker,
              // AND we haven't shown a popup yet in this load cycle,
              // it implies our marker state was just popped (user hit back).
              if (event.state?.[mobileExitIntentStateKey] !== true && !popupShownThisLoadRef.current) {
                activatePopup(exitIntentPopup);
              }
              // Crucially, remove this listener after it has potentially acted,
              // or if the component unmounts.
              window.removeEventListener('popstate', handleMobilePopState);
              exitIntentListenerRef.current = null; // Clear the ref
            };

            window.addEventListener('popstate', handleMobilePopState);
            exitIntentListenerRef.current = () => {
              window.removeEventListener('popstate', handleMobilePopState);
              // If our state was pushed and is still the current state when cleaning up (e.g., user navigates away via link),
              // try to go back to remove it from history. This is a bit of a best-effort cleanup.
              if (statePushedByManager && history.state?.[mobileExitIntentStateKey] === true) {
                // This history.back() can be tricky. If the user is navigating forward,
                // and this cleanup runs, it might interfere.
                // For now, let's assume the primary cleanup is removing the listener.
                // history.back(); // Consider implications carefully before enabling.
              }
            };
          }
        }

      } catch (error) {
        console.error("Error fetching or setting up popups:", error);
        toast({ title: "Popup System Error", description: "Could not initialize popups.", variant: "destructive" });
      } finally {
        setIsLoadingPopups(false);
      }
    };

    if (pathname === '/') {
      fetchPopupsAndSetupTriggers();
    } else {
      setIsLoadingPopups(false);
    }

    return () => {
      if (exitIntentListenerRef.current) {
        exitIntentListenerRef.current();
        exitIntentListenerRef.current = null;
      }
      if (scrollListenerRef.current) {
        scrollListenerRef.current();
        scrollListenerRef.current = null;
      }
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
    };
  }, [pathname, toast, activatePopup, checkFrequency]);


  const handlePopupClose = () => {
    setIsPopupVisible(false);
    setEmailForSubscription('');
  };

  const handleActionClick = (targetUrl?: string | null) => {
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
    handlePopupClose();
  };
  
  const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!emailForSubscription || !/^\S+@\S+\.\S+$/.test(emailForSubscription)) {
        toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
        return;
    }
    console.log("Subscribing email:", emailForSubscription);
    toast({ title: "Subscribed!", description: `Thank you for subscribing with ${emailForSubscription}.`, className:"bg-green-100 text-green-700 border-green-300" });
    
    if (currentPopupToDisplay?.targetUrl) {
        setTimeout(() => {
             window.open(currentPopupToDisplay.targetUrl!, '_blank');
             handlePopupClose();
        }, 1500);
    } else {
        handlePopupClose();
    }
  };

  const getVideoEmbedUrl = (url: string): string => {
    let videoId;
    if (url.includes("youtube.com/watch?v=")) {
      videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&loop=1&playlist=${videoId}`;
    }
    if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&loop=1&playlist=${videoId}`;
    }
    if (url.includes("vimeo.com/")) {
      videoId = url.split("vimeo.com/")[1]?.split("?")[0];
      if (videoId && !isNaN(Number(videoId))) {
         return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&controls=0&loop=1&autopause=0&background=1`;
      }
    }
    return url;
  };

  if (isLoadingPopups || !currentPopupToDisplay || !isPopupVisible || pathname !== '/') {
    return null;
  }

  const isDirectVideoLink = currentPopupToDisplay.videoUrl && (currentPopupToDisplay.videoUrl.endsWith('.mp4') || currentPopupToDisplay.videoUrl.endsWith('.webm') || currentPopupToDisplay.videoUrl.endsWith('.ogv'));
  const embedUrl = currentPopupToDisplay.videoUrl ? getVideoEmbedUrl(currentPopupToDisplay.videoUrl) : '';

  return (
    <Dialog open={isPopupVisible} onOpenChange={(open) => { if (!open) handlePopupClose(); }}>
      <DialogContent className="sm:max-w-md md:max-w-lg p-0 overflow-hidden shadow-2xl rounded-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        {currentPopupToDisplay.showCloseButton !== false && (
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-50 h-7 w-7 rounded-full bg-background/60 hover:bg-background/90 text-muted-foreground hover:text-foreground backdrop-blur-sm"
              aria-label="Close popup"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </DialogClose>
        )}

        <div 
          className="relative"
          onClick={currentPopupToDisplay.popupType === 'video' && currentPopupToDisplay.targetUrl ? () => handleActionClick(currentPopupToDisplay.targetUrl) : undefined}
          style={currentPopupToDisplay.popupType === 'video' && currentPopupToDisplay.targetUrl ? { cursor: 'pointer' } : {}}
        >
          {currentPopupToDisplay.imageUrl && currentPopupToDisplay.popupType !== 'video' && (
            <div 
              className="relative w-full h-48 md:h-64"
              onClick={!currentPopupToDisplay.buttonText ? () => handleActionClick(currentPopupToDisplay.targetUrl) : undefined}
              style={!currentPopupToDisplay.buttonText && currentPopupToDisplay.targetUrl ? {cursor: 'pointer'} : {}}
            >
              <Image
                src={currentPopupToDisplay.imageUrl}
                alt={currentPopupToDisplay.title || "Popup Image"}
                fill
                className="object-cover"
                data-ai-hint={currentPopupToDisplay.imageHint || "popup marketing image"}
              />
            </div>
          )}
          
          {currentPopupToDisplay.popupType === 'video' && currentPopupToDisplay.videoUrl && (
            <div className="relative w-full aspect-video bg-black">
              {isDirectVideoLink ? (
                 <video
                    src={embedUrl}
                    className="w-full h-full"
                    autoPlay
                    muted
                    loop
                    playsInline
                    webkit-playsinline="true" 
                />
              ) : (
                <iframe
                    src={embedUrl}
                    title={currentPopupToDisplay.title || "Popup Video"}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen={true}
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                ></iframe>
              )}
            </div>
          )}
          
          <div className="p-6 space-y-3 text-center">
            <DialogHeader className="text-center">
              {currentPopupToDisplay.title && (
                <DialogTitle className="text-2xl font-headline text-foreground">
                  {currentPopupToDisplay.title}
                </DialogTitle>
              )}
            </DialogHeader>
            {currentPopupToDisplay.displayText && (
              <DialogDescription className="text-muted-foreground text-base">
                {currentPopupToDisplay.displayText}
              </DialogDescription>
            )}
            {currentPopupToDisplay.promoCode && (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">Use promo code:</p>
                <p className="text-lg font-bold text-primary tracking-wider border border-dashed border-primary/50 bg-primary/10 py-1.5 px-3 rounded-md inline-block">
                  {currentPopupToDisplay.promoCode}
                </p>
              </div>
            )}
            {currentPopupToDisplay.showEmailInput && (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 mt-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={emailForSubscription}
                  onChange={(e) => setEmailForSubscription(e.target.value)}
                  required
                  className="h-10 text-base"
                />
                <Button type="submit" className="w-full sm:w-auto h-10">
                  <Mail className="mr-2 h-4 w-4"/> Subscribe
                </Button>
              </form>
            )}
             {currentPopupToDisplay.buttonText && currentPopupToDisplay.targetUrl && (
               <DialogFooter className="mt-4 sm:justify-center">
                 <Button size="lg" onClick={() => handleActionClick(currentPopupToDisplay.targetUrl)} className="w-full sm:w-auto">
                   {currentPopupToDisplay.buttonText}
                 </Button>
               </DialogFooter>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PopupDisplayManager;
