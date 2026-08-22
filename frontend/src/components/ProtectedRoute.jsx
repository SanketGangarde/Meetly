import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";

const ProtectedRoute = ({ children }) => {

    // Pull user AND loading from context
    // loading = true  → /me check is still running (app just started)
    // loading = false → /me check is done, we know for sure if user is logged in
    const { user, loading } = useAuth();

    // While the session check is in progress, show nothing (or a spinner).
    // WITHOUT this guard: loading=true, user=null → wrongly redirects to /auth
    // even if the cookie is valid. We must wait.
    if (loading) {
        return null; // you can replace this with <LoadingSpinner /> later
    }

    // Session check is done. No user → redirect to login.
    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    // Session check is done. User exists → show the protected page.
    return children;
};

export default ProtectedRoute;

