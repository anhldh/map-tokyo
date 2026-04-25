import { Popover } from "antd";
import styled from "@emotion/styled";
import {
  Layers,
  CloudRain,
  // Sparkles,
  Video,
  Building2,
  Bus,
  type LucideIcon,
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
  { id: "precipitation", label: "Precipitation", icon: CloudRain },
  // { id: "fireworks", label: "Fireworks", icon: Sparkles },
  { id: "live-cameras", label: "Live Cameras", icon: Video },
  { id: "plateau", label: "PLATEAU", icon: Building2 },
  { id: "gtfs", label: "GTFS", icon: Bus },
];

const LayersPopover = () => {
  const [open, setOpen] = useState(false);
  const enabled = useLayersStore((s) => s.enabled);
  const toggle = useLayersStore((s) => s.toggle);

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
                  onClick={() => toggle(id)}
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
`;

const PopoverTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  letter-spacing: 0.2px;
`;

const LayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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
