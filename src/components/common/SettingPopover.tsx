// src/components/ui/SettingsPopover.tsx
import { Popover, Switch, Select } from "antd";
import styled from "@emotion/styled";
import { Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PANEL_BORDER } from "@/styles/constants";
import IconButton from "./IconButton";

const PopoverContent = styled.div`
  width: 320px;
  padding: 4px;
  color: rgba(255, 255, 255, 0.95);
`;

const PopoverTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  letter-spacing: 0.2px;
`;

const Section = styled.div`
  margin-bottom: 20px;
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const SectionLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
`;

const SectionDescription = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
`;

type TrackingMode =
  | "position"
  | "back"
  | "top-back"
  | "front"
  | "top-front"
  | "helicopter"
  | "drone"
  | "bird";

const TRACKING_OPTIONS: { value: TrackingMode; label: string }[] = [
  { value: "position", label: "Chỉ vị trí" },
  { value: "back", label: "Phía sau" },
  { value: "top-back", label: "Sau - từ trên" },
  { value: "front", label: "Phía trước" },
  { value: "top-front", label: "Trước - từ trên" },
  { value: "helicopter", label: "Trực thăng" },
  { value: "drone", label: "Drone" },
  { value: "bird", label: "Bird" },
];

interface SettingsPopoverProps {
  // Optional: nếu muốn parent quản lý state
  onBatterySaverChange?: (enabled: boolean) => void;
  onTrackingModeChange?: (mode: TrackingMode) => void;
}

const SettingsPopover = ({
  onBatterySaverChange,
  onTrackingModeChange,
}: SettingsPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [batterySaver, setBatterySaver] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("position");

  const handleBatteryChange = (checked: boolean) => {
    setBatterySaver(checked);
    onBatterySaverChange?.(checked);
  };

  const handleTrackingChange = (value: TrackingMode) => {
    setTrackingMode(value);
    onTrackingModeChange?.(value);
  };

  const content: ReactNode = (
    <PopoverContent>
      <PopoverTitle>Cài đặt</PopoverTitle>

      <Section>
        <SectionHeader>
          <SectionLabel>Chế độ tiết kiệm pin</SectionLabel>
          <Switch checked={batterySaver} onChange={handleBatteryChange} />
        </SectionHeader>
        <SectionDescription>
          Giảm chất lượng đồ họa và tần suất cập nhật để tiết kiệm năng lượng
          thiết bị.
        </SectionDescription>
      </Section>

      <Section>
        <SectionLabel style={{ marginBottom: 8, display: "block" }}>
          Chế độ theo dõi
        </SectionLabel>
        <Select
          value={trackingMode}
          onChange={handleTrackingChange}
          options={TRACKING_OPTIONS}
          style={{ width: "100%" }}
          popupMatchSelectWidth
        />
      </Section>
    </PopoverContent>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={true}
      styles={{
        container: {
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
          padding: 12,
        },
      }}
    >
      <div style={{ display: "inline-block" }}>
        <IconButton title={open ? "" : "Cài đặt"}>
          <Settings size={18} />
        </IconButton>
      </div>
    </Popover>
  );
};

export default SettingsPopover;
