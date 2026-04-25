// src/components/ui/FloatingPanel.tsx
import styled from "@emotion/styled";
import { PANEL_BG, PANEL_BORDER, PANEL_SHADOW } from "@/styles/constants";

export const FloatingPanel = styled.div`
  display: inline-flex;
  align-items: center;
  background: ${PANEL_BG};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid ${PANEL_BORDER};
  border-radius: 12px;
  box-shadow: ${PANEL_SHADOW};
  padding: 4px;
  gap: 2px;
`;

export const FloatingPanelVertical = styled(FloatingPanel)`
  flex-direction: column;
`;
