import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Display from "./Display";
import Admin from "./Admin";
import Donate from "./Donate";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/display" element={<Display />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="*" element={<Navigate to="/donate" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
