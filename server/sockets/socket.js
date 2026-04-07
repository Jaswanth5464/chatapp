const { Server } = require("socket.io");
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

let io;
const onlineUsers = new Map();

const initSocket = (server) => {
    io = new Server(server, {
        pingTimeout: 60000,
        cors: {
            origin: "*", // Fix for React/Vercel CORS issues later
        },
    });

    io.on("connection", (socket) => {
        console.log("Connect to socket.io: ", socket.id);

        // User setup
        socket.on("setup", async (userData) => {
            const userIdStr = userData._id.toString();
            socket.join(userIdStr);
            
            // Add user to online map
            onlineUsers.set(userIdStr, socket.id);
            socket.userId = userIdStr; // Store in socket instance for disconnect
            
            // Update user status in DB
            await User.findByIdAndUpdate(userIdStr, { isOnline: true });
            
            // Emit to everyone who is online
            io.emit("online users", Array.from(onlineUsers.keys()));
            socket.emit("connected");

            // Process Offline Messages (Sent -> Delivered)
            try {
                const userChats = await Chat.find({ users: userIdStr });
                const chatIds = userChats.map(c => c._id);
                
                const undeliveredMessages = await Message.find({
                    chatId: { $in: chatIds },
                    sender: { $ne: userIdStr },
                    status: 'sent'
                })
                .populate("sender", "username")
                .populate("chatId");
                
                const undeliveredIdList = undeliveredMessages.map(m => m._id);

                if (undeliveredIdList.length > 0) {
                    // Update to delivered
                    await Message.updateMany(
                        { _id: { $in: undeliveredIdList } },
                        { status: 'delivered' }
                    );

                    // Re-fetch populated or simulate
                    undeliveredMessages.forEach(async msg => {
                        msg.status = 'delivered';
                        let fullMsg = await User.populate(msg, { path: "chatId.users", select: "username" });
                        socket.emit("message recieved", fullMsg);
                        
                        // Notify sender that it delivered
                        const senderIdStr = msg.sender._id.toString();
                        if (onlineUsers.has(senderIdStr)) {
                            socket.to(senderIdStr).emit("message status update", {
                                messageId: msg._id,
                                status: "delivered"
                            });
                        }
                    });
                }
            } catch (err) {
                console.error("Offline Msg Sync Error:", err);
            }
        });

        // Room joining
        socket.on("join chat", (room) => {
            socket.join(room);
            console.log("User joined room: " + room);
        });

        // Typing indicators
        socket.on("typing", (room) => socket.in(room).emit("typing"));
        socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

        // New message
        socket.on("new message", async (newMessageRecieved) => {
            var chat = newMessageRecieved.chatId;

            if (!chat.users) return console.log("chat.users not defined");

            // Save message to DB before broadcasting
            try {
                let message = await Message.create({
                    sender: newMessageRecieved.sender._id,
                    content: newMessageRecieved.content,
                    mediaUrl: newMessageRecieved.mediaUrl || "",
                    isCallLog: newMessageRecieved.isCallLog || false,
                    callDuration: newMessageRecieved.callDuration || 0,
                    chatId: chat._id
                });
                
                message = await (await message.populate("sender", "username")).populate("chatId");
                message = await User.populate(message, {
                    path: "chatId.users",
                    select: "username"
                });

                // Update latest message in chat
                await Chat.findByIdAndUpdate(chat._id, { latestMessage: message });

                chat.users.forEach(async (user) => {
                    const userIdStr = user._id.toString();
                    if (userIdStr == newMessageRecieved.sender._id.toString()) return;
                    
                    if (onlineUsers.has(userIdStr)) {
                        // ✅ Receiver online → update to delivered instantly
                        message.status = "delivered";
                        await Message.findByIdAndUpdate(message._id, { status: "delivered" });

                        socket.in(userIdStr).emit("message recieved", message);

                        // Tell sender it was delivered
                        socket.emit("message status update", {
                            messageId: message._id,
                            status: "delivered"
                        });
                    }
                });
                
            } catch (error) {
                console.error("Socket Message Save Error:", error);
            }
        });

        // Chat opened -> Mark as Seen
        socket.on("mark chat seen", async ({ chatId, userId }) => {
            try {
                const unseenMsgs = await Message.find({
                    chatId: chatId,
                    sender: { $ne: userId },
                    status: { $ne: 'seen' }
                });

                if (unseenMsgs.length > 0) {
                    const unseenIds = unseenMsgs.map(m => m._id);
                    await Message.updateMany(
                        { _id: { $in: unseenIds } },
                        { status: 'seen' }
                    );

                    // Notify sender for blue ticks
                    const senderIdStr = unseenMsgs[0].sender.toString();
                    if (onlineUsers.has(senderIdStr)) {
                        io.to(senderIdStr).emit("message status update", {
                            chatId: chatId,
                            status: "seen"
                        });
                    }
                }
            } catch (err) { }
        });

        // WebRTC Calling Signaling
        socket.on("callUser", ({ userToCall, signalData, from, name, type }) => {
            if (onlineUsers.has(userToCall)) {
                socket.in(userToCall).emit("callUser", { signal: signalData, from, name, type });
            }
        });

        socket.on("answerCall", ({ to, signal }) => {
            if (onlineUsers.has(to)) {
                socket.in(to).emit("callAccepted", signal);
            }
        });

        socket.on("endCall", ({ to }) => {
            if (onlineUsers.has(to)) {
                socket.in(to).emit("callEnded");
            }
        });

        // Cleanup on disconnect
        socket.on("disconnect", async () => {
            console.log("USER DISCONNECTED", socket.id);
            
            const disconnectedUserId = socket.userId;
            
            if (disconnectedUserId) {
                // Check if they are actually disconnected (not just a tab refresh)
                for (let [userId, socketId] of onlineUsers.entries()) {
                    if (socketId === socket.id && userId === disconnectedUserId) {
                        onlineUsers.delete(userId);
                    }
                }
                
                // Update DB: offline + lastSeen timestamp
                await User.findByIdAndUpdate(disconnectedUserId, {
                    isOnline: false,
                    lastSeen: new Date()
                });

                // Notify others that this user went offline
                io.emit("online users", Array.from(onlineUsers.keys()));
            }
        });
    });
};

module.exports = { initSocket };
