import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import phoneCallImg from '../assets/phoneCall.png';
import hamburgerIcon from '../assets/hamburgerMenue.png';
import { useAuth } from '../contexts/authContext';

export default function Landing() {
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();
    const { user, handleLogout } = useAuth();


    return (
        <div className='landingPageContainer'>

            <nav>

                <div className='navHeader'>
                    <h2>Meetly</h2>
                </div>

                {/* Desktop nav links - hidden on mobile via CSS */}
                <div className="navList">
                    {!user ? (
                        <>
                            <div role='button' onClick={() => navigate("/auth")}>Register</div>
                            <div role='button' onClick={() => navigate("/auth")} className='orange-btn'>Login</div>
                        </>
                    ) : (
                        <div role='button' onClick={handleLogout} className='orange-btn' style={{ background: '#dc3545' }}>Sign Out</div>
                    )}
                </div>

                {/* Hamburger button - visible only on mobile via CSS */}
                <button className='hamburger' onClick={() => setMenuOpen(!menuOpen)}>
                    <img src={hamburgerIcon} alt="menu" />
                </button>
            </nav>

            {/* Mobile dropdown - shown below nav when menuOpen is true */}
            {menuOpen && (
                <div className='mobileMenu'>
                    {!user ? (
                        <>
                            <div role='button' onClick={() => navigate('/auth')}>Register</div>
                            <div className='orange-btn' role='button' onClick={() => navigate('/auth')}>Login</div>
                        </>
                    ) : (
                        <div className='orange-btn' role='button' onClick={handleLogout} style={{ background: '#dc3545' }}>Sign Out</div>
                    )}
                </div>
            )}

            <div className='landingBodyContainer'>
                <div className='leftSection'>
                    <p><span style={{ color: "#F7931E" }}>Stay Close</span> No Matter the Miles</p>
                    <p>— with Meetly.</p>
                    <span id='subtitle'>Enjoy secure, crystal-clear video calls with the people who matter most.</span>

                    <div className='orange-btn' role='button' onClick={() => navigate(user ? '/dashboard' : '/auth')} style={{ marginTop: "3rem" }}>
                        {user ? "Go to Dashboard" : "Get Started"}
                    </div>
                </div>

                <div className='rightSection'>
                    <img src={phoneCallImg} alt="phoneCall" />
                </div>
            </div>
        </div>
    );
}