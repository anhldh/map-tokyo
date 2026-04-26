// import { useEffect, useRef } from "react";
// import { useMapsLibrary } from "@vis.gl/react-google-maps";
// import { X } from "lucide-react";
// import mapboxgl from "mapbox-gl";
// import { useStreetViewStore } from "@/stores/streetViewStore";

// interface StreetViewPanelProps {
//   mapboxMap: mapboxgl.Map | null;
// }

// export function StreetViewPanel({ mapboxMap }: StreetViewPanelProps) {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
//   const markerRef = useRef<mapboxgl.Marker | null>(null);
//   const listenersRef = useRef<google.maps.MapsEventListener[]>([]);

//   const mode = useStreetViewStore((s) => s.mode);
//   const position = useStreetViewStore((s) => s.position);
//   const close = useStreetViewStore((s) => s.close);

//   const streetViewLib = useMapsLibrary("streetView");

//   useEffect(() => {
//     if (
//       mode !== "viewing" ||
//       !position ||
//       !streetViewLib ||
//       !containerRef.current ||
//       !mapboxMap
//     ) {
//       return;
//     }

//     let cancelled = false;
//     let panorama: google.maps.StreetViewPanorama | null = null;
//     let marker: mapboxgl.Marker | null = null;

//     const svService = new google.maps.StreetViewService();
//     svService.getPanorama(
//       { location: position, radius: 50 },
//       (data, status) => {
//         if (cancelled) return;
//         if (status !== "OK" || !data?.location?.latLng) {
//           alert("Không có Street View tại vị trí này");
//           close();
//           return;
//         }

//         const actualPos = {
//           lng: data.location.latLng.lng(),
//           lat: data.location.latLng.lat(),
//         };

//         // ============== Tạo panorama (cho phép navigation đầy đủ) ==============
//         panorama = new streetViewLib.StreetViewPanorama(containerRef.current!, {
//           position: actualPos,
//           pov: { heading: 0, pitch: 0 },
//           visible: true,
//           // Để mặc định cho user di chuyển/xoay tự do
//           addressControl: false,
//           fullscreenControl: false,
//           motionTracking: false,
//           motionTrackingControl: false,
//           // Để TRUE/không set các option dưới — chúng cho phép navigation
//           // linksControl: true (default)
//           // panControl: true (default)
//           // clickToGo: true (default)
//         });
//         panoramaRef.current = panorama;

//         // ============== Marker hình radar/cone trên Mapbox ==============
//         const el = document.createElement("div");
//         el.innerHTML = `
//           <svg width="80" height="80" viewBox="-40 -40 80 80" style="overflow: visible;">
//             <!-- Cone of vision (hình quạt mờ) -->
//             <path d="M 0,0 L -28,-38 A 47,47 0 0,1 28,-38 Z"
//                   fill="#4285F4" fill-opacity="0.25"
//                   stroke="#4285F4" stroke-width="1" stroke-opacity="0.5"/>
//             <!-- Chấm tròn ở giữa -->
//             <circle cx="0" cy="0" r="8"
//                     fill="#4285F4" stroke="white" stroke-width="3"/>
//           </svg>
//         `;
//         marker = new mapboxgl.Marker({
//           element: el,
//           rotationAlignment: "map", // xoay theo bearing của map
//         })
//           .setLngLat([actualPos.lng, actualPos.lat])
//           .addTo(mapboxMap);
//         markerRef.current = marker;

//         // Center map về vị trí, KHÔNG đổi bearing
//         mapboxMap.flyTo({
//           center: [actualPos.lng, actualPos.lat],
//           zoom: 17,
//           duration: 800,
//         });

//         // ============== Panorama → Mapbox marker ==============
//         // Khi user di chuyển trong street view (click mũi tên / clickToGo)
//         const posListener = panorama.addListener("position_changed", () => {
//           if (!panorama || !marker || !mapboxMap) return;
//           const pos = panorama.getPosition();
//           if (!pos) return;
//           // Update marker position
//           marker.setLngLat([pos.lng(), pos.lat()]);
//           // Pan map theo (KHÔNG flyTo, KHÔNG đổi bearing)
//           mapboxMap.easeTo({
//             center: [pos.lng(), pos.lat()],
//             duration: 300,
//           });
//         });

//         // Khi user xoay góc nhìn → CHỈ xoay marker, KHÔNG đụng map
//         const povListener = panorama.addListener("pov_changed", () => {
//           if (!panorama || !marker) return;
//           const pov = panorama.getPov();
//           marker.setRotation(pov.heading);
//         });

//         listenersRef.current = [posListener, povListener];
//       },
//     );

//     // ============== Cleanup ==============
//     return () => {
//       cancelled = true;

//       listenersRef.current.forEach((l) => google.maps.event.removeListener(l));
//       listenersRef.current = [];

//       marker?.remove();
//       markerRef.current?.remove();
//       markerRef.current = null;

//       if (panorama) {
//         panorama.setVisible(false);
//         if (containerRef.current) {
//           containerRef.current.innerHTML = "";
//         }
//       }
//       panoramaRef.current = null;
//     };
//   }, [mode, streetViewLib, mapboxMap, close]);

//   if (mode !== "viewing") return null;

//   return (
//     <div
//       style={{
//         position: "absolute",
//         top: 16,
//         right: 16,
//         width: 480,
//         height: 320,
//         borderRadius: 12,
//         overflow: "hidden",
//         boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
//         zIndex: 10,
//         background: "#000",
//       }}
//     >
//       <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
//       <button
//         onClick={close}
//         style={{
//           position: "absolute",
//           top: 8,
//           right: 8,
//           width: 32,
//           height: 32,
//           borderRadius: "50%",
//           border: "none",
//           background: "rgba(0,0,0,0.6)",
//           color: "white",
//           cursor: "pointer",
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           zIndex: 1,
//         }}
//       >
//         <X size={18} />
//       </button>
//     </div>
//   );
// }
import { useEffect, useRef } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { X } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { useStreetViewStore } from "@/stores/streetViewStore";
import { StreetViewMarker3D } from "@/layers/streetview/StreetViewMarker3D";

interface StreetViewPanelProps {
  mapboxMap: mapboxgl.Map | null;
}

export function StreetViewPanel({ mapboxMap }: StreetViewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const dragMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const marker3DRef = useRef<StreetViewMarker3D | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const isDraggingRef = useRef(false);

  const mode = useStreetViewStore((s) => s.mode);
  const position = useStreetViewStore((s) => s.position);
  const close = useStreetViewStore((s) => s.close);

  const streetViewLib = useMapsLibrary("streetView");

  useEffect(() => {
    if (
      mode !== "viewing" ||
      !position ||
      !streetViewLib ||
      !containerRef.current ||
      !mapboxMap
    ) {
      return;
    }

    let cancelled = false;
    let panorama: google.maps.StreetViewPanorama | null = null;
    let dragMarker: mapboxgl.Marker | null = null;
    let marker3D: StreetViewMarker3D | null = null;

    // Helper: di chuyển panorama tới vị trí mới (check coverage)
    const moveTo = (lng: number, lat: number) => {
      if (!panorama) return;
      const svc = new google.maps.StreetViewService();
      svc.getPanorama(
        { location: { lat, lng }, radius: 50 },
        (data, status) => {
          if (status === "OK" && data?.location?.latLng && panorama) {
            panorama.setPosition(data.location.latLng);
          } else {
            // Không có coverage → revert marker về vị trí panorama hiện tại
            const current = panorama?.getPosition();
            if (current && dragMarker) {
              dragMarker.setLngLat([current.lng(), current.lat()]);
              marker3D?.setPosition(current.lng(), current.lat());
            }
          }
        },
      );
    };

    const svService = new google.maps.StreetViewService();
    svService.getPanorama(
      { location: position, radius: 50 },
      (data, status) => {
        if (cancelled) return;
        if (status !== "OK" || !data?.location?.latLng) {
          alert("Không có Street View tại vị trí này");
          close();
          return;
        }

        const actualPos = {
          lng: data.location.latLng.lng(),
          lat: data.location.latLng.lat(),
        };

        // ============== Panorama ==============
        panorama = new streetViewLib.StreetViewPanorama(containerRef.current!, {
          position: actualPos,
          pov: { heading: 0, pitch: 0 },
          visible: true,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
        });
        panoramaRef.current = panorama;

        // ============== 3D pyramid layer ==============
        marker3D = new StreetViewMarker3D();
        if (mapboxMap.isStyleLoaded()) {
          mapboxMap.addLayer(marker3D);
        }
        marker3D.setPosition(actualPos.lng, actualPos.lat);
        marker3D.setPov(0, 0);
        marker3DRef.current = marker3D;

        // ============== Draggable marker (trong suốt, chỉ để drag) ==============
        const el = document.createElement("div");
        el.style.cssText = `
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(66, 133, 244, 0.001);
          cursor: grab;
        `;
        // Hover indicator (tuỳ chọn)
        el.addEventListener("mouseenter", () => {
          el.style.background = "rgba(66, 133, 244, 0.3)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.background = "rgba(66, 133, 244, 0.001)";
        });

        dragMarker = new mapboxgl.Marker({
          element: el,
          draggable: true,
        })
          .setLngLat([actualPos.lng, actualPos.lat])
          .addTo(mapboxMap);
        dragMarkerRef.current = dragMarker;

        // Khi đang drag → cập nhật pyramid theo realtime
        dragMarker.on("dragstart", () => {
          isDraggingRef.current = true;
          el.style.cursor = "grabbing";
        });
        dragMarker.on("drag", () => {
          if (!dragMarker || !marker3D) return;
          const pos = dragMarker.getLngLat();
          marker3D.setPosition(pos.lng, pos.lat);
        });
        dragMarker.on("dragend", () => {
          isDraggingRef.current = false;
          el.style.cursor = "grab";
          if (!dragMarker) return;
          const pos = dragMarker.getLngLat();
          moveTo(pos.lng, pos.lat); // panorama jumps tới vị trí mới
        });

        mapboxMap.flyTo({
          center: [actualPos.lng, actualPos.lat],
          zoom: 17,
          pitch: 60, // nghiêng để thấy pyramid 3D rõ
          duration: 800,
        });

        // ============== Sync panorama → marker ==============
        const posListener = panorama.addListener("position_changed", () => {
          if (!panorama || !dragMarker || !marker3D) return;
          if (isDraggingRef.current) return; // đang drag thì panorama im
          const pos = panorama.getPosition();
          if (!pos) return;
          dragMarker.setLngLat([pos.lng(), pos.lat()]);
          marker3D.setPosition(pos.lng(), pos.lat());
          mapboxMap.easeTo({
            center: [pos.lng(), pos.lat()],
            duration: 300,
          });
        });

        const povListener = panorama.addListener("pov_changed", () => {
          if (!panorama || !marker3D) return;
          const pov = panorama.getPov();
          marker3D.setPov(pov.heading, pov.pitch);
        });

        listenersRef.current = [posListener, povListener];
      },
    );

    return () => {
      cancelled = true;

      listenersRef.current.forEach((l) => google.maps.event.removeListener(l));
      listenersRef.current = [];

      dragMarker?.remove();
      dragMarkerRef.current?.remove();
      dragMarkerRef.current = null;

      if (marker3D && mapboxMap.getLayer(marker3D.id)) {
        mapboxMap.removeLayer(marker3D.id);
      }
      marker3DRef.current = null;

      if (panorama) {
        panorama.setVisible(false);
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      }
      panoramaRef.current = null;
    };
  }, [mode, streetViewLib, mapboxMap, close]);

  if (mode !== "viewing") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 480,
        height: 320,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        zIndex: 10,
        background: "#000",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <button
        onClick={close}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "none",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
