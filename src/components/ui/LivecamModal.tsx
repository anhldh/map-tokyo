import { Modal } from "antd";
import styled from "@emotion/styled";
import { Video } from "lucide-react";
import type { LivecamData } from "@/layers/livecam";

const VideoFrame = styled.div`
  background: black;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;

  iframe {
    width: 100%;
    height: 100%;
    display: block;
    border: none;
  }
`;

export interface LivecamModalProps {
  camera: LivecamData | null;
  lang: string;
  onClose: () => void;
}

export const LivecamModal = ({ camera, lang, onClose }: LivecamModalProps) => {
  const title = camera ? (camera.name[lang] ?? camera.name.en) : "";

  return (
    <Modal
      open={!!camera}
      onCancel={onClose}
      title={title}
      footer={null}
      width="70%"
      centered
      destroyOnHidden
      mask={{ closable: false }}
      styles={{
        header: {
          background: "transparent",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        },
        body: {
          padding: 12,
        },
      }}
    >
      {camera && (
        <VideoFrame dangerouslySetInnerHTML={{ __html: camera.html }} />
      )}
    </Modal>
  );
};

export const LivecamMarkerIcon = () => <Video size={18} />;
