import { Server } from "socket.io";
import cors from "cors";



const messages = {};
const roomHosts = {}; // tracks host for each room: roomId -> socketId

export const connectToSocket = (server) => {

    // when this line :- socketRef.current = io(server_url, { secure: false }); 
    // is run then the below io runs and create a connection of frontend and backend
    //io,io.on also runs

    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || true,
            methods: ["GET", "POST"],
            credentials: true,
            allowedHeaders: ["Authorization"]
        }
    });

    //socketId get generated automatically  and send to frontend

    io.on("connection", (socket) => {

        console.log("User Connected:", socket.id);


        //wait until from frontend socketRef.current.on this executed
        // ==========================
        // Join Meeting / Knocking
        // ==========================
        socket.on("join-call", ({ roomId, username }) => {

            const hostId = roomHosts[roomId];
            const roomExists = io.sockets.adapter.rooms.has(roomId);
            const isHostAlive = hostId && io.sockets.sockets.has(hostId);

            if (!roomExists || !isHostAlive) {
                // First person in the room (or host rejoining) -> They become the Host
                roomHosts[roomId] = socket.id;
                socket.data.isHost = true;

                socket.join(roomId);
                socket.data.roomId = roomId;
                socket.data.username = username;

                console.log(`${username} joined as HOST of ${roomId}`);

                socket.emit("join-accepted", { isHost: true });
                socket.emit("chat-history", messages[roomId] || []);

            } else {
                // Check room capacity limit (Max 4 participants)
                const room = io.sockets.adapter.rooms.get(roomId);
                const currentParticipants = room ? room.size : 0;

                if (currentParticipants >= 4) {
                    console.log(`${username} rejected from ${roomId}: Room is full (4/4)`);
                    socket.emit("join-denied", { reason: "Room is full (Maximum 4 participants allowed)." });
                    return;
                }

                // Guest -> Ask participants in the room to let them in
                console.log(`${username} is knocking on ${roomId}`);
                
                // Save pending info temporarily
                socket.data.pendingRoomId = roomId;
                socket.data.pendingUsername = username;

                // Broadcast join request to all active room members
                io.to(roomId).emit("ask-to-join", {
                    socketId: socket.id,
                    username
                });
            }
        });

        // ==========================
        // Admit / Deny Users
        // ==========================
        socket.on("admit-user", ({ targetId, accepted }) => {
            const guestSocket = io.sockets.sockets.get(targetId);
            
            if (!guestSocket) return;

            const roomId = guestSocket.data.pendingRoomId;
            const username = guestSocket.data.pendingUsername;

            if (accepted) {
                if (roomId) {
                    const room = io.sockets.adapter.rooms.get(roomId);
                    const currentParticipants = room ? room.size : 0;

                    if (currentParticipants >= 4) {
                        guestSocket.emit("join-denied", { reason: "Room is full (Maximum 4 participants allowed)." });
                        if (roomId) {
                            io.to(roomId).emit("knocker-handled", { targetId });
                        }
                        delete guestSocket.data.pendingRoomId;
                        delete guestSocket.data.pendingUsername;
                        return;
                    }

                    guestSocket.join(roomId);
                    guestSocket.data.roomId = roomId;
                    guestSocket.data.username = username;
                    delete guestSocket.data.pendingRoomId;
                    delete guestSocket.data.pendingUsername;

                    console.log(`${username} was admitted to ${roomId}`);

                    guestSocket.emit("join-accepted", { isHost: false });
                    guestSocket.emit("chat-history", messages[roomId] || []);

                    // Notify everyone in the room that this knocker was handled
                    io.to(roomId).emit("knocker-handled", { targetId });

                    // Notify everyone that they joined
                    guestSocket.to(roomId).emit("user-joined", {
                        socketId: targetId,
                        username
                    });
                }
            } else {
                guestSocket.emit("join-denied");
                if (roomId) {
                    io.to(roomId).emit("knocker-handled", { targetId });
                }
                delete guestSocket.data.pendingRoomId;
                delete guestSocket.data.pendingUsername;
            }
        });



        // ==========================
        // Chat
        // ==========================
        socket.on("chat-message", ({ message }) => {

            const roomId = socket.data.roomId;
            const username = socket.data.username;

            if (!messages[roomId]) {
                messages[roomId] = [];
            }

            const chat = {
                sender: username,
                message,
                socketId: socket.id
            };

            messages[roomId].push(chat);

            socket.to(roomId).emit("chat-message", chat);  // broadcasts to EVERYONE except sender

        });



        // ==========================
        // Mute / Unmute
        // ==========================
        socket.on("toggle-mic", ({ muted }) => {

            socket.to(socket.data.roomId).emit(
                "toggle-mic",
                {
                    socketId: socket.id,
                    muted
                }
            );

        });



        // ==========================
        // Camera
        // ==========================
        socket.on("toggle-camera", ({ cameraOff }) => {

            socket.to(socket.data.roomId).emit(
                "toggle-camera",
                {
                    socketId: socket.id,
                    cameraOff
                }
            );

        });



        // ==========================
        // Screen Share
        // ==========================
        socket.on("screen-share", ({ sharing }) => {

            socket.to(socket.data.roomId).emit(
                "screen-share",
                {
                    socketId: socket.id,
                    sharing
                }
            );

        });



        // ==========================
        // Emoji & Gesture Reactions
        // ==========================
        socket.on("reaction", ({ emoji }) => {
            io.to(socket.data.roomId).emit("reaction", {
                socketId: socket.id,
                username: socket.data.username,
                emoji
            });
        });

        socket.on("gesture-reaction", ({ emoji }) => {
            // Relays the AI hand gesture emoji to everyone else in the room
            socket.to(socket.data.roomId).emit("gesture-reaction", {
                socketId: socket.id,
                emoji
            });
        });



        // ==========================
        // WebRTC Signaling
        // ==========================

        //here offer is send to other users

        socket.on("offer", ({ targetId, offer }) => {

            io.to(targetId).emit("offer", {
                from: socket.id,//host id
                offer
            });

        });


        socket.on("answer", ({ targetId, answer }) => {

            io.to(targetId).emit("answer", {
                from: socket.id,
                answer
            });

        });


        socket.on("ice-candidate", ({ targetId, candidate }) => {

            io.to(targetId).emit("ice-candidate", {
                from: socket.id,
                candidate
            });

        });



        // ==========================
        // User Left
        // ==========================
        socket.on("disconnect", () => {

            const roomId = socket.data?.roomId;
            const pendingRoomId = socket.data?.pendingRoomId;
            const username = socket.data?.username || "Guest";

            if (pendingRoomId) {
                io.to(pendingRoomId).emit("knocker-handled", { targetId: socket.id });
            }

            if (roomId) {
                socket.to(roomId).emit(
                    "user-left",
                    { socketId: socket.id }
                );

                // If host leaves, assign a new host if others remain
                if (socket.data.isHost) {
                    const room = io.sockets.adapter.rooms.get(roomId);
                    if (room && room.size > 0) {
                        const newHostId = Array.from(room)[0];
                        roomHosts[roomId] = newHostId;
                        
                        const newHostSocket = io.sockets.sockets.get(newHostId);
                        if (newHostSocket) {
                            newHostSocket.data.isHost = true;
                            newHostSocket.emit("you-are-host");
                        }
                    } else {
                        delete roomHosts[roomId];
                    }
                }
            }

            console.log(`${username} disconnected, with Id : ${socket.id}`);

        });

    });

    return io;
};