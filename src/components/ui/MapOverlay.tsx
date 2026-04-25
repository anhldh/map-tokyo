// src/components/ui/MapOverlay.tsx
import { LogoSvg } from "@/assets";
import {
  CircleArrowUp,
  Keyboard,
  Minus,
  Plus,
  Search,
  SunMoon,
  Hand,
  MousePointer,
  PersonStanding,
} from "lucide-react";
import { useEffect, useState } from "react";
import { INITIAL_VIEW } from "@/map/mapConfig";
import IconButton from "../common/IconButton";
import { FloatingPanel, FloatingPanelVertical } from "./FloatingPanel";
import styled from "@emotion/styled";
import { ACCENT_COLOR, PANEL_BORDER } from "@/styles/constants";
import { Flex } from "antd";
import SettingsPopover from "../common/SettingPopover";
import LayersPopover from "../common/LayersPopover";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useMapInteractionStore } from "@/stores/mapInteractionStore";
import FullScreenExpand from "../common/FullScreenExpand";
import ClockUI from "../common/Clock";

interface MapOverlayProps {
  map: mapboxgl.Map | null;
}

const OverlayContainer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
`;

const TopBar = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
`;

const TopBarPanel = styled(FloatingPanel)`
  width: 100%;
  justify-content: space-between;
`;

const RightControls = styled.div`
  position: absolute;
  top: 25%;
  right: 16px;
  transform: translateY(-50%);
`;

const LogoText = styled.div`
  color: ${ACCENT_COLOR};
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 6px 12px;
  min-width: 280px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;

  & input {
    background: transparent;
    border: none;
    outline: none;
    color: rgba(255, 255, 255, 0.95);
    flex: 1;
    font-size: 13px;
    &::placeholder {
      color: rgba(255, 255, 255, 0.45);
    }
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: ${PANEL_BORDER};
  margin: 0 2px;
`;

const MapOverlay = ({ map }: MapOverlayProps) => {
  const [bearing, setBearing] = useState(0);
  const keyboardMode = useMapInteractionStore((s) => s.keyboardMode);
  const toggleKeyboardMode = useMapInteractionStore(
    (s) => s.toggleKeyboardMode,
  );

  useKeyboardNavigation(map);

  useEffect(() => {
    if (!map) return;
    const updateBearing = () => setBearing(map.getBearing());
    updateBearing();
    map.on("rotate", updateBearing);
    return () => {
      map.off("rotate", updateBearing);
    };
  }, [map]);

  if (!map) return null;

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleResetView = () => map.easeTo({ ...INITIAL_VIEW, duration: 800 });

  return (
    <OverlayContainer>
      {/* Top bar */}
      <TopBar>
        <TopBarPanel>
          <Flex align="center" gap={8} justify="center">
            <LogoText>
              <div
                style={{
                  width: 30,
                  height: 30,
                  marginBottom: 8,
                }}
              >
                <LogoSvg />
              </div>
              Tokyo DTW
            </LogoText>
            <Divider />
            <SearchBox>
              <Search size={14} />
              <input placeholder="Search coordinates, locations..." />
            </SearchBox>
          </Flex>
          <ClockUI />

          <Flex align="center" gap={4} justify="center">
            <Flex
              style={{
                marginRight: 20,
              }}
            >
              <IconButton title="Ngày giờ">
                <SunMoon size={18} />
              </IconButton>
              <LayersPopover />
              <SettingsPopover />
            </Flex>
            <Divider />
            <Flex>
              <IconButton title="Di chuyển">
                <Hand size={18} />
              </IconButton>
              <IconButton title="Chọn">
                <MousePointer size={18} />
              </IconButton>
              <IconButton title="Góc nhìn">
                <PersonStanding size={18} />
              </IconButton>
              <FullScreenExpand />
            </Flex>
          </Flex>
        </TopBarPanel>
      </TopBar>

      {/* Right side — single panel dọc */}
      <RightControls>
        <FloatingPanelVertical>
          <IconButton
            title="Về góc nhìn ban đầu"
            onClick={handleResetView}
            placement="left"
          >
            <CircleArrowUp
              size={18}
              style={{
                transform: `rotate(${-bearing}deg)`,
                transition: "transform 0.1s linear",
              }}
            />
          </IconButton>
          <IconButton title="Phóng to" onClick={handleZoomIn} placement="left">
            <Plus size={18} />
          </IconButton>
          <IconButton title="Thu nhỏ" onClick={handleZoomOut} placement="left">
            <Minus size={18} />
          </IconButton>
          <IconButton
            title={
              keyboardMode ? "Tắt điều khiển bàn phím" : "Điều khiển bàn phím"
            }
            onClick={toggleKeyboardMode}
            active={keyboardMode}
            placement="left"
          >
            <Keyboard size={18} />
          </IconButton>
        </FloatingPanelVertical>
      </RightControls>
    </OverlayContainer>
  );
};

export default MapOverlay;
