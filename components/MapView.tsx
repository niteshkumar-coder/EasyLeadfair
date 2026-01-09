
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { BusinessLead } from '../types';

interface MapViewProps {
  leads: BusinessLead[];
  userCoords: { lat: number; lng: number } | null;
}

const MapView: React.FC<MapViewProps> = ({ leads, userCoords }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayer = useRef<any>(null);

  const isValueValid = (val: string | null): boolean => {
    if (!val) return false;
    const v = String(val).trim().toLowerCase();
    const invalidKeywords = ['null', 'na', 'n/a', 'none', 'undefined', 'not available', 'missing', 'hidden', 'private'];
    if (invalidKeywords.some(k => v === k || v.includes(k))) return false;
    return v.length > 1;
  };

  const isPhoneValid = (phone: string | null): boolean => {
    if (!isValueValid(phone)) return false;
    const digits = String(phone).replace(/[^0-9]/g, '');
    const isRepeating = /^(.)\1+$/.test(digits);
    return digits.length >= 8 && !isRepeating;
  };

  const sanitizePhoneForLink = (phone: any) => {
    return String(phone || "").replace(/[^0-9+]/g, '');
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already done
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: false,
        fadeAnimation: true,
        markerZoomAnimation: true
      }).setView(
        userCoords ? [userCoords.lat, userCoords.lng] : [20.5937, 78.9629], 
        userCoords ? 13 : 5
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(leafletMap.current);

      // Initialize MarkerClusterGroup with custom indigo styling
      markersLayer.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 60,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `
              <div class="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-full border-2 border-white shadow-[0_0_20px_rgba(79,70,229,0.4)] font-black text-xs">
                <span>${count}</span>
              </div>
            `,
            className: 'custom-marker-cluster',
            iconSize: L.point(40, 40)
          });
        }
      }).addTo(leafletMap.current);
      
      L.control.zoom({ position: 'topright' }).addTo(leafletMap.current);
    }

    // Crucial: Fix for "empty/not full screen" map area
    // Sometimes Leaflet doesn't detect container size correctly on mount
    setTimeout(() => {
      if (leafletMap.current) {
        leafletMap.current.invalidateSize();
      }
    }, 250);

    // Clear existing markers
    if (markersLayer.current) {
      markersLayer.current.clearLayers();
    }

    // Add user location marker
    if (userCoords && leafletMap.current && markersLayer.current) {
      L.marker([userCoords.lat, userCoords.lng], {
        icon: L.divIcon({
          className: 'user-marker',
          html: '<div class="w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-lg pulse"></div>',
          iconSize: [20, 20]
        }),
        zIndexOffset: 1000
      }).addTo(markersLayer.current).bindPopup(`
        <div class="p-2 font-bold text-slate-800 text-xs text-center">Your Current Location</div>
      `);
    }

    // Add business markers
    if (leads.length > 0 && markersLayer.current && leafletMap.current) {
      const group: L.LatLng[] = [];
      
      leads.forEach((lead) => {
        if (lead.lat && lead.lng) {
          const latlng = L.latLng(lead.lat, lead.lng);
          group.push(latlng);

          const hasValidPhone = isPhoneValid(lead.phone);
          const hasValidEmail = isValueValid(lead.email);
          const hasValidWebsite = isValueValid(lead.website);

          const marker = L.marker(latlng, {
            icon: L.divIcon({
              className: 'business-marker',
              html: `
                <div class="flex items-center justify-center w-9 h-9 bg-indigo-600 text-white rounded-full shadow-2xl border-2 border-white transform hover:scale-110 transition-transform cursor-pointer">
                  <i class="fa-solid fa-shop text-[10px]"></i>
                </div>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 36]
            })
          });

          const popupContent = `
            <div class="p-0 min-w-[280px] font-sans">
              <div class="bg-indigo-600 p-4 text-white">
                <div class="flex justify-between items-start mb-1">
                   <h3 class="font-black text-sm leading-tight flex-1 mr-2">${lead.name}</h3>
                   <div class="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-black">
                    <i class="fa-solid fa-star text-amber-300"></i>
                    ${lead.rating ? lead.rating.toFixed(1) : 'N/A'}
                  </div>
                </div>
              </div>
              
              <div class="p-4 space-y-4">
                <div class="flex gap-2.5 items-start text-[11px] text-slate-600 leading-relaxed">
                  <i class="fa-solid fa-location-dot mt-0.5 text-indigo-500 w-3"></i>
                  <span class="flex-1">${lead.address}</span>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  ${hasValidPhone ? `
                    <a href="tel:${sanitizePhoneForLink(lead.phone)}" class="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-indigo-100">
                      <i class="fa-solid fa-phone"></i> Call
                    </a>
                  ` : ''}
                  
                  ${hasValidEmail ? `
                    <a href="mailto:${lead.email}" class="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-200">
                      <i class="fa-solid fa-envelope"></i> Email
                    </a>
                  ` : ''}

                  ${hasValidWebsite ? `
                    <a href="${lead.website?.startsWith('http') ? lead.website : `https://${lead.website}`}" 
                       target="_blank" 
                       class="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-200 ${!hasValidPhone && !hasValidEmail ? 'col-span-2' : ''}">
                      <i class="fa-solid fa-globe"></i> Website
                    </a>
                  ` : ''}

                  <a href="${lead.mapsUrl}" 
                     target="_blank" 
                     class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:shadow-lg ${(!hasValidPhone && !hasValidEmail && !hasValidWebsite) ? 'col-span-2' : ''}">
                    <i class="fa-solid fa-map-pin"></i> Profile
                  </a>
                </div>
              </div>
            </div>
          `;

          marker.addTo(markersLayer.current!).bindPopup(popupContent, {
            maxWidth: 320,
            className: 'custom-leaflet-popup'
          });
        }
      });

      // Fit bounds to show all markers
      if (group.length > 0) {
        const bounds = L.latLngBounds(group);
        if (userCoords) bounds.extend([userCoords.lat, userCoords.lng]);
        leafletMap.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [leads, userCoords]);

  return (
    <div className="relative w-full h-[800px] rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 animate-in fade-in duration-700">
      <div ref={mapRef} className="w-full h-full z-10" />
      
      {/* Map Legend Overlay */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-3xl shadow-2xl flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full border border-white shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Your Location</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full border border-white shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Identified Leads</span>
        </div>
      </div>

      <style>{`
        .pulse {
          animation: pulse-animation 2s infinite;
        }
        @keyframes pulse-animation {
          0% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.7); }
          100% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
        }
        .custom-leaflet-popup .leaflet-popup-content-wrapper {
          padding: 0;
          overflow: hidden;
          border-radius: 24px;
          background: white;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .custom-leaflet-popup .leaflet-popup-content {
          margin: 0;
        }
        .custom-leaflet-popup .leaflet-popup-tip {
          background: white;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: white !important;
          padding: 12px !important;
          font-weight: bold;
          font-size: 16px;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          background: rgba(255,255,255,0.1);
          border-radius: 0 24px 0 24px;
        }
        .leaflet-cluster-anim .leaflet-marker-icon, .leaflet-cluster-anim .leaflet-marker-shadow {
          -webkit-transition: -webkit-transform 0.3s ease-out, opacity 0.3s ease-in;
          -moz-transition: -moz-transform 0.3s ease-out, opacity 0.3s ease-in;
          -o-transition: -o-transform 0.3s ease-out, opacity 0.3s ease-in;
          transition: transform 0.3s ease-out, opacity 0.3s ease-in;
        }
      `}</style>
    </div>
  );
};

export default MapView;
