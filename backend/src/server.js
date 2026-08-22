import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectToSocket } from "./controllers/socketManager.js";
import userRouter from "./routes/users.routes.js";
import passport from "../config/passport.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";



dotenv.config();
try {
    dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });
} catch (e) {
    // Ignore error if root .env file doesn't exist in production
}

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

// Security Middleware: Set secure HTTP headers
app.use(helmet());

// Security Middleware: Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased limit for dev requests
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use("/api", apiLimiter);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // Echo the exact request origin to satisfy credentials: true requirements
        return callback(null, origin);
    },
    credentials: true, // allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));
app.use(cookieParser());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));
app.use(passport.initialize());

app.use("/api/v1/users", userRouter);


const PORT = process.env.PORT || 3000;

const start = async () => {
    server.listen(PORT, () => {
        console.log(`App is listening on port ${PORT}`);
    });

    try {
        const dbUrl = process.env.mongodb_connect || process.env.MONGO_URI;
        if (!dbUrl) {
            console.error("MongoDB Connection URL missing! Please set mongodb_connect in environment variables.");
        } else {
            await mongoose.connect(dbUrl);
            console.log("MongoDB connected successfully!");

        }
    } catch (err) {
        console.error("MongoDB connection failed!", err);
    }
};

start();



