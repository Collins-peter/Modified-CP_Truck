// Dynamically loads the Google Maps JavaScript API (with the Places
// library) exactly once, no matter how many components need it.
// Subsequent calls reuse the same promise instead of injecting the
// script tag multiple times.
let loadPromise = null;

export const loadGoogleMaps = () => {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!apiKey || apiKey === 'your_frontend_google_maps_key_here' || apiKey.trim() === '') {
    return Promise.reject(new Error('Google Maps API key is not configured.'));
  }

  loadPromise = new Promise((resolve, reject) => {
    // Listen for Google Maps authentication error (e.g., API not enabled or invalid key)
    window.gm_authFailure = () => {
      console.warn('Google Maps authentication failed. Ensure Maps JavaScript & Places APIs are enabled.');
      reject(new Error('Google Maps authentication failed.'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps script.'));
    document.head.appendChild(script);
  });

  return loadPromise;
};
