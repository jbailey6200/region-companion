import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Faction from "./pages/Faction";
import GMPanel from "./pages/GMPanel";
import RegionDetails from "./pages/RegionDetails";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/faction/:id" element={<Faction />} />
      <Route path="/gm" element={<GMPanel />} />
      <Route path="/region/:regionId" element={<RegionDetails />} />
    </Routes>
  );
}
