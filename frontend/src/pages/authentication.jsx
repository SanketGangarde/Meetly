import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import '../auth.css';
import googleIcon from '../assets/google_icon.png';
import FacebookIcon from '../assets/facebook_icon.png';

export default function Authentication() {
    const { handleLogin, handleRegister, loading, error } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('login');
    const [showPassword, setShowPassword] = useState(false);

    // Login form state
    const [loginData, setLoginData] = useState({ email: '', password: '' });

    // Register form state
    const [registerData, setRegisterData] = useState({ name: '', username: '', email: '', password: '' });

    const onLogin = async (e) => {
        e.preventDefault();
        const result = await handleLogin(loginData.email, loginData.password);
        if (result.success) navigate('/');
    };

    const onRegister = async (e) => {
        e.preventDefault();
        const result = await handleRegister(registerData.name, registerData.username, registerData.email, registerData.password);
        if (result.success) navigate('/');
    };

    return (
        <div className="authPageContainer">

            {/* Background small burr yellow circles at authentication page */}
            <div className="blob blob1"></div>
            <div className="blob blob2"></div>


            <div className="authCard">

                {/* Logo */}
                <div className="authLogo" >
                    <h1>Meetly</h1>
                    <p>Stay close, no matter the miles.</p>
                </div>

                <div style={{ marginBottom: "10px", display: "flex", justifyContent: "center" }}>
                    <img 
                        src={googleIcon} 
                        alt="Google Login" 
                        onClick={() => {
                            const serverUrl = import.meta.env.VITE_SERVER_URL || "";
                            window.location.href = `${serverUrl}/api/v1/users/auth/google`;
                        }}
                        style={{ width: "30px", marginLeft: "10px", marginRight: "15px", borderRadius: "2px", cursor: "pointer", transition: "transform 0.2s" }} 
                        onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                        onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                    />
                    <img 
                        src={FacebookIcon} 
                        alt="Facebook Login" 
                        style={{ width: "30px", marginLeft: "10px", borderRadius: "2px", cursor: "pointer", transition: "transform 0.2s", opacity: 0.5 }} 
                        title="Coming Soon"
                    />
                </div>

                {/* Tabs */}
                <div className="authTabs">
                    <button
                        className={`authTab ${activeTab === 'login' ? 'authTab--active' : ''}`}
                        onClick={() => setActiveTab('login')}
                    >
                        Login
                    </button>
                    <button
                        className={`authTab ${activeTab === 'register' ? 'authTab--active' : ''}`}
                        onClick={() => setActiveTab('register')}
                    >
                        Register
                    </button>
                </div>

                {/* Login Form */}
                {activeTab === 'login' && (
                    <form className="authForm" onSubmit={onLogin}>
                        <div className="inputGroup">
                            <label htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                placeholder="you@example.com"
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="inputGroup">
                            <label htmlFor="login-password">Password</label>
                            <div className="passwordWrapper">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    className="togglePassword"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        <div className="authForgot">
                            <a href="#">Forgot password?</a>
                        </div>

                        {error && <p className="authError">{error}</p>}

                        <button type="submit" className="authSubmitBtn" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>

                        <p className="authSwitch">
                            Don't have an account?{' '}
                            <span onClick={() => setActiveTab('register')}>Register</span>
                        </p>
                    </form>
                )}

                {/* Register Form */}
                {activeTab === 'register' && (
                    <form className="authForm" onSubmit={onRegister}>
                        <div className="inputGroup">
                            <label htmlFor="reg-name">Full Name</label>
                            <input
                                id="reg-name"
                                type="text"
                                placeholder="John Doe"
                                value={registerData.name}
                                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="inputGroup">
                            <label htmlFor="reg-username">Username</label>
                            <input
                                id="reg-username"
                                type="text"
                                placeholder="johndoe123"
                                value={registerData.username}
                                onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                                required
                            />
                        </div>

                        <div className="inputGroup">
                            <label htmlFor="reg-email">Email</label>
                            <input
                                id="reg-email"
                                type="email"
                                placeholder="you@example.com"
                                value={registerData.email}
                                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="inputGroup">
                            <label htmlFor="reg-password">Password</label>
                            <div className="passwordWrapper">
                                <input
                                    id="reg-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Create a password"
                                    value={registerData.password}
                                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    className="togglePassword"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {error && <p className="authError">{error}</p>}

                        <button type="submit" className="authSubmitBtn" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>

                        <p className="authSwitch">
                            Already have an account?{' '}
                            <span onClick={() => setActiveTab('login')}>Login</span>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
