import styled from "@emotion/styled";
import { X, Trash2 } from "lucide-react";
import { useMeasureStore, formatDistance } from "@/stores/measureStore";

const ACCENT_COLOR = "#14b8a6";

const Panel = styled.div`
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 25, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  z-index: 10;
`;

const Total = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.2;

  span:first-of-type {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }
  span:last-of-type {
    font-weight: 600;
    color: ${ACCENT_COLOR};
    font-size: 15px;
  }
`;

const IconBtn = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
`;

export function MeasurePanel() {
  const isActive = useMeasureStore((s) => s.isActive);
  const points = useMeasureStore((s) => s.points);
  const clear = useMeasureStore((s) => s.clear);
  const deactivate = useMeasureStore((s) => s.deactivate);
  const total = useMeasureStore((s) => s.getTotalDistance());

  if (!isActive) return null;

  return (
    <Panel>
      <Total>
        <span>Tổng khoảng cách</span>
        <span>{points.length < 2 ? "—" : formatDistance(total)}</span>
      </Total>
      {points.length > 0 && (
        <IconBtn onClick={clear} title="Xóa tất cả">
          <Trash2 size={16} />
        </IconBtn>
      )}
      <IconBtn onClick={deactivate} title="Thoát (Esc)">
        <X size={16} />
      </IconBtn>
    </Panel>
  );
}
