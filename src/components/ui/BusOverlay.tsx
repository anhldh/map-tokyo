// src/components/map/BusOverlay.tsx
import { useEffect, useState } from "react";
import type mapboxgl from "mapbox-gl";
import styled from "@emotion/styled";
import { Bus, MapPin } from "lucide-react";
import type { BusesLayerHandle, BusPickResult } from "@/layers/busesThreeLayer";

interface BusOverlayProps {
  map: mapboxgl.Map | null;
  busesHandle: BusesLayerHandle | null;
}

interface HoverState {
  pick: BusPickResult;
  screenX: number;
  screenY: number;
}

const BusOverlay = ({ map, busesHandle }: BusOverlayProps) => {
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    if (!map || !busesHandle) return;

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const pick = busesHandle.pickAt({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
      if (pick) {
        // Don't override cursor if train layer already set it
        if (!map.getCanvas().style.cursor) {
          map.getCanvas().style.cursor = "pointer";
        }
        setHover({
          pick,
          screenX: e.originalEvent.clientX,
          screenY: e.originalEvent.clientY,
        });
      } else {
        setHover((prev) => (prev ? null : prev));
      }
    };

    const onMouseLeave = () => setHover(null);

    map.on("mousemove", onMouseMove);
    map.on("mouseleave", onMouseLeave);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseleave", onMouseLeave);
    };
  }, [map, busesHandle]);

  if (!hover) return null;

  const { pick, screenX, screenY } = hover;
  const routeLabel =
    pick.routeShortName ?? pick.routeId?.split(":").pop() ?? "—";

  return (
    <Tooltip
      style={{
        left: screenX + 14,
        top: screenY + 14,
        borderColor: pick.color,
      }}
    >
      <Header>
        <ColorDot style={{ background: pick.color }} />
        <AgencyName>{pick.agencyId}</AgencyName>
      </Header>

      <Row>
        <Bus size={12} />
        <RouteCode>{routeLabel}</RouteCode>
        {pick.routeLongName && <RouteName>{pick.routeLongName}</RouteName>}
      </Row>

      {pick.headsign && (
        <Row>
          <MapPin size={12} />
          <span>{pick.headsign}</span>
        </Row>
      )}

      <VehicleId>#{pick.vehicleId}</VehicleId>
    </Tooltip>
  );
};

export default BusOverlay;

const Tooltip = styled.div`
  position: fixed;
  pointer-events: none;
  z-index: 20;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid;
  border-radius: 8px;
  padding: 8px 12px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  min-width: 180px;
  max-width: 280px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
`;

const ColorDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const AgencyName = styled.div`
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  opacity: 0.9;
`;

const RouteCode = styled.div`
  font-weight: 700;
  background: rgba(255, 255, 255, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
`;

const RouteName = styled.div`
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VehicleId = styled.div`
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 10px;
  opacity: 0.5;
  font-family: monospace;
`;
