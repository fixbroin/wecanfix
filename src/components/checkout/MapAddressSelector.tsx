
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AddressFormData } from '@/app/checkout/address/page'; // Ensure this type includes lat/lng
import { Loader2, LocateFixed } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MapAddressSelectorProps {
  apiKey: string;
  onAddressSelect: (address: Partial<AddressFormData>) => void;
  onClose: () => void;
}

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bangalore
const DEFAULT_ZOOM = 12;
const DETAILED_ZOOM = 17;

const GOOGLE_MAPS_SCRIPT_ID = "fixbro-google-maps-places-script";
const GOOGLE_MAPS_CALLBACK_NAME = `initFixBroMapAddressSelectorCallback_${Math.random().toString(36).substring(2, 15)}`;


const MapAddressSelector: React.FC<MapAddressSelectorProps> = ({ apiKey, onAddressSelect, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  
  const placeChangedListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const markerDragEndListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const loadGoogleMapsScript = useCallback(() => {
    if (window.google && window.google.maps && window.google.maps.places && window.google.maps.Geocoder) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    if (document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      if (!(window as any)[GOOGLE_MAPS_CALLBACK_NAME]) {
        (window as any)[GOOGLE_MAPS_CALLBACK_NAME] = () => {
          setIsScriptLoaded(true);
          setIsLoading(false);
        };
      }
      if (window.google && window.google.maps && window.google.maps.places && window.google.maps.Geocoder) {
         setIsScriptLoaded(true);
         setIsLoading(false);
      }
      return;
    }
    
    setIsLoading(true); 

    (window as any)[GOOGLE_MAPS_CALLBACK_NAME] = () => {
      setIsScriptLoaded(true);
      setIsLoading(false);
    };

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID; 
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("MapAddressSelector: Google Maps script could not be loaded.");
      setIsLoading(false); 
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
      if (existingScript) existingScript.remove();
      if ((window as any)[GOOGLE_MAPS_CALLBACK_NAME]) delete (window as any)[GOOGLE_MAPS_CALLBACK_NAME];
    };

    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) {
      loadGoogleMapsScript();
    } else {
      console.warn("MapAddressSelector: Google Maps API Key is missing.");
      setIsLoading(false);
    }
    
    return () => {
        if (placeChangedListenerRef.current && autocompleteInstanceRef.current) {
            window.google?.maps?.event?.removeListener(placeChangedListenerRef.current);
        }
        if (mapClickListenerRef.current && mapInstanceRef.current) {
            window.google?.maps?.event?.removeListener(mapClickListenerRef.current);
        }
        if (markerDragEndListenerRef.current && markerRef.current) {
            window.google?.maps?.event?.removeListener(markerDragEndListenerRef.current);
        }
    };
  }, [apiKey, loadGoogleMapsScript]);

  const processAddressResult = useCallback((result: google.maps.places.PlaceResult | google.maps.GeocoderResult, latLng?: google.maps.LatLng | null) => {
    const addressComponents = result.address_components;
    if (!addressComponents) {
      console.warn("MapAddressSelector: No address components found for result.");
      return;
    }

    let streetNumber = "";
    let route = "";
    let sublocalityLevel1 = ""; 
    let sublocalityLevel2 = "";
    let locality = ""; 
    let administrativeAreaLevel1 = ""; 
    let postalCode = "";
    let premise = "";

    for (const component of addressComponents) {
      const types = component.types;
      if (types.includes("premise")) premise = component.long_name;
      if (types.includes("street_number")) streetNumber = component.long_name;
      if (types.includes("route")) route = component.long_name;
      if (types.includes("sublocality_level_2")) sublocalityLevel2 = component.long_name;
      if (types.includes("sublocality_level_1")) sublocalityLevel1 = component.long_name;
      if (types.includes("locality")) locality = component.long_name;
      if (types.includes("administrative_area_level_1")) administrativeAreaLevel1 = component.long_name;
      if (types.includes("postal_code")) postalCode = component.long_name;
    }
    
    let determinedAddressLine1 = "";
    const streetLevelInfo = [streetNumber, route].filter(Boolean).join(" ");
    const placeName = 'name' in result && result.name && result.name !== locality && result.name !== administrativeAreaLevel1 ? result.name : null;

    if (premise) {
      determinedAddressLine1 = [premise, streetLevelInfo].filter(Boolean).join(", ");
    } else if (placeName && streetLevelInfo && placeName !== streetLevelInfo) {
        determinedAddressLine1 = [placeName, streetLevelInfo].filter(Boolean).join(", ");
    } else if (placeName && !streetLevelInfo) {
        determinedAddressLine1 = placeName;
    } else if (streetLevelInfo) {
        determinedAddressLine1 = streetLevelInfo;
    }

    if (!determinedAddressLine1 && sublocalityLevel2) {
      determinedAddressLine1 = sublocalityLevel2;
    } else if (!determinedAddressLine1 && sublocalityLevel1) {
      determinedAddressLine1 = sublocalityLevel1;
    }
    
    let determinedAddressLine2 = "";
    if (sublocalityLevel1 && determinedAddressLine1 && !determinedAddressLine1.includes(sublocalityLevel1)) {
      determinedAddressLine2 = sublocalityLevel1;
    }
    else if (sublocalityLevel2 && determinedAddressLine1 && !determinedAddressLine1.includes(sublocalityLevel2) && sublocalityLevel1 === determinedAddressLine1) {
      determinedAddressLine2 = sublocalityLevel2;
    }
    else if (placeName && determinedAddressLine1 === placeName) {
      if (sublocalityLevel2) determinedAddressLine2 = sublocalityLevel2;
      else if (sublocalityLevel1) determinedAddressLine2 = sublocalityLevel1;
    }

    if (result.formatted_address && !determinedAddressLine1) {
        const parts = result.formatted_address.split(',');
        determinedAddressLine1 = parts[0]?.trim();
        if (parts.length > 1 && !determinedAddressLine2 && parts[1]?.trim() !== locality) {
            determinedAddressLine2 = parts[1]?.trim();
        }
    }

    const currentLatLng = latLng || result.geometry?.location;

    const selectedAddress: Partial<AddressFormData> = {
      addressLine1: determinedAddressLine1 || "",
      addressLine2: determinedAddressLine2 || "",
      city: locality,
      state: administrativeAreaLevel1,
      pincode: postalCode,
      latitude: currentLatLng?.lat() || null,
      longitude: currentLatLng?.lng() || null,
    };

    console.log("MapAddressSelector: Parsed address for form:", selectedAddress);
    onAddressSelect(selectedAddress);
    
    if (autocompleteInputRef.current && result.formatted_address) {
      autocompleteInputRef.current.value = result.formatted_address;
    }
  }, [onAddressSelect]);

  const geocodePosition = useCallback((position: google.maps.LatLng | google.maps.LatLngLiteral) => {
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          processAddressResult(results[0], position instanceof google.maps.LatLng ? position : new google.maps.LatLng(position));
        } else {
          console.warn('MapAddressSelector: Geocode (from click/drag) was not successful: ' + status);
        }
      });
    }
  }, [processAddressResult]);

  const updateMarker = useCallback((position: google.maps.LatLng | google.maps.LatLngLiteral, map: google.maps.Map, shouldGeocode = false) => {
    if (!window.google || !window.google.maps) return;

    if (markerRef.current) {
      markerRef.current.setPosition(position);
      if (markerRef.current.getMap() !== map) { 
          markerRef.current.setMap(map);
      }
    } else {
      markerRef.current = new window.google.maps.Marker({
        position: position,
        map: map,
        draggable: true, 
      });
      console.log("MapAddressSelector: New marker created at", position);

      if (markerDragEndListenerRef.current) {
          window.google.maps.event.removeListener(markerDragEndListenerRef.current);
      }
      markerDragEndListenerRef.current = markerRef.current.addListener('dragend', () => {
        if (markerRef.current) {
          const newPosition = markerRef.current.getPosition();
          if (newPosition) {
            console.log("MapAddressSelector: Marker dragged to", newPosition.toJSON());
            geocodePosition(newPosition); 
          }
        }
      });
    }
    if (shouldGeocode) {
      geocodePosition(position);
    }
  }, [geocodePosition]);


  useEffect(() => {
    if (isScriptLoaded && mapRef.current && !mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
      });
      mapInstanceRef.current = map;
      geocoderRef.current = new window.google.maps.Geocoder();

      updateMarker(DEFAULT_CENTER, map, true); 

      if (mapClickListenerRef.current) {
        window.google.maps.event.removeListener(mapClickListenerRef.current);
      }
      mapClickListenerRef.current = map.addListener('click', (mapsMouseEvent: google.maps.MapMouseEvent) => {
        if (mapsMouseEvent.latLng && mapInstanceRef.current) {
          updateMarker(mapsMouseEvent.latLng, mapInstanceRef.current, true); 
        }
      });

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentPos = { lat: position.coords.latitude, lng: position.coords.longitude };
            map.setCenter(currentPos);
            map.setZoom(DETAILED_ZOOM);
            updateMarker(currentPos, map, true); 
          },
          () => {
            console.warn("MapAddressSelector: Geolocation failed. Using default center.");
          }
        );
      }
    }
  }, [isScriptLoaded, updateMarker, geocodePosition]); 

  useEffect(() => {
    if (isScriptLoaded && mapInstanceRef.current && autocompleteInputRef.current && !autocompleteInstanceRef.current) {
      const map = mapInstanceRef.current;
      const inputElement = autocompleteInputRef.current;
      
      const currentParent = inputElement.parentElement;
      if (currentParent && currentParent.dataset.mapControlPlaceholder === "true") {
        currentParent.removeChild(inputElement);
      }
      
      // Create a container for the search bar
      const searchBarContainer = document.createElement('div');
      searchBarContainer.style.paddingTop = '10px'; // Spacing from map top
      searchBarContainer.style.width = 'auto'; // Let map controls center it
      searchBarContainer.style.minWidth = '280px'; // Minimum comfortable width
      searchBarContainer.style.maxWidth = 'min(calc(100% - 90px), 500px)'; // Responsive, leaves space for LocateMe
      // Apply some common input/card-like styles if needed, though ShadCN input has its own
      searchBarContainer.style.backgroundColor = 'transparent'; // Or match map input style

      // The Input component (inputElement) will fill this container
      // Ensure inputElement itself doesn't have conflicting absolute/fixed positioning
      // It has `w-full` from ShadCN, which is good here.
      inputElement.style.position = ''; // Clear any potentially conflicting position style
      inputElement.style.top = '';
      inputElement.style.left = '';
      inputElement.style.zIndex = ''; // Let control order manage z-index

      searchBarContainer.appendChild(inputElement);
      map.controls[window.google.maps.ControlPosition.TOP_CENTER].push(searchBarContainer);
      
      const ac = new window.google.maps.places.Autocomplete(inputElement, {
        types: ['address'],
        componentRestrictions: { country: 'in' }, 
        fields: ["address_components", "geometry", "name", "formatted_address"]
      });
      autocompleteInstanceRef.current = ac;
      
      if (placeChangedListenerRef.current) {
          window.google.maps.event.removeListener(placeChangedListenerRef.current);
      }

      placeChangedListenerRef.current = ac.addListener('place_changed', () => {
        console.log("MapAddressSelector: Autocomplete place_changed event fired.");
        const place = ac.getPlace();
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(place.geometry.location);
          mapInstanceRef.current.setZoom(DETAILED_ZOOM);
          updateMarker(place.geometry.location, mapInstanceRef.current); 
          processAddressResult(place, place.geometry.location);
        } else {
           if (autocompleteInputRef.current) autocompleteInputRef.current.value = "";
           console.warn("MapAddressSelector: Autocomplete place has no geometry.");
        }
      });

      const locateMeButtonContainer = document.createElement('div');
      locateMeButtonContainer.style.margin = '10px'; // Consistent margin
      locateMeButtonContainer.style.zIndex = '5'; // Ensure above other map elements if any

      const locateMeButton = document.createElement('button');
      const locateFixedIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>`;
      locateMeButton.innerHTML = locateFixedIconSVG;
      locateMeButton.title = "Locate Me";
      locateMeButton.style.backgroundColor = '#fff';
      locateMeButton.style.border = '1px solid transparent';
      locateMeButton.style.borderRadius = '4px'; 
      locateMeButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
      locateMeButton.style.cursor = 'pointer';
      locateMeButton.style.padding = '8px'; 
      locateMeButton.style.textAlign = 'center';
      locateMeButton.type = 'button';
      locateMeButton.style.height = '38px'; 
      locateMeButton.style.width = '38px';

      locateMeButton.onclick = () => {
        if (navigator.geolocation && mapInstanceRef.current) {
          const currentMap = mapInstanceRef.current;
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
              currentMap.setCenter(pos);
              currentMap.setZoom(DETAILED_ZOOM);
              updateMarker(pos, currentMap, true);
            },
            () => { alert('Error: The Geolocation service failed or was denied.'); }
          );
        } else { alert('Error: Your browser doesn\'t support geolocation or map/geocoder not ready.'); }
      };
      
      locateMeButtonContainer.appendChild(locateMeButton);
      map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(locateMeButtonContainer);
    }
  }, [isScriptLoaded, processAddressResult, updateMarker, geocodePosition]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading map...</p>
      </div>
    );
  }
  
  if (!isScriptLoaded && !isLoading && apiKey) { 
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive text-center">Could not load Google Maps. Check API key or network. Reload to try again.</p>
      </div>
    );
  }

  if (!apiKey && !isLoading) {
     return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-center">Google Maps API key not configured. Set in admin settings.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* This div is initially hidden and serves as a placeholder to get a ref to the Input component */}
      <div style={{ display: 'none' }} data-map-control-placeholder="true">
        <Input
          ref={autocompleteInputRef}
          type="text"
          placeholder="Search for your address..."
          className="shadow-md" // Keep existing classes from Input if any
        />
      </div>
      <div ref={mapRef} className="w-full flex-grow" style={{ minHeight: '300px' }}>
        {/* Map will be rendered here by Google Maps API */}
      </div>
      <div className="p-4 border-t bg-background mt-auto">
        <Button onClick={onClose} variant="outline" className="w-full">Use Selected Address & Close</Button>
      </div>
    </div>
  );
};

export default MapAddressSelector;
