import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "../pages/Login/Login";
import Home from "../pages/Home/Home";
import PageTest from "../pages/teste/PageTest";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
         <Route path="/" element={<Login />} />
         <Route path="/teste" element={<PageTest />}/>
         <Route path="/home" element={
          <ProtectedRoute>
          <Home />
          </ProtectedRoute>
          } />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes