import styled from "@emotion/styled";
import { X, Trash2, Square, Minus } from "lucide-react";
import {
  useMeasureStore,
  formatDistance,
  type Measurement,
} from "@/stores/measureStore";

const ACCENT_COLOR = "#14b8a6";

const Panel = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 280px;
  max-height: calc(100vh - 100px);
  background: rgba(20, 20, 25, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  display: flex;
  flex-direction: column;
  z-index: 10;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 4px;
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

const Hint = styled.div`
  padding: 10px 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  line-height: 1.5;
`;

const List = styled.div`
  overflow-y: auto;
  flex: 1;
`;

const Empty = styled.div`
  padding: 24px 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
`;

const Item = styled.div<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: ${(p) => (p.active ? "rgba(20, 184, 166, 0.12)" : "transparent")};

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const Info = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Name = styled.div`
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.9);
`;

const DistanceText = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${ACCENT_COLOR};
`;

const Footer = styled.div`
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  font-size: 12px;
`;

function getMeasurementName(m: Measurement, idx: number): string {
  return `Đo #${idx + 1}`;
}

export function MeasurePanel() {
  const isActive = useMeasureStore((s) => s.isActive);
  const measurements = useMeasureStore((s) => s.measurements);
  const activeId = useMeasureStore((s) => s.activeId);
  const removeMeasurement = useMeasureStore((s) => s.removeMeasurement);
  const clearAll = useMeasureStore((s) => s.clearAll);
  const deactivate = useMeasureStore((s) => s.deactivate);
  const getDistance = useMeasureStore((s) => s.getDistance);

  console.log(measurements);

  if (!isActive) return null;

  const totalAll = measurements.reduce((sum, m) => sum + getDistance(m), 0);

  return (
    <Panel>
      <Header>
        <Title>Đo khoảng cách</Title>
        <HeaderActions>
          {measurements.length > 0 && (
            <IconBtn onClick={clearAll} title="Xóa tất cả">
              <Trash2 size={14} />
            </IconBtn>
          )}
          <IconBtn onClick={deactivate} title="Thoát (Esc)">
            <X size={14} />
          </IconBtn>
        </HeaderActions>
      </Header>

      <Hint>
        Click để thêm điểm. Click lại điểm đầu để đóng vùng, hoặc nhấn{" "}
        <b>Enter</b> / double-click để chốt đường.
      </Hint>

      <List>
        {measurements.length === 0 ? (
          <Empty>Chưa có phép đo nào</Empty>
        ) : (
          measurements.map((m, idx) => {
            const dist = getDistance(m);
            const isActiveItem = m.id === activeId;
            return (
              <Item key={m.id} active={isActiveItem}>
                {m.closed ? <Square size={13} /> : <Minus size={13} />}
                <Info>
                  <Name>
                    {getMeasurementName(m, idx)}
                    {isActiveItem && (
                      <span
                        style={{
                          fontSize: 10,
                          color: ACCENT_COLOR,
                          fontWeight: 400,
                        }}
                      >
                        đang vẽ
                      </span>
                    )}
                  </Name>
                  <DistanceText>
                    {m.points.length < 2 ? "—" : formatDistance(dist)}
                  </DistanceText>
                </Info>
                <IconBtn onClick={() => removeMeasurement(m.id)} title="Xóa">
                  <Trash2 size={13} />
                </IconBtn>
              </Item>
            );
          })
        )}
      </List>

      {measurements.length > 0 && (
        <Footer>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>Tổng cộng</span>
          <span style={{ color: ACCENT_COLOR, fontWeight: 600 }}>
            {formatDistance(totalAll)}
          </span>
        </Footer>
      )}
    </Panel>
  );
}
