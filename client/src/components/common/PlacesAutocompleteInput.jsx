import { useEffect, useRef, useId } from 'react';
import { loadGoogleMaps } from '../../utils/loadGoogleMaps';

// Common landmarks & locations across Enugu State, Nigeria
// Provides fallback suggestions for typing even if the Google Maps API key is not active.
export const ENUGU_COMMON_LOCATIONS = [
  { address: 'Faculty of Physical Sciences, UNN, Nsukka, Enugu State', lat: 6.8667, lng: 7.4116 },
  { address: 'UNN Main Gate, University of Nigeria, Nsukka, Enugu State', lat: 6.8682, lng: 7.4095 },
  { address: 'Ogige Market, Nsukka, Enugu State', lat: 6.8590, lng: 7.4010 },
  { address: 'Odenigbo Roundabout, Nsukka, Enugu State', lat: 6.8510, lng: 7.3920 },
  { address: 'Polo Park Mall (Shoprite), GRA, Enugu, Enugu State', lat: 6.4520, lng: 7.5060 },
  { address: 'Independence Layout, Enugu, Enugu State', lat: 6.4385, lng: 7.5255 },
  { address: 'Chime Avenue, New Haven, Enugu, Enugu State', lat: 6.4468, lng: 7.5186 },
  { address: 'Ogui Road, Enugu, Enugu State', lat: 6.4420, lng: 7.5050 },
  { address: 'Abakpa Nike, Enugu, Enugu State', lat: 6.4750, lng: 7.5380 },
  { address: 'Trans-Ekulu, Enugu, Enugu State', lat: 6.4820, lng: 7.5150 },
  { address: '9th Mile Corner, Ngwo, Enugu State', lat: 6.4310, lng: 7.4120 },
  { address: 'Agbani Town (ESUT Campus), Enugu State', lat: 6.3140, lng: 7.5520 },
  { address: 'Emene Industrial Layout / Akanu Ibiam Airport, Enugu', lat: 6.4670, lng: 7.5750 },
  { address: 'Coal Camp, Enugu, Enugu State', lat: 6.4320, lng: 7.4880 },
  { address: 'Holy Ghost Park, Enugu, Enugu State', lat: 6.4410, lng: 7.4980 },
  { address: 'IMT Campus, Enugu, Enugu State', lat: 6.4490, lng: 7.5140 },
  { address: 'Gariki Market, Awkunanaw, Enugu, Enugu State', lat: 6.3980, lng: 7.5180 },
  { address: 'Uwani, Enugu, Enugu State', lat: 6.4250, lng: 7.5020 },
];

/**
 * Checks whether an address string is recognized as within Enugu State
 */
export const checkIsEnuguAddress = (address = '', lat = null, lng = null) => {
  if (!address) return false;
  const upper = address.toUpperCase();

  const enuguKeywords = [
    'ENUGU',
    'NSUKKA',
    'UNN',
    'UNIVERSITY OF NIGERIA',
    '9TH MILE',
    'NGWO',
    'AGBANI',
    'ESUT',
    'UDI',
    'OJI RIVER',
    'AWGU',
    'NKANU',
    'EZEAGU',
    'IGBO-EZE',
    'IGBO-ETITI',
    'UDENU',
    'ORBA',
    'NEW HAVEN',
    'INDEPENDENCE LAYOUT',
    'ABAKPA',
    'TRANS-EKULU',
    'EMENE',
    'COAL CAMP',
    'UWANI',
    'GARIKI',
    'OGUI',
    'POLO PARK',
    'IMT',
    'ODENIGBO',
    'OGIGE',
    'CHIME AVENUE',
  ];

  if (enuguKeywords.some((kw) => upper.includes(kw))) {
    return true;
  }

  if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (nLat >= 5.80 && nLat <= 7.25 && nLng >= 6.80 && nLng <= 7.95) {
      return true;
    }
  }

  return false;
};

// A text input that turns into a Google Places Autocomplete field
// restricted to Nigeria and strongly biased to Enugu State.
const PlacesAutocompleteInput = ({
  onPlaceSelect,
  onLocationWarning,
  onChange,
  value,
  ...inputProps
}) => {
  const inputRef = useRef(null);
  const datalistId = useId();

  useEffect(() => {
    let isMounted = true;
    let listener;

    loadGoogleMaps()
      .then((google) => {
        if (!isMounted || !inputRef.current) return;

        // Bounding box for Enugu State, Nigeria
        const enuguBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(5.85, 6.85),
          new google.maps.LatLng(7.20, 7.85)
        );

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'address_components'],
          componentRestrictions: { country: 'ng' },
          bounds: enuguBounds,
          strictBounds: false,
        });

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const formatted = place.formatted_address || '';

            // Check if place is within Enugu State
            const isEnugu = checkIsEnuguAddress(formatted, lat, lng);
            if (!isEnugu && onLocationWarning) {
              onLocationWarning('Please select an address within Enugu State, Nigeria.');
            }

            onPlaceSelect({
              address: formatted,
              lat,
              lng,
              isEnugu,
            });
          }
        });
      })
      .catch((err) => {
        // Fails gracefully — field behaves as normal input with datalist suggestions
        console.warn('Google Maps Places unavailable, using Enugu suggestions list:', err.message);
      });

    return () => {
      isMounted = false;
      if (listener) listener.remove();
    };
  }, [onPlaceSelect, onLocationWarning]);

  // Handle manual selection from HTML5 datalist or manual typing
  const handleInputChange = (e) => {
    if (onChange) {
      onChange(e);
    }

    const typedValue = e.target.value;
    const match = ENUGU_COMMON_LOCATIONS.find(
      (loc) => loc.address.toLowerCase() === typedValue.trim().toLowerCase()
    );

    if (match && onPlaceSelect) {
      onPlaceSelect({
        address: match.address,
        lat: match.lat,
        lng: match.lng,
        isEnugu: true,
      });
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        autoComplete="off"
        list={datalistId}
        value={value}
        onChange={handleInputChange}
        {...inputProps}
      />
      <datalist id={datalistId}>
        {ENUGU_COMMON_LOCATIONS.map((loc, idx) => (
          <option key={idx} value={loc.address} />
        ))}
      </datalist>
    </>
  );
};

export default PlacesAutocompleteInput;
