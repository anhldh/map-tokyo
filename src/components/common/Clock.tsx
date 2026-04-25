// src/components/ui/Clock.tsx
import styled from "@emotion/styled";
import { useClockStore } from "@/stores/clockStore";
import { Flex } from "antd";

const DateLine = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 1);
  margin-bottom: 1px;
`;

const TimeLine = styled.div`
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
`;

const pad = (n: number) => n.toString().padStart(2, "0");

const ClockUI = () => {
  const now = useClockStore((s) => s.now);

  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds(),
  )}`;

  return (
    <Flex
      align="center"
      gap={12}
      style={{
        color: "#fff",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        padding: "4px 12px",
        borderRadius: 20,
        cursor: "pointer",
      }}
    >
      <DateLine>{dateStr}</DateLine>
      <span>--</span>
      <TimeLine>{timeStr}</TimeLine>
    </Flex>
  );
};

export default ClockUI;
