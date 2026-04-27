// src/components/ui/FloodPopover.tsx
import { Popover, Slider, Segmented } from "antd";
import styled from "@emotion/styled";
import { Waves } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PANEL_BORDER } from "@/styles/constants";
import IconButton from "./IconButton";
import { useFloodStore } from "@/stores/floodStore";
import {
  computeEffectiveLevel,
  getDisplayDepth,
  getFloodDescription,
  type FloodScenario,
} from "@/helpers/floodModel";

const PopoverContent = styled.div`
  width: 380px;
  padding: 4px;
  color: rgba(255, 255, 255, 0.95);
`;

const PopoverTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
  letter-spacing: 0.2px;
`;

const Subtitle = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 20px;
  line-height: 1.5;
`;

const Section = styled.div`
  margin-bottom: 20px;
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 10px;
`;

const LevelGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
`;

const LevelBlock = styled.div<{ $align?: "left" | "right" }>`
  text-align: ${(p) => p.$align ?? "left"};
`;

const LevelLabel = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
`;

const LevelValue = styled.div<{ $active: boolean; $accent?: string }>`
  font-size: 24px;
  font-weight: 700;
  color: ${(p) =>
    p.$active ? (p.$accent ?? "#4aa3ff") : "rgba(255,255,255,0.35)"};
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;
  line-height: 1.1;

  span {
    font-size: 13px;
    font-weight: 500;
    margin-left: 3px;
    opacity: 0.7;
  }
`;

const StatusBadge = styled.div<{ $level: number }>`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin-top: 12px;
  background: ${(p) => {
    if (p.$level === 0) return "rgba(120,120,120,0.25)";
    if (p.$level <= 0.5) return "rgba(74,163,255,0.2)";
    if (p.$level <= 2) return "rgba(255,180,50,0.2)";
    return "rgba(255,80,80,0.25)";
  }};
  color: ${(p) => {
    if (p.$level === 0) return "rgba(255,255,255,0.6)";
    if (p.$level <= 0.5) return "#4aa3ff";
    if (p.$level <= 2) return "#ffb432";
    return "#ff5050";
  }};
  border: 1px solid currentColor;
`;

// Marks cho slider
const SLIDER_MARKS: Record<number, ReactNode> = {
  0: <span style={{ color: "rgba(255,255,255,0.7)" }}>Tắt</span>,
  1: <span style={{ color: "rgba(255,255,255,0.5)" }}>1m</span>,
  3: (
    <span style={{ color: "rgba(255,255,255,0.5)" }}>
      3m
      <br />
      Bão lớn
    </span>
  ),
  5: <span style={{ color: "rgba(255,255,255,0.5)" }}>5m</span>,
  10: (
    <span style={{ color: "rgba(255,255,255,0.5)" }}>
      10m
      <br />
      Tsunami
    </span>
  ),
  20: <span style={{ color: "rgba(255,255,255,0.5)" }}>20m</span>,
};

const SCENARIO_OPTIONS = [
  { label: "Lý tưởng", value: "ideal" },
  { label: "Thực tế", value: "realistic" },
  { label: "Tệ nhất", value: "worst-case" },
];

const FloodPopover = () => {
  const [open, setOpen] = useState(false);
  const level = useFloodStore((s) => s.level);
  const scenario = useFloodStore((s) => s.scenario);
  const setLevel = useFloodStore((s) => s.setLevel);
  const setScenario = useFloodStore((s) => s.setScenario);

  const displayDepth = getDisplayDepth(level, scenario);
  const description = getFloodDescription(level, scenario);

  // const effective = computeEffectiveLevel(level, scenario);

  const content: ReactNode = (
    <PopoverContent>
      <PopoverTitle>Mô phỏng ngập lụt</PopoverTitle>
      <Subtitle>
        Mô phỏng phản ứng của hạ tầng chống lụt Tokyo (drainage, đê chắn) khi
        mực nước dâng.
      </Subtitle>

      <Section>
        <SectionLabel>Kịch bản</SectionLabel>
        <Segmented
          block
          value={scenario}
          onChange={(v) => setScenario(v as FloodScenario)}
          options={SCENARIO_OPTIONS}
        />
      </Section>

      <Section>
        <LevelGrid>
          <LevelBlock>
            <LevelLabel>Nước dâng</LevelLabel>
            <LevelValue $active={level > 0}>
              {level.toFixed(1)}
              <span>m</span>
            </LevelValue>
          </LevelBlock>
          <LevelBlock $align="right">
            <LevelLabel>Ngập thực tế</LevelLabel>
            <LevelValue
              $active={displayDepth > 0.05}
              $accent={
                displayDepth > 2
                  ? "#ff5050"
                  : displayDepth > 0.5
                    ? "#ffb432"
                    : "#4aa3ff"
              }
            >
              {displayDepth.toFixed(2)}
              <span>m</span>
            </LevelValue>
          </LevelBlock>
        </LevelGrid>

        <Slider
          min={0}
          max={20}
          step={0.1}
          value={level}
          marks={SLIDER_MARKS}
          tooltip={{ formatter: (v) => `${v}m` }}
          onChange={setLevel}
          styles={{
            track: { background: "#4aa3ff" },
            rail: { background: "rgba(255,255,255,0.15)" },
          }}
        />

        <StatusBadge $level={displayDepth}>{description}</StatusBadge>
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
          padding: 16,
        },
      }}
    >
      <div style={{ display: "inline-block" }}>
        <IconButton title={open ? "" : "Mô phỏng ngập lụt"} active={level > 0}>
          <Waves size={18} />
        </IconButton>
      </div>
    </Popover>
  );
};

export default FloodPopover;
