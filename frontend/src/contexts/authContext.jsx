import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


// Single source of truth for the backend URL.
// Change this one line if the port ever changes — not 3 separate fetch calls.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

// 1. Create the context
const AuthContext = createContext();

// 2. Custom hook for easy access
export const useAuth = () => useContext(AuthContext);

// 3. Provider with handlers
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();


    // Called ONCE when the app first loads.
    // Hits /me on the backend, which reads the httpOnly cookie.
    // If the cookie is valid → restore user state (no login needed after refresh).
    // If not → user stays null (not logged in).
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/api/v1/users/me`, {
                    credentials: 'include',  // MUST include so browser sends the cookie
                });

                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);  // restore user state from server
                } else if (res.status !== 401) {
                    const data = await res.json().catch(() => ({}));
                    console.warn("Session check response:", res.status, data.message);
                }
            } catch (err) {
                console.error("Session check network error:", err.message);
            } finally {
                setLoading(false);  // done checking — ProtectedRoute can now make decisions
            }
        };

        checkSession();
    }, []);  // [] = run only once on mount, never again

    // Login handler — calls your backend API
    const handleLogin = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${SERVER_URL}/api/v1/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',   // browser sends & receives cookies
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Login failed');
            }

            setUser(data.user);

            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, message: err.message };
        } finally {
            setLoading(false);
        }
    };

    // Register handler — calls your backend API
    const handleRegister = async (name, username, email, password) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${SERVER_URL}/api/v1/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, email, password }),
                credentials: 'include',   // browser sends & receives cookies
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            setUser(data.user);
            // No localStorage.setItem — token is in httpOnly cookie now
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, message: err.message };
        } finally {
            setLoading(false);
        }
    };

    // Logout handler — calls the backend to clear cookie + DB token
    const handleLogout = async () => {
        try {
            await fetch(`${SERVER_URL}/api/v1/users/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            console.warn('Logout request failed:', err.message);
        } finally {
            setUser(null);
            navigate('/auth');   // redirect to login page
        }
    };


    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            handleLogin,
            handleRegister,
            handleLogout,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
