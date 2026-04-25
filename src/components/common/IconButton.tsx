// src/components/ui/IconButton.tsx
import styled from "@emotion/styled";
import { Tooltip } from "antd";
import type { ReactNode } from "react";
import { ACCENT_COLOR } from "@/styles/constants";

interface IconButtonProps {
  title?: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
}

const StyledButton = styled.button<{ active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.active ? "rgba(94, 234, 212, 0.18)" : "transparent")};
  color: ${(p) => (p.active ? ACCENT_COLOR : "rgba(255, 255, 255, 0.95)")};
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.1s ease;

  &:hover {
    background: ${(p) =>
      p.active ? "rgba(94, 234, 212, 0.25)" : "rgba(255, 255, 255, 0.1)"};
  }

  &:active {
    transform: scale(0.95);
  }

  &:focus-visible {
    outline: 2px solid rgba(94, 234, 212, 0.6);
    outline-offset: 2px;
  }
`;

const IconButton = ({
  title,
  children,
  onClick,
  active,
  placement = "bottom",
}: IconButtonProps) => {
  const button = (
    <StyledButton onClick={onClick} active={active}>
      {children}
    </StyledButton>
  );

  if (!title) return button;

  return (
    <Tooltip title={title} placement={placement}>
      {button}
    </Tooltip>
  );
};

export default IconButton;
