// App.tsx
import { ConfigProvider, theme } from "antd";
import Map from "./map/Map";
import MapOverlay from "./components/ui/MapOverlay";
import { useState } from "react";
import { ACCENT_COLOR } from "./styles/constants";
import { startClockTicker } from "./stores/clockStore";

const App = () => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  startClockTicker();
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: ACCENT_COLOR,
          colorBgContainer: "rgba(255, 255, 255, 0.06)",
          colorBorder: "rgba(255, 255, 255, 0.12)",
        },
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100dvw",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        <Map onMapLoad={setMap} />
        <MapOverlay map={map} />
      </div>
    </ConfigProvider>
  );
};

export default App;
