import { Popover } from "antd";
import styled from "@emotion/styled";
import { Clock, Plus, Minus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { PANEL_BORDER, ACCENT_COLOR } from "@/styles/constants";
import IconButton from "./IconButton";
import { TOKYO_TZ, useClockStore } from "@/stores/clockStore";
import dayjs, { Dayjs } from "dayjs";

type TimeField = "year" | "month" | "day" | "hour" | "minute" | "second";

interface TimeValue {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FIELDS: {
  key: TimeField;
  pad: number;
  min: number;
  max: (v: TimeValue) => number;
}[] = [
  { key: "year", pad: 4, min: 1970, max: () => 2100 },
  { key: "month", pad: 2, min: 1, max: () => 12 },
  {
    key: "day",
    pad: 2,
    min: 1,
    max: (v) => new Date(v.year, v.month, 0).getDate(),
  },
  { key: "hour", pad: 2, min: 0, max: () => 23 },
  { key: "minute", pad: 2, min: 0, max: () => 59 },
  { key: "second", pad: 2, min: 0, max: () => 59 },
];

const clampDay = (v: TimeValue): TimeValue => {
  const maxDay = new Date(v.year, v.month, 0).getDate();
  return { ...v, day: Math.min(v.day, maxDay) };
};

const TimePopover = () => {
  const [open, setOpen] = useState(false);
  const storeNow = useClockStore((s) => s.now);
  const frozen = useClockStore((s) => s.frozen);
  const offsetMs = useClockStore((s) => s.offsetMs);
  const setTime = useClockStore((s) => s.setTime);
  const resetToRealTime = useClockStore((s) => s.resetToRealTime);

  // Simulated = frozen HOẶC có offset đáng kể
  const isSimulated = frozen || Math.abs(offsetMs) > 1000;

  const dayjsToTimeValue = (d: Dayjs): TimeValue => ({
    year: d.year(),
    month: d.month() + 1,
    day: d.date(),
    hour: d.hour(),
    minute: d.minute(),
    second: d.second(),
  });

  const [draft, setDraft] = useState<TimeValue>(() =>
    dayjsToTimeValue(storeNow),
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Sync draft từ store mỗi lần mở
      setDraft(dayjsToTimeValue(useClockStore.getState().now));
    }
    setOpen(next);
  };

  const handleOk = () => {
    const target = dayjs.tz(
      `${draft.year}-${String(draft.month).padStart(2, "0")}-${String(draft.day).padStart(2, "0")} ` +
        `${String(draft.hour).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}:${String(draft.second).padStart(2, "0")}`,
      TOKYO_TZ,
    );
    setTime(target, { freeze: false });
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(dayjsToTimeValue(useClockStore.getState().now));
    setOpen(false);
  };

  const handleResetRealtime = () => {
    resetToRealTime();
    setOpen(false);
  };

  const adjust = (field: TimeField, delta: number) => {
    setDraft((prev) => {
      const cfg = FIELDS.find((f) => f.key === field)!;
      const max = cfg.max(prev);
      let next = prev[field] + delta;
      if (next < cfg.min) next = max;
      if (next > max) next = cfg.min;
      const updated = { ...prev, [field]: next };
      // Khi đổi year/month, ngày có thể vượt số ngày max của tháng
      return field === "year" || field === "month"
        ? clampDay(updated)
        : updated;
    });
  };

  const pad = (n: number, len: number) => String(n).padStart(len, "0");

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
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
      content={
        <PopoverContent>
          {isSimulated && (
            <SimulatedBanner>
              <span>Đang ở chế độ giả lập</span>
              <ResetInline onClick={handleResetRealtime}>
                <RotateCcw size={12} /> Real-time
              </ResetInline>
            </SimulatedBanner>
          )}
          <FieldsRow>
            {FIELDS.map((f, idx) => (
              <FieldGroup key={f.key}>
                <Field>
                  <StepButton
                    onClick={() => adjust(f.key, 1)}
                    aria-label={`Increase ${f.key}`}
                  >
                    <Plus size={16} strokeWidth={2} />
                  </StepButton>
                  <ValueText>{pad(draft[f.key], f.pad)}</ValueText>
                  <StepButton
                    onClick={() => adjust(f.key, -1)}
                    aria-label={`Decrease ${f.key}`}
                  >
                    <Minus size={16} strokeWidth={2} />
                  </StepButton>
                </Field>
                {idx < FIELDS.length - 1 && (
                  <Separator>{idx < 2 ? "-" : idx === 2 ? " " : ":"}</Separator>
                )}
              </FieldGroup>
            ))}
          </FieldsRow>

          <Actions>
            {frozen && (
              <ActionButton onClick={handleResetRealtime} muted>
                Real-time
              </ActionButton>
            )}
            <div style={{ flex: 1 }} />
            <ActionButton onClick={handleCancel}>Cancel</ActionButton>
            <ActionButton primary onClick={handleOk}>
              OK
            </ActionButton>
          </Actions>
        </PopoverContent>
      }
    >
      <div style={{ display: "inline-block" }}>
        <IconButton
          title={open ? "" : isSimulated ? "Time (simulated)" : "Time"}
          // Khi simulated, dùng border/background highlight để dễ nhận
          style={
            isSimulated
              ? {
                  borderColor: ACCENT_COLOR,
                  background: `${ACCENT_COLOR}22`,
                }
              : undefined
          }
        >
          <Clock
            size={18}
            color={isSimulated ? ACCENT_COLOR : undefined}
            strokeWidth={isSimulated ? 2.4 : undefined}
          />
        </IconButton>
      </div>
    </Popover>
  );
};

export default TimePopover;

const PopoverContent = styled.div`
  color: rgba(255, 255, 255, 0.95);
  user-select: none;
`;

const FieldsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 16px;
`;

const FieldGroup = styled.div`
  display: flex;
  align-items: center;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border-radius: 8px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const StepButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: ${ACCENT_COLOR};
  }

  &:active {
    background: rgba(255, 255, 255, 0.12);
  }
`;

const ValueText = styled.div`
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.98);
  min-width: 32px;
  text-align: center;
  padding: 2px 0;
`;

const Separator = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  padding: 0 2px;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const ActionButton = styled.button<{ primary?: boolean; muted?: boolean }>`
  padding: 8px 18px;
  background: ${(p) =>
    p.primary
      ? ACCENT_COLOR
      : p.muted
        ? "transparent"
        : "rgba(255, 255, 255, 0.06)"};
  border: 1px solid
    ${(p) =>
      p.primary
        ? ACCENT_COLOR
        : p.muted
          ? "rgba(255, 255, 255, 0.2)"
          : "rgba(255, 255, 255, 0.15)"};
  /* ... còn lại giữ nguyên */
  color: ${(p) =>
    p.primary
      ? "rgba(0, 0, 0, 0.85)"
      : p.muted
        ? "rgba(255, 255, 255, 0.7)"
        : "rgba(255, 255, 255, 0.9)"};
`;

const SimulatedBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 14px;
  background: ${ACCENT_COLOR}1a;
  border: 1px solid ${ACCENT_COLOR}55;
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
`;

const ResetInline = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: ${ACCENT_COLOR};
  border: none;
  border-radius: 6px;
  color: rgba(0, 0, 0, 0.9);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.85;
  }
`;
