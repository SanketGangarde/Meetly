
import React, { useState, useEffect } from "react";
import "../styles/Dashboard.css";
import { useAuth } from "../contexts/authContext";
import { useMeet } from "../contexts/meetContext.jsx";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

const Dashboard = () => {

    const { user, handleLogout } = useAuth();

    const { createMeeting, joinMeeting } = useMeet();

    const [joinCode, setJoinCode] = useState("");
    const [meetings, setMeetings] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Fetch meeting history when dashboard mounts
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/api/v1/users/meeting-history`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    setMeetings(data.meetings || []);
                }
            } catch (e) {
                console.warn("Could not load meeting history:", e.message);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, []);

    // Format ISO date → "27 Jul 2026, 09:30 AM"
    const formatDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    };

    return (
        <div className="dashboard">

            {/* Welcome Section */}
            <div className="welcome-section">
                <div className="welcome-text">
                    <h1>👋 Welcome, {user?.name}</h1>
                    <p>Start a new meeting or join an existing one.</p>
                </div>
                <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
            </div>


            {/* Meeting Actions */}
            <div className="meeting-actions">

                <div className="new-meetCard">
                    <h2>📹 New Meeting</h2>
                    <p>Generate a new meeting room and invite others.</p>
                    <button onClick={createMeeting}>Create Meeting</button>
                </div>

                <div className="join-meetCard">
                    <h2>🔗 Join Meeting</h2>
                    <input
                        type="text"
                        placeholder="Enter Meeting Code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") joinMeeting(joinCode); }}
                    />
                    <button onClick={() => joinMeeting(joinCode)}>Join Meeting</button>
                </div>

            </div>

            {/* Recent Meetings */}
            <div className="recent-meetings">
                <h2>📋 Recent Meetings</h2>

                {loadingHistory ? (
                    <div className="empty-state"><p>Loading…</p></div>
                ) : meetings.length === 0 ? (
                    <div className="empty-state"><p>No recent meetings yet.</p></div>
                ) : (
                    <div className="meetings-list">
                        {meetings.map((m, i) => (
                            <div key={m._id || i} className="meeting-row">
                                <div className="meeting-code">
                                    <span className="code-icon">🔑</span>
                                    <span className="code-text">{m.meetingCode}</span>
                                </div>
                                <div className="meeting-meta">
                                    <span>🗓 {formatDate(m.date)}</span>
                                    <span>⏱ {m.duration || "—"}</span>
                                    <span>👥 {m.participants || 1} participant{m.participants !== 1 ? "s" : ""}</span>
                                </div>
                                {m.meetingCode && (
                                    <button
                                        style={{
                                            padding: "6px 12px",
                                            background: "rgba(255, 255, 255, 0.08)",
                                            border: "1px solid rgba(255, 255, 255, 0.15)",
                                            borderRadius: "8px",
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: "0.8rem"
                                        }}
                                        onClick={() => joinMeeting(m.meetingCode)}
                                    >
                                        Rejoin
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};

export default Dashboard;