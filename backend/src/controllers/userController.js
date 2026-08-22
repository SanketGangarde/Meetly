import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const register = async (req, res) => {
    const { name, username, email, password } = req.body;

    try {
        if (!name || !username || !email || !password) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "All fields are required" });
        }

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({
                message: existingUser.username === username
                    ? "Username already exists"
                    : "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let token = crypto.randomBytes(20).toString("hex");

        const user = await User.create({
            name,
            username,
            email,
            password: hashedPassword,
            token
        });

        const isProduction = process.env.NODE_ENV === "production";
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(httpStatus.CREATED).json({
            message: "User registered successfully",
            user: { name: user.name, email: user.email, username: user.username }
        });

    } catch (err) {
        console.error(err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message || "Error in registration of user" });
    }
}

export const login = async (req, res, next) => {
    const { email, password } = req.body;
    try {

        if (!email || !password) {
            res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide email or password" })
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }


        const matchedPassword = await bcrypt.compare(password, user.password);

        if (matchedPassword) {
            let token = crypto.randomBytes(20).toString("hex");
            user.token = token;
            await user.save();

            const isProduction = process.env.NODE_ENV === "production";

            res.cookie('token', token, {
                httpOnly: true,                      // JS cannot read this cookie
                secure: isProduction,                // true in production (HTTPS), false in dev
                sameSite: isProduction ? 'none' : 'lax', // cross-domain friendly in prod
                maxAge: 7 * 24 * 60 * 60 * 1000     // 7 days in ms
            });

            return res.status(httpStatus.OK).json({
                message: "Login successful",
                user: { name: user.name, email: user.email, username: user.username }
            });
        }



    } catch (error) {

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Error in login", error: error.message });
    }
};

// GET /me — reads the cookie and returns the logged-in user
// Called on every page load/refresh to restore auth state
export const getMe = async (req, res) => {
    try {
        // Step 1: Read the 'token' value from the browser's cookie
        // req.cookies is populated by the cookie-parser middleware in server.js
        const token = req.cookies?.token;

        // Step 2: If no cookie → user is not logged in → send 401 Unauthorized
        if (!token) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        // Step 3: Look up the user in DB whose token matches the cookie value
        // The token was stored on the user document when they logged in
        const user = await User.findOne({ token });

        // Step 4: If no match → token is invalid/expired → send 401
        if (!user) {
            return res.status(401).json({ message: "Invalid or expired session" });
        }

        // Step 5: Token is valid → return the user's safe info (never send password!)
        return res.status(200).json({
            user: { name: user.name, email: user.email, username: user.username }
        });

    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// POST /logout — clears the token from DB + expires the cookie
export const logout = async (req, res) => {
    try {
        const token = req.cookies?.token;
        if (token) {
            // Remove token from DB so old cookies can't be reused
            await User.findOneAndUpdate({ token }, { token: null });
        }
        const isProduction = process.env.NODE_ENV === "production";

        // Clear the cookie
        res.clearCookie("token", { 
            httpOnly: true, 
            secure: isProduction,
            sameSite: isProduction ? "strict" : "lax" 
        });
        return res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};
// GET /auth/google/callback — handles successful Google OAuth login
export const googleAuthCallback = async (req, res) => {
    try {
        // req.user is provided by passport upon successful authentication
        if (!req.user) {
            const clientUrl = process.env.CLIENT_URL || "";
            return res.redirect(`${clientUrl}/auth?error=auth_failed`);
        }

        const user = req.user;
        let token = crypto.randomBytes(20).toString("hex");
        user.token = token;
        await user.save();

        const isProduction = process.env.NODE_ENV === "production";
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

        // Set httpOnly cookie for session
        res.cookie("token", token, { 
            httpOnly: true, 
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax" 
        });

        // Redirect to frontend dashboard
        return res.redirect(`${clientUrl}/dashboard`);
    } catch (error) {
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        return res.redirect(`${clientUrl}/auth?error=server_error`);
    }
};


// POST /meeting-history — saves a completed meeting to the DB
export const addMeetingHistory = async (req, res) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await User.findOne({ token });
        if (!user) {
            return res.status(401).json({ message: "Invalid or expired session" });
        }

        const { roomId, duration, participants, date } = req.body;

        if (!roomId) {
            return res.status(400).json({ message: "roomId is required" });
        }

        const meeting = await Meeting.create({
            user_id: user._id.toString(),
            meetingCode: roomId,
            password: "-",               // no password feature yet
            date: date ? new Date(date) : new Date(),
            duration: duration || "0m 0s",
            participants: participants || 1,
            hostName: user.name
        });

        return res.status(201).json({ message: "Meeting history saved", meeting });

    } catch (error) {
        // If meetingCode already exists (unique constraint) just ignore — it's a duplicate save
        if (error.code === 11000) {
            return res.status(200).json({ message: "Meeting already recorded" });
        }
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /meeting-history — returns the last 10 meetings for the logged-in user
export const getMeetingHistory = async (req, res) => {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ message: "Not authenticated" });

        const user = await User.findOne({ token });
        if (!user) return res.status(401).json({ message: "Invalid or expired session" });

        const meetings = await Meeting.find({ user_id: user._id.toString() })
            .sort({ date: -1 })
            .limit(10);

        return res.status(200).json({ meetings });

    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};
