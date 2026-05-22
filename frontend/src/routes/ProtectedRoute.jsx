import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const ProtectedRoute = ({children}) => {
    const navigate = useNavigate();

    useEffect(() =>{
        const isAuthenticated = !!localStorage.getItem("token");

        if (!isAuthenticated) {
            console.log("Usuário não autenticado.")

            return navigate("/")
        }

    }, []);


    return children
}

export default ProtectedRoute