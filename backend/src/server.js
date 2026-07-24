import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectToSocket } from "./controllers/socketManager.js";
import userRouter from "./routes/users.routes.js";



dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

const app = express();
const server = createServer(app);
const io = connectToSocket(server);


app.use(cors({
    origin: "http://localhost:5173",  // Vite frontend URL
    credentials: true,                // allow cookies to be sent
}));
app.use(cookieParser());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRouter)

app.get("/home", (req, res) => {
    res.json({ "welcome": "home" });
});

const start = async () => {
    server.listen(3000, () => {
        console.log("app is listening on port 3000");
    });

    try {

        await mongoose.connect(process.env.mongodb_connect)
            .then(console.log("mongodb connected successfully!"));
    } catch (err) {
        console.log(err, "mongodb connection failed!");
    }
};

start();



