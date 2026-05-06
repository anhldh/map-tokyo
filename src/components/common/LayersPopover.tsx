import { Popover } from "antd";
import styled from "@emotion/styled";
import {
  Layers,
  CloudRain,
  Video,
  Building2,
  Bus,
  type LucideIcon,
  Wind,
  PersonStanding,
  Car,
  AlignEndVertical,
} from "lucide-react";
import { useState } from "react";
import { PANEL_BORDER, ACCENT_COLOR } from "@/styles/constants";
import IconButton from "./IconButton";
import { useLayersStore, type LayerId } from "@/stores/layersStore";

interface LayerOption {
  id: LayerId;
  label: string;
  icon: LucideIcon;
}

const LAYER_OPTIONS: LayerOption[] = [
  { id: "traffic", label: "Giao Thông", icon: Car },
  { id: "jam", label: "Tình hình giao thông", icon: AlignEndVertical },
  { id: "precipitation", label: "Thời tiết", icon: CloudRain },
  { id: "live-cameras", label: "Live Cameras", icon: Video },
  { id: "plateau", label: "PLATEAU", icon: Building2 },
  { id: "gtfs", label: "Giao thông công cộng", icon: Bus },
  { id: "air-quality", label: "Chất lượng không khí", icon: Wind },
  { id: "population", label: "Mật độ dân cư", icon: PersonStanding },
];

// Các cặp layer loại trừ lẫn nhau: bật A thì tự tắt B
const MUTUAL_EXCLUSIONS: Partial<Record<LayerId, LayerId[]>> = {
  jam: ["traffic"],
  traffic: ["jam"],
};

const LayersPopover = () => {
  const [open, setOpen] = useState(false);
  const enabled = useLayersStore((s) => s.enabled);
  const toggle = useLayersStore((s) => s.toggle);
  const setEnabled = useLayersStore((s) => s.setEnabled);

  const handleClick = (id: LayerId) => {
    const willEnable = !enabled.has(id);

    // Nếu đang bật layer này lên, tắt các layer xung đột trước
    if (willEnable) {
      const conflicts = MUTUAL_EXCLUSIONS[id];
      if (conflicts) {
        for (const conflictId of conflicts) {
          if (enabled.has(conflictId)) setEnabled(conflictId, false);
        }
      }
    }

    toggle(id);
  };

  return (
    <Popover
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
      content={
        <PopoverContent>
          <PopoverTitle>Layers</PopoverTitle>
          <LayerList>
            {LAYER_OPTIONS.map(({ id, label, icon: Icon }) => {
              const isSelected = enabled.has(id);
              return (
                <LayerItem
                  key={id}
                  selected={isSelected}
                  onClick={() => handleClick(id)}
                  aria-pressed={isSelected}
                >
                  <IconBox selected={isSelected}>
                    <Icon size={22} strokeWidth={1.8} />
                  </IconBox>
                  <LayerLabel selected={isSelected}>{label}</LayerLabel>
                </LayerItem>
              );
            })}
          </LayerList>
        </PopoverContent>
      }
    >
      <div style={{ display: "inline-block" }}>
        <IconButton title={open ? "" : "Layers"}>
          <Layers size={18} />
        </IconButton>
      </div>
    </Popover>
  );
};

export default LayersPopover;

const PopoverContent = styled.div`
  width: 280px;
  padding: 4px;
  color: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  max-height: 480px;
`;

const PopoverTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  letter-spacing: 0.2px;
  flex-shrink: 0;
`;

const LayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 4px;
  flex: 1;
  min-height: 0;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }
`;

const LayerItem = styled.button<{ selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const IconBox = styled.div<{ selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid
    ${(p) => (p.selected ? ACCENT_COLOR : "rgba(255, 255, 255, 0.15)")};
  color: ${(p) => (p.selected ? ACCENT_COLOR : "rgba(255, 255, 255, 0.85)")};
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
  flex-shrink: 0;

  box-shadow: ${(p) =>
    p.selected ? `0 0 0 3px rgba(94, 234, 212, 0.15)` : "none"};
`;

const LayerLabel = styled.div<{ selected: boolean }>`
  font-size: 15px;
  font-weight: 500;
  color: ${(p) =>
    p.selected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.75)"};
`;
