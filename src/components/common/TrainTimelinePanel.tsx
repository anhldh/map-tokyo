import styled from "@emotion/styled";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TrainPickResult } from "@/layers/trainThreeLayer";
import { PANEL_BORDER, ACCENT_COLOR } from "@/styles/constants";

interface Props {
  pick: TrainPickResult;
  stationTitles?: Map<string, string>;
  onClose: () => void;
}

const formatTime = (seconds?: number): string => {
  if (seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatStationName = (id: string, titles?: Map<string, string>) =>
  titles?.get(id) ?? id.split(".").pop() ?? id;

const TrainTimelinePanel = ({ pick, stationTitles, onClose }: Props) => {
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto scroll vào station hiện tại
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pick.trainId]);

  const { schedule, segmentIndex, state, railwayColor } = pick;

  return (
    <Panel>
      <Header style={{ borderColor: railwayColor }}>
        <ColorBar style={{ background: railwayColor }} />
        <HeaderInfo>
          <Title>{pick.railwayTitle ?? pick.railwayId.split(".").pop()}</Title>
          <SubTitle>
            {pick.trainNumber} · {pick.trainType.split(".").pop()} ·{" "}
            {pick.direction.split(".").pop()}
          </SubTitle>
        </HeaderInfo>
        <CloseButton onClick={onClose} aria-label="Close">
          <X size={16} />
        </CloseButton>
      </Header>

      <Timeline>
        {schedule.map((stop: any, idx: number) => {
          // Xác định các trạng thái
          const isPassed =
            idx < segmentIndex || (state === "moving" && idx === segmentIndex);

          const isActive =
            (state === "standing" && idx === segmentIndex) ||
            (state === "moving" && idx === segmentIndex + 1);

          const isNext =
            (state === "standing" && idx === segmentIndex + 1) ||
            (state === "moving" && idx === segmentIndex + 2);

          let status: "passed" | "active" | "next" | "upcoming" = "upcoming";
          if (isPassed) status = "passed";
          else if (isActive) status = "active";
          else if (isNext) status = "next";

          // Cài đặt màu nền và viền
          let bgColor = "rgba(255, 255, 255, 0.03)";
          let borderColor = "rgba(255, 255, 255, 0.08)";

          if (status === "passed") {
            bgColor = "rgba(239, 68, 68, 0.08)"; // Đỏ mờ
            borderColor = "rgba(239, 68, 68, 0.4)";
          } else if (status === "active") {
            bgColor = "rgba(34, 197, 94, 0.12)"; // Xanh lá nhạt
            borderColor = "rgba(34, 197, 94, 0.5)";
          } else if (status === "next") {
            bgColor = "rgba(59, 130, 246, 0.12)"; // Xanh nước biển nhạt
            borderColor = "rgba(59, 130, 246, 0.5)";
          }

          return (
            <Stop
              key={`${stop.stationId}-${idx}`}
              ref={isActive ? activeRef : undefined}
              style={{
                background: bgColor,
                borderColor: borderColor,
              }}
            >
              <Name status={status}>
                {formatStationName(stop.stationId, stationTitles)}
              </Name>
              <Time status={status}>
                {formatTime(stop.arrival ?? stop.departure)}
              </Time>
            </Stop>
          );
        })}
      </Timeline>
    </Panel>
  );
};

export default TrainTimelinePanel;

// ================= STYLED COMPONENTS =================

const Panel = styled.div`
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 30;
  width: 340px;
  max-height: 420px; /* <-- Đã giảm chiều cao panel tại đây */
  display: flex;
  flex-direction: column;
  background: rgba(10, 15, 30, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid ${PANEL_BORDER};
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 2px solid;
  flex-shrink: 0;
`;

const ColorBar = styled.div`
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
`;

const HeaderInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SubTitle = styled.div`
  font-size: 11px;
  opacity: 0.6;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${ACCENT_COLOR};
  }
`;

const Timeline = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
`;

const Stop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid;
  transition: all 0.3s ease;
`;

const Name = styled.div<{ status: "passed" | "active" | "next" | "upcoming" }>`
  font-size: 14px;
  font-weight: ${(p) =>
    p.status === "active" ? 700 : p.status === "next" ? 600 : 500};
  color: ${(p) => {
    if (p.status === "active") return "rgba(255, 255, 255, 1)";
    if (p.status === "next") return "rgba(255, 255, 255, 0.9)";
    if (p.status === "passed") return "rgba(239, 68, 68, 0.8)";
    return "rgba(255, 255, 255, 0.6)";
  }};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Time = styled.div<{ status: "passed" | "active" | "next" | "upcoming" }>`
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: ${(p) =>
    p.status === "active" ? 700 : p.status === "next" ? 600 : 500};
  color: ${(p) => {
    if (p.status === "active") return "rgba(255, 255, 255, 1)";
    if (p.status === "next") return "rgba(255, 255, 255, 0.85)";
    if (p.status === "passed") return "rgba(239, 68, 68, 0.7)";
    return "rgba(255, 255, 255, 0.5)";
  }};
`;
