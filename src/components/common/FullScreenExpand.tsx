import { Expand, Shrink } from "lucide-react";
import IconButton from "./IconButton";
import { useState, useEffect } from "react";

const FullScreenExpand = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message} (${e.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <IconButton
      title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}
      onClick={toggleFullScreen}
    >
      {isFullScreen ? <Shrink size={18} /> : <Expand size={18} />}
    </IconButton>
  );
};

export default FullScreenExpand;
