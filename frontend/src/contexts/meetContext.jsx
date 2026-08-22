import React, { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

// 1. Create the context
const MeetContext = createContext();

// 2. Custom hook — any component can call useMeet() to get the functions
export const useMeet = () => useContext(MeetContext);

// 3. Provider — wraps the app and provides meeting functions to all children
export const MeetProvider = ({ children }) => {

    // useNavigate lets us programmatically change the URL (like clicking a link)
    // e.g. navigate("/meet/abc123") → goes to that room
    const navigate = useNavigate();

    // ─────────────────────────────────────────
    // createMeeting
    // Called when user clicks "Create Meeting"
    // ─────────────────────────────────────────
    const createMeeting = () => {

        // Generate a 16-character unique room ID with special characters (e.g. a7K9-p2M4_x8V1~w5N3 or b3$K#9m1!w4Z*7p2)
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const specialChars = ["-", "_", "~", "$", "!", ".", "@", "#", "*", "+"];
        
        const randomBytes = new Uint32Array(16);
        crypto.getRandomValues(randomBytes);

        let result = "";
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) {
                // Insert a random special character every 4 characters
                result += specialChars[randomBytes[i] % specialChars.length];
            }
            result += chars[randomBytes[i] % chars.length];
        }

        navigate(`/meet/${encodeURIComponent(result)}`);
    };

    // ─────────────────────────────────────────
    // joinMeeting
    // Called when user clicks "Join Meeting"
    // Takes the code the user typed in the input
    // ─────────────────────────────────────────
    const joinMeeting = (code) => {

        let trimmedCode = code ? String(code).trim() : "";

        if (!trimmedCode) {
            alert("Please enter a meeting code or link.");
            return;
        }

        try {
            trimmedCode = decodeURIComponent(trimmedCode);
        } catch (e) {
            // ignore malformed URI
        }

        // If user pasted a full URL (e.g. "http://localhost:5173/meet/a7K9-p2M4_x8V1~w5N3")
        // extract just the room code ("a7K9-p2M4_x8V1~w5N3")
        if (trimmedCode.includes("/meet/")) {
            trimmedCode = trimmedCode.split("/meet/").pop();
        } else if (trimmedCode.includes("/")) {
            trimmedCode = trimmedCode.split("/").pop();
        }

        // Strip query params and trailing slashes
        trimmedCode = trimmedCode.split("?")[0].replace(/\/$/, "");

        if (!trimmedCode) {
            alert("Invalid meeting code or link.");
            return;
        }

        // Host and Guest navigate to the exact same room ID
        navigate(`/meet/${encodeURIComponent(trimmedCode)}`);
    };

    return (
        <MeetContext.Provider value={{ createMeeting, joinMeeting }}>
            {children}
        </MeetContext.Provider>
    );
};

export default MeetContext;
