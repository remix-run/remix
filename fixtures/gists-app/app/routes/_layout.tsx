import { Routes, Route, Outlet } from "react-router-dom";

export default function LayoutTest() {
  return (
    // <Routes>
    //   <Route
    //     element={
    //       <div>
    //         Layout <Outlet />
    //       </div>
    //     }
    //   >
    //     <Route path="test" element={<div>Child</div>} />
    //   </Route>
    //   <Route index element={<div>Index</div>} />
    // </Routes>
    <div>
      <h1>Layout Test</h1>
      <Outlet />
    </div>
  );
}
