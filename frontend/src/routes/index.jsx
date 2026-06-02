import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "../pages/Login/Login";
import Home from "../pages/Home/Home";
import PageTest from "../pages/teste/PageTest";
import ProtectedRoute from "./ProtectedRoute";
import { Account } from '../pages/AuthNeon/account';
import { Auth } from '../pages/AuthNeon/auth';
import { HomeNeon } from "../pages/AuthNeon/homeNeon";

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
          <Route path="/neon" element={<HomeNeon/>} />
          <Route path="/auth/:pathname" element={<Auth/>} />
          <Route path="/account/:pathname" element={<Account />} />          
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes