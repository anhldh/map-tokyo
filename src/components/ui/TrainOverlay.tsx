import { useEffect, useRef, useState, useCallback } from "react";
import styled from "@emotion/styled";
import { Train, MapPin, ArrowRight } from "lucide-react";
import type {
  TrainsLayerHandle,
  TrainPickResult,
} from "@/layers/trainThreeLayer";
import TrainTimelinePanel from "../common/TrainTimelinePanel";

interface TrainOverlayProps {
  map: mapboxgl.Map | null;
  trainsHandle: TrainsLayerHandle | null;
  /** Mapping station ID → display title nếu có. Optional. */
  stationTitles?: Map<string, string>;
}

interface HoverState {
  pick: TrainPickResult;
  screenX: number;
  screenY: number;
}

const formatStation = (id: string, titles?: Map<string, string>): string =>
  titles?.get(id) ?? id.split(".").pop() ?? id;

const TrainOverlay = ({
  map,
  trainsHandle,
  stationTitles,
}: TrainOverlayProps) => {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selected, setSelected] = useState<TrainPickResult | null>(null);
  const movedRef = useRef(false);
  const downXY = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!map || !trainsHandle) return;

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const pick = trainsHandle.pickAt({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
      if (pick) {
        map.getCanvas().style.cursor = "pointer";
        setHover({
          pick,
          screenX: e.originalEvent.clientX,
          screenY: e.originalEvent.clientY,
        });
      } else {
        map.getCanvas().style.cursor = "";
        setHover(null);
      }
    };

    // Phân biệt click vs drag
    const onMouseDown = (e: mapboxgl.MapMouseEvent) => {
      downXY.current = {
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      };
      movedRef.current = false;
    };
    const onMouseMoveCheck = (e: mapboxgl.MapMouseEvent) => {
      if (!downXY.current) return;
      const dx = e.originalEvent.clientX - downXY.current.x;
      const dy = e.originalEvent.clientY - downXY.current.y;
      if (dx * dx + dy * dy > 25) movedRef.current = true; // > 5px = drag
    };
    const onMouseUp = (e: mapboxgl.MapMouseEvent) => {
      if (!downXY.current || movedRef.current) {
        downXY.current = null;
        return;
      }
      const pick = trainsHandle.pickAt({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
      if (pick) {
        setSelected(pick);
        setHover(null);
      }
      downXY.current = null;
    };

    map.on("mousemove", onMouseMove);
    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMoveCheck);
    map.on("mouseup", onMouseUp);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMoveCheck);
      map.off("mouseup", onMouseUp);
      map.getCanvas().style.cursor = "";
    };
  }, [map, trainsHandle]);

  const closeDetail = useCallback(() => setSelected(null), []);

  return (
    <>
      {hover && !selected && (
        <Tooltip
          style={{
            left: hover.screenX + 14,
            top: hover.screenY + 14,
            borderColor: hover.pick.railwayColor,
          }}
        >
          <TooltipHeader>
            <ColorDot style={{ background: hover.pick.railwayColor }} />
            <TooltipTitle>
              {hover.pick.railwayTitle ?? hover.pick.railwayId.split(".").pop()}
            </TooltipTitle>
          </TooltipHeader>
          <TooltipRow>
            <Train size={12} /> {hover.pick.trainNumber}
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{hover.pick.trainType.split(".").pop()}</span>
          </TooltipRow>
          <TooltipRow>
            <MapPin size={12} />
            {formatStation(hover.pick.fromStation, stationTitles)}
            {hover.pick.toStation && (
              <>
                <ArrowRight size={12} />
                {formatStation(hover.pick.toStation, stationTitles)}
              </>
            )}
          </TooltipRow>
        </Tooltip>
      )}

      {selected && (
        <TrainTimelinePanel
          pick={selected}
          stationTitles={stationTitles}
          onClose={closeDetail}
        />
      )}
    </>
  );
};

export default TrainOverlay;

const Tooltip = styled.div`
  position: fixed;
  pointer-events: none;
  z-index: 20;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid;
  border-radius: 8px;
  padding: 8px 12px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  min-width: 180px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
`;

const TooltipHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
`;

const TooltipTitle = styled.div`
  font-weight: 700;
  font-size: 13px;
`;

const TooltipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.85;
  margin-top: 2px;
`;

const ColorDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
`;
