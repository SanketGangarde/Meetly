
import React, { useState, useEffect, useRef } from "react"

import "../styles/VideoMeetComponent.css";
import { io } from "socket.io-client";
import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
import * as fp from "fingerpose";
const server_url = import.meta.env.VITE_SERVER_URL || "";

var connections = {};
var iceCandidatesQueue = {};

const peerConfiguration = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

// ─────────────────────────────────────────
// RemoteVideo Component
// ─────────────────────────────────────────
const RemoteVideo = ({ stream, username, isMuted, isCameraOff, isScreenSharing, reaction }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={`remote-video-wrapper ${isScreenSharing ? "is-sharing" : ""}`}>
            <video ref={videoRef} autoPlay playsInline className="remote-video" />
            {isCameraOff && (
                <div className="camera-off-overlay">
                    <span className="avatar-initials">{username?.charAt(0)?.toUpperCase() || "P"}</span>
                </div>
            )}
            <div className="remote-name-bar">
                <span className="remote-username">{username || "Participant"}</span>
                {isMuted && <span className="muted-icon">🔇</span>}
            </div>
            {reaction && (
                <div className="reaction-emoji-float">{reaction}</div>
            )}
        </div>
    );
};

export const VideoMeetComponent = () => {

    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoRef = useRef();
    let chatEndRef = useRef();         // auto-scroll chat to bottom
    let screenStreamRef = useRef();    // holds the screen capture MediaStream

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState(false);
    let [audio, setAudio] = useState(false);
    let [screen, setScreen] = useState(false);
    let [screenShareAvailable, setScreenShareAvailable] = useState(false);

    // Chat
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [chatOpen, setChatOpen] = useState(false);
    let [unreadCount, setUnreadCount] = useState(0);

    let [roomState, setRoomState] = useState("lobby"); // "lobby" | "waiting" | "joined" | "denied"
    let [deniedReason, setDeniedReason] = useState("");
    let [username, setUsername] = useState("");
    let [isHost, setIsHost] = useState(false);
    let [knockers, setKnockers] = useState([]); // [{ socketId, username }]

    // Gestures state
    let [localReaction, setLocalReaction] = useState(null);
    let gestureCooldown = useRef(false);
    let requestRef = useRef();

    // Remote participants state — includes muted/cameraOff flags
    let [videos, setVideos] = useState([]);

    // Meeting timer
    let [elapsed, setElapsed] = useState(0);
    let timerRef = useRef(null);
    let joinTimeRef = useRef(null);

    // Copy invite link feedback
    let [copied, setCopied] = useState(false);

    const copyInviteLink = () => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                prompt("Copy this link:", window.location.href);
            });
    };

    // ─────────────────────────────────────────
    // Step 1: get camera/mic permission on mount
    // ─────────────────────────────────────────
    useEffect(() => {
        getPermissions();
    }, []);

    const getPermissions = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setVideoAvailable(false);
            setAudioAvailable(false);
            return;
        }

        try {
            const userMediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            window.localStream = userMediaStream;
            setVideoAvailable(true);
            setAudioAvailable(true);
            if (navigator.mediaDevices.getDisplayMedia) setScreenShareAvailable(true);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = userMediaStream;
            }
        } catch (error) {
            console.warn("Combined media permission failed, attempting individual access:", error.message);
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setVideoAvailable(true);
                window.localStream = videoStream;
                if (localVideoRef.current) localVideoRef.current.srcObject = videoStream;
            } catch (e) {
                setVideoAvailable(false);
            }
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setAudioAvailable(true);
                if (!window.localStream) window.localStream = audioStream;
            } catch (e) {
                setAudioAvailable(false);
            }
            if (navigator.mediaDevices.getDisplayMedia) setScreenShareAvailable(true);
        }
    };

    // ─────────────────────────────────────────
    // Track Toggling
    // ─────────────────────────────────────────
    useEffect(() => {
        if (window.localStream) {
            const videoTrack = window.localStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = video;

            const audioTrack = window.localStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = audio;

            if (socketRef.current) {
                socketRef.current.emit("toggle-mic", { muted: !audio });
                socketRef.current.emit("toggle-camera", { cameraOff: !video });
            }
        }
    }, [video, audio]);

    // ─────────────────────────────────────────
    // Re-attach stream after room transitions
    // ─────────────────────────────────────────
    useEffect(() => {
        if (roomState !== "lobby" && localVideoRef.current && window.localStream) {
            localVideoRef.current.srcObject = window.localStream;
            
            if (roomState === "joined") {
                startGestureDetection();
            }
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
    }, [roomState]);

    // ─────────────────────────────────────────
    // ML Gesture Detection
    // ─────────────────────────────────────────
    const startGestureDetection = async () => {
        try {
            if (!handpose || !fp) return;
            console.log("Loading Handpose model...");
            const net = await handpose.load();
            console.log("Handpose model loaded.");

            const gestures = [];
            if (fp.Gestures?.ThumbsUpGesture) gestures.push(fp.Gestures.ThumbsUpGesture);
            if (fp.Gestures?.VictoryGesture) gestures.push(fp.Gestures.VictoryGesture);
            if (gestures.length === 0) return;

            const GE = new fp.GestureEstimator(gestures);

            const detect = async () => {
                try {
                    if (localVideoRef.current && localVideoRef.current.readyState >= 2) {
                        const video = localVideoRef.current;
                        const hand = await net.estimateHands(video);

                        if (hand.length > 0 && !gestureCooldown.current) {
                            const estimatedGestures = GE.estimate(hand[0].landmarks, 7.5);

                            if (estimatedGestures.gestures.length > 0) {
                                const result = estimatedGestures.gestures.reduce((p, c) => (p.confidence > c.confidence ? p : c));
                                
                                let emoji = "";
                                if (result.name === "thumbs_up") emoji = "👍";
                                if (result.name === "victory") emoji = "✌️";

                                if (emoji) {
                                    triggerReaction(emoji, true);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Gesture Detection loop error:", err);
                }
                
                requestRef.current = requestAnimationFrame(detect);
            };

            detect();
        } catch (error) {
            console.error("ML Error:", error);
        }
    };

    const triggerReaction = (emoji, isLocal) => {
        // Show locally
        if (isLocal) {
            setLocalReaction(emoji);
            if (socketRef.current) {
                socketRef.current.emit("gesture-reaction", { emoji });
            }
        }

        // Cooldown to prevent spam
        gestureCooldown.current = true;
        setTimeout(() => {
            if (isLocal) setLocalReaction(null);
            gestureCooldown.current = false;
        }, 3000); // 3 seconds cooldown
    };

    // ─────────────────────────────────────────
    // Auto-scroll chat to bottom
    // ─────────────────────────────────────────
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
        // If chat is closed, increment unread counter
        if (!chatOpen && messages.length > 0) {
            // We don't count on initial load
        }
    }, [messages]);

    // ─────────────────────────────────────────
    // Join handler
    // ─────────────────────────────────────────
    const handleConnect = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        setRoomState("waiting");
        connectToSocketServer();
    };

    // ─────────────────────────────────────────
    // Leave meeting — save to history
    // ─────────────────────────────────────────
    const handleLeave = async () => {
        // Stop timer
        if (timerRef.current) clearInterval(timerRef.current);

        const roomId = window.location.pathname.split('/').pop();
        const durationSecs = elapsed;
        const participantCount = videos.length + 1; // remotes + me

        // Save meeting history to backend (fire-and-forget)
        try {
            await fetch(`${server_url}/api/v1/users/meeting-history`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    roomId,
                    duration: `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`,
                    participants: participantCount,
                    date: new Date().toISOString()
                })
            });
        } catch (e) {
            console.warn("Could not save meeting history:", e.message);
        }

        // Clean up peer connections
        Object.values(connections).forEach(conn => conn.close());
        connections = {};

        // Stop local stream tracks
        if (window.localStream) {
            window.localStream.getTracks().forEach(t => t.stop());
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
        }

        if (socketRef.current) socketRef.current.disconnect();

        window.location.href = "/";
    };

    // ─────────────────────────────────────────
    // Screen Share toggle
    // ─────────────────────────────────────────
    const handleScreenShare = async () => {
        if (!screen) {
            // START screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                // Replace camera track with screen track in all peer connections
                Object.values(connections).forEach(conn => {
                    const sender = conn.getSenders().find(s => s.track?.kind === "video");
                    if (sender) sender.replaceTrack(screenTrack);
                });

                // Show screen in local preview
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screenStream;
                }

                // When user clicks browser's "Stop sharing"
                screenTrack.onended = () => {
                    stopScreenShare();
                };

                setScreen(true);
                if (socketRef.current) {
                    socketRef.current.emit("screen-share", { sharing: true });
                }
            } catch (e) {
                console.log("Screen share cancelled or failed:", e.message);
            }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }

        // Restore camera track in all peer connections
        if (window.localStream) {
            const cameraTrack = window.localStream.getVideoTracks()[0];
            Object.values(connections).forEach(conn => {
                const sender = conn.getSenders().find(s => s.track?.kind === "video");
                if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
            });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = window.localStream;
            }
        }

        setScreen(false);
        if (socketRef.current) {
            socketRef.current.emit("screen-share", { sharing: false });
        }
    };

    // ─────────────────────────────────────────
    // Send chat message
    // ─────────────────────────────────────────
    const sendMessage = () => {
        if (!message.trim() || !socketRef.current) return;

        // Add MY message locally (sender sees it immediately)
        const myMsg = { sender: username || "You", message: message.trim(), self: true };
        setMessages(prev => [...prev, myMsg]);

        socketRef.current.emit("chat-message", { message: message.trim() });
        setMessage("");
    };

    const handleChatKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const toggleChat = () => {
        setChatOpen(prev => !prev);
        if (!chatOpen) setUnreadCount(0); // clear badge when opening
    };

    // ─────────────────────────────────────────
    // Format elapsed timer
    // ─────────────────────────────────────────
    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    // ─────────────────────────────────────────
    // Host admits/denies user
    // ─────────────────────────────────────────
    const handleKnock = (targetId, accepted) => {
        if (socketRef.current) {
            socketRef.current.emit("admit-user", { targetId, accepted });
        }
        setKnockers(prev => prev.filter(k => k.socketId !== targetId));
    };

    // ─────────────────────────────────────────
    // Socket + WebRTC
    // ─────────────────────────────────────────
    const connectToSocketServer = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        socketRef.current = io(server_url, { secure: false });

        socketRef.current.on('connect', () => {
            console.log("Connected:", socketRef.current.id);
            socketIdRef.current = socketRef.current.id;

            const roomId = window.location.pathname.split('/').pop();
            socketRef.current.emit('join-call', {
                roomId,
                username: username || "Guest"
            });
        });

        // We were admitted into the room (or we are the first and thus the host)
        socketRef.current.on("join-accepted", ({ isHost: hostStatus }) => {
            setIsHost(hostStatus);
            setRoomState("joined");
            
            // Start meeting timer now that we actually joined
            if (!timerRef.current) {
                joinTimeRef.current = new Date();
                timerRef.current = setInterval(() => {
                    setElapsed(prev => prev + 1);
                }, 1000);
            }
        });

        // We were denied entry by the host or room is full
        socketRef.current.on("join-denied", (data) => {
            setDeniedReason(data?.reason || "The host did not allow you to join the meeting.");
            setRoomState("denied");
            if (socketRef.current) socketRef.current.disconnect();
        });

        // Someone is knocking
        socketRef.current.on("ask-to-join", ({ socketId, username: knockerName }) => {
            setKnockers(prev => {
                const exists = prev.some(k => k.socketId === socketId);
                if (exists) return prev;
                return [...prev, { socketId, username: knockerName }];
            });
        });

        // Knocker was handled or left
        socketRef.current.on("knocker-handled", ({ targetId }) => {
            setKnockers(prev => prev.filter(k => k.socketId !== targetId));
        });

        // Host left, we were promoted
        socketRef.current.on("you-are-host", () => {
            setIsHost(true);
        });

        // Receive old messages when joining
        socketRef.current.on("chat-history", (history) => {
            setMessages(history.map(m => ({ ...m, self: false })));
        });

        // New message from another participant
        socketRef.current.on("chat-message", (msg) => {
            setMessages(prev => [...prev, { ...msg, self: false }]);
            setChatOpen(prev => {
                if (!prev) setUnreadCount(c => c + 1);
                return prev;
            });
        });

        // Remote user toggled their mic
        socketRef.current.on("toggle-mic", ({ socketId, muted }) => {
            setVideos(prev => prev.map(v =>
                v.socketId === socketId ? { ...v, isMuted: muted } : v
            ));
        });

        // Remote user toggled their camera
        socketRef.current.on("toggle-camera", ({ socketId, cameraOff }) => {
            setVideos(prev => prev.map(v =>
                v.socketId === socketId ? { ...v, isCameraOff: cameraOff } : v
            ));
        });

        // Remote user started/stopped screen sharing
        socketRef.current.on("screen-share", ({ socketId, sharing }) => {
            setVideos(prev => prev.map(v =>
                v.socketId === socketId ? { ...v, isScreenSharing: sharing } : v
            ));
        });

        // Remote user sent a gesture reaction
        socketRef.current.on("gesture-reaction", ({ socketId, emoji }) => {
            setVideos(prev => prev.map(v => 
                v.socketId === socketId ? { ...v, reaction: emoji } : v
            ));
            
            // clear it after 3s
            setTimeout(() => {
                setVideos(prev => prev.map(v => 
                    v.socketId === socketId ? { ...v, reaction: null } : v
                ));
            }, 3000);
        });

        // Someone new joined → we send them an offer
        socketRef.current.on("user-joined", async ({ socketId, username: newUsername }) => {
            console.log(`User joined: ${newUsername} (${socketId})`);
            const connection = createPeerConnection(socketId, newUsername);
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            socketRef.current.emit("offer", { targetId: socketId, offer });
        });

        // We received an offer → send answer
        socketRef.current.on("offer", async ({ from, offer }) => {
            const connection = createPeerConnection(from, "Participant");
            await connection.setRemoteDescription(new RTCSessionDescription(offer));

            if (iceCandidatesQueue[from]) {
                iceCandidatesQueue[from].forEach(async (c) => {
                    await connection.addIceCandidate(new RTCIceCandidate(c));
                });
                delete iceCandidatesQueue[from];
            }

            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            socketRef.current.emit("answer", { targetId: from, answer });
        });

        // We received an answer
        socketRef.current.on("answer", async ({ from, answer }) => {
            const connection = connections[from];
            if (connection) {
                await connection.setRemoteDescription(new RTCSessionDescription(answer));
                if (iceCandidatesQueue[from]) {
                    iceCandidatesQueue[from].forEach(async (c) => {
                        await connection.addIceCandidate(new RTCIceCandidate(c));
                    });
                    delete iceCandidatesQueue[from];
                }
            }
        });

        // ICE candidate
        socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
            const connection = connections[from];
            if (connection && connection.remoteDescription) {
                try {
                    await connection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error("ICE error", e);
                }
            } else {
                if (!iceCandidatesQueue[from]) iceCandidatesQueue[from] = [];
                iceCandidatesQueue[from].push(candidate);
            }
        });

        // User left
        socketRef.current.on("user-left", ({ socketId }) => {
            if (connections[socketId]) {
                connections[socketId].close();
                delete connections[socketId];
            }
            setVideos(prev => prev.filter(v => v.socketId !== socketId));
        });

        socketRef.current.on('disconnect', () => {
            console.log("Disconnected from socket server");
        });
    };

    const createPeerConnection = (socketId, peerUsername) => {
        let connection = new RTCPeerConnection(peerConfiguration);

        if (window.localStream) {
            window.localStream.getTracks().forEach((track) => {
                connection.addTrack(track, window.localStream);
            });
        }

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit("ice-candidate", {
                    targetId: socketId,
                    candidate: event.candidate
                });
            }
        };

        connection.ontrack = (event) => {
            setVideos(prev => {
                const exists = prev.find(v => v.socketId === socketId);
                if (exists) return prev;
                return [
                    ...prev,
                    {
                        socketId,
                        stream: event.streams[0],
                        username: peerUsername,
                        isMuted: false,
                        isCameraOff: false,
                        isScreenSharing: false
                    }
                ];
            });
        };

        connections[socketId] = connection;
        return connection;
    };

    // ─────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────
    return (
        <div>
            {roomState === "lobby" && (
                <div className="lobby-page">
                    <div className="lobby-container">
                        <h2>Enter into Lobby</h2>
                        <video ref={localVideoRef} autoPlay muted style={{ width: "300px", height: "225px", backgroundColor: "black", borderRadius: "12px" }} />
                        <input
                            className="lobby-input"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
                            placeholder="Enter your name"
                        />
                        <button className="lobby-join-btn" onClick={handleConnect}>Ask to Join</button>
                    </div>
                </div>
            )}

            {roomState === "waiting" && (
                <div className="lobby-page">
                    <div className="lobby-container" style={{ textAlign: "center" }}>
                        <h2>Waiting Room</h2>
                        <video ref={localVideoRef} autoPlay muted style={{ width: "300px", height: "225px", backgroundColor: "black", borderRadius: "12px", marginBottom: "16px", transform: "scaleX(-1)" }} />
                        <p style={{ color: "#aaaabd" }}>Asking the host to let you in...</p>
                        <div className="waiting-spinner" style={{ margin: "12px auto" }} />
                    </div>
                </div>
            )}

            {roomState === "denied" && (
                <div className="lobby-page">
                    <div className="lobby-container" style={{ textAlign: "center" }}>
                        <h2 style={{ color: "#ff6b6b" }}>Entry Denied</h2>
                        <p style={{ color: "#aaaabd", margin: "16px 0 24px" }}>{deniedReason || "The host did not allow you to join the meeting."}</p>
                        <button className="lobby-join-btn" onClick={() => window.location.href = "/"}>Return Home</button>
                    </div>
                </div>
            )}

            {roomState === "joined" && (
                <div className="meet-room">

                    {/* Knocking toasts for active meeting room participants */}
                    {knockers.length > 0 && (
                        <div className="knocking-container">
                            {knockers.map(k => (
                                <div key={k.socketId} className="knocking-toast">
                                    <span><strong>{k.username}</strong> wants to join</span>
                                    <div className="knocking-actions">
                                        <button className="btn-admit" onClick={() => handleKnock(k.socketId, true)}>Admit</button>
                                        <button className="btn-deny" onClick={() => handleKnock(k.socketId, false)}>Deny</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Top bar — room info + timer */}
                    <div className="meet-topbar">
                        <span className="meet-room-id">
                            🔒 {decodeURIComponent(window.location.pathname.split('/').pop())}
                        </span>
                        <span className="meet-timer">{formatTime(elapsed)}</span>
                        <div className="topbar-right">
                            <span className="meet-participants-count">
                                👥 {videos.length + 1}
                            </span>
                            <button
                                className={`copy-link-btn ${copied ? "copied" : ""}`}
                                onClick={copyInviteLink}
                                title="Copy invite link"
                            >
                                {copied ? "✅ Copied!" : "🔗 Copy Link"}
                            </button>
                        </div>
                    </div>


                    {/* Main area: video grid + chat sidebar */}
                    <div className="meet-main">

                        {/* Video grid */}
                        <div className={`videos-grid ${chatOpen ? "with-chat" : ""} ${
                            videos.length + 1 === 1 ? "grid-layout-1" :
                            videos.length + 1 === 2 ? "grid-layout-2" :
                            videos.length + 1 === 3 ? "grid-layout-3" : "grid-layout-4"
                        }`}>
                            
                            {/* Local Video Card */}
                            <div className={`remote-video-wrapper ${screen ? "is-sharing" : ""}`}>
                                <video ref={localVideoRef} autoPlay playsInline muted className="remote-video" style={{ transform: screen ? "none" : "scaleX(-1)" }} />
                                {video === false && (
                                    <div className="camera-off-overlay">
                                        <span className="avatar-initials">{username?.charAt(0)?.toUpperCase() || "Y"}</span>
                                    </div>
                                )}
                                <div className="remote-name-bar">
                                    <span className="remote-username">You {screen ? "(Presentation)" : ""}</span>
                                    {!audio && <span className="muted-icon">🔇</span>}
                                </div>
                                {localReaction && (
                                    <div className="reaction-emoji-float">{localReaction}</div>
                                )}
                            </div>

                            {videos.map((v) => (
                                <RemoteVideo
                                    key={v.socketId}
                                    stream={v.stream}
                                    username={v.username}
                                    isMuted={v.isMuted}
                                    isCameraOff={v.isCameraOff}
                                    isScreenSharing={v.isScreenSharing}
                                    reaction={v.reaction}
                                />
                            ))}
                        </div>

                        {/* Chat sidebar */}
                        {chatOpen && (
                            <div className="chat-sidebar">
                                <div className="chat-header">
                                    <span>💬 Chat</span>
                                    <button className="chat-close-btn" onClick={toggleChat}>✕</button>
                                </div>

                                <div className="chat-messages">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`chat-msg ${msg.self ? "self" : "other"}`}>
                                            {!msg.self && <span className="chat-sender">{msg.sender}</span>}
                                            <div className="chat-bubble">{msg.message}</div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="chat-input-row">
                                    <input
                                        className="chat-input"
                                        type="text"
                                        placeholder="Type a message…"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={handleChatKey}
                                    />
                                    <button className="chat-send-btn" onClick={sendMessage}>➤</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Control bar */}
                    <div className="controls-bar">

                        {/* Mic */}
                        <button
                            className={`ctrl-btn ${audio ? "active" : "muted"}`}
                            onClick={() => setAudio(a => !a)}
                            title={audio ? "Mute mic" : "Unmute mic"}
                        >
                            {audio ? "🎙️" : "🔇"}
                            <span className="ctrl-label">{audio ? "Mute" : "Unmute"}</span>
                        </button>

                        {/* Camera */}
                        <button
                            className={`ctrl-btn ${video ? "active" : "muted"}`}
                            onClick={() => setVideo(v => !v)}
                            title={video ? "Turn off camera" : "Turn on camera"}
                        >
                            {video ? "📷" : "🚫"}
                            <span className="ctrl-label">{video ? "Cam On" : "Cam Off"}</span>
                        </button>

                        {/* Screen share */}
                        {screenShareAvailable && (
                            <button
                                className={`ctrl-btn ${screen ? "screen-active" : ""}`}
                                onClick={handleScreenShare}
                                title={screen ? "Stop sharing" : "Share screen"}
                            >
                                🖥️
                                <span className="ctrl-label">{screen ? "Stop Share" : "Share"}</span>
                            </button>
                        )}

                        {/* Chat — with unread badge */}
                        <button
                            className={`ctrl-btn ${chatOpen ? "active" : ""}`}
                            onClick={toggleChat}
                            title="Toggle chat"
                            style={{ position: "relative" }}
                        >
                            💬
                            {unreadCount > 0 && !chatOpen && (
                                <span className="unread-badge">{unreadCount}</span>
                            )}
                            <span className="ctrl-label">Chat</span>
                        </button>

                        {/* Leave */}
                        <button className="ctrl-btn leave-btn" onClick={handleLeave}>
                            📴
                            <span className="ctrl-label">Leave</span>
                        </button>

                    </div>

                </div>
            )}
        </div>
    )
}