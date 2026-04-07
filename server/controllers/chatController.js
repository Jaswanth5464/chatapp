const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

// Fetch or Create 1-on-1 Chat
exports.accessChat = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "UserId param not sent with request" });
    }

    // Check if chat exists with these two users
    let isChat = await Chat.find({
        isGroupChat: false,
        $and: [
            { users: { $elemMatch: { $eq: req.user._id } } },
            { users: { $elemMatch: { $eq: userId } } }
        ]
    })
    .populate("users", "-password")
    .populate("latestMessage");

    isChat = await User.populate(isChat, {
        path: "latestMessage.sender",
        select: "username"
    });

    if (isChat.length > 0) {
        res.send(isChat[0]);
    } else {
        // Create new chat
        var chatData = {
            chatName: "sender",
            isGroupChat: false,
            users: [req.user._id, userId]
        };

        try {
            const createdChat = await Chat.create(chatData);
            const fullChat = await Chat.findOne({ _id: createdChat._id }).populate("users", "-password");
            res.status(200).send(fullChat);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

// Fetch all chats for a user
exports.fetchChats = async (req, res) => {
    try {
        let results = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate("latestMessage")
            .sort({ updatedAt: -1 });

        results = await User.populate(results, {
            path: "latestMessage.sender",
            select: "username"
        });

        res.status(200).send(results);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Fetch all messages for a specific chat
exports.allMessages = async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId })
            .populate("sender", "username")
            .populate("chatId");
        res.json(messages);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Generate Smart Reply Suggestion
exports.suggestReply = async (req, res) => {
    try {
        const { latestMessage } = req.body;
        if (!latestMessage) return res.json({ suggestions: [] });
        
        const lowerMsg = latestMessage.toLowerCase().trim();
        let suggestions = [];
        
        // Comprehensive Intent Mapping (100+ variations)
        const INTENT_MAP = [
            {
                regex: /\b(hi|hello|hey|yo|greetings|wassup|sup)\b/,
                replies: ["Hello!", "Hey there!", "Hi, how are you?", "Yo!", "Greetings!", "Hey! What's up?"]
            },
            {
                regex: /\b(how are you|how's it going|what's up|how r u|u good)\b/,
                replies: ["I'm doing great, thanks!", "Good, and you?", "Doing well! How about you?", "Excellent! You?", "Pretty good.", "Not too bad!"]
            },
            {
                regex: /\b(bye|see ya|goodbye|cya|later|gtg|peace out)\b/,
                replies: ["Goodbye!", "See you later!", "Take care!", "Talk soon!", "Bye-bye!", "Have a good one!"]
            },
            {
                regex: /\b(thanks|thank you|thx|tysm|appreciate|grateful)\b/,
                replies: ["You're welcome!", "Anytime!", "No problem!", "Happy to help!", "My pleasure!", "Don't mention it!"]
            },
            {
                regex: /\b(yes|yeah|yep|sure|ok|okay|definitely|absolutely|affirmative)\b/,
                replies: ["Awesome.", "Sounds good.", "Great.", "Perfect.", "I'm in!", "Sure thing.", "Let's do it."]
            },
            {
                regex: /\b(no|nope|nah|not really|negative)\b/,
                replies: ["Alright.", "Got it.", "No worries.", "Maybe another time.", "I'll pass.", "Unfortunately not."]
            },
            {
                regex: /\b(lol|lmao|haha|hehe|rofl|funny)\b/,
                replies: ["😂", "Haha true!", "That's hilarious!", "LMAO!", "Good one!", "You're funny!"]
            },
            {
                regex: /\b(where are you|where r u|location|u at home)\b/,
                replies: ["I'm at home.", "I'm at work.", "Just out and about.", "On my way!", "At the cafe.", "I'm nearby."]
            },
            {
                regex: /\b(busy\?|are you free|got time|u there|u up)\b/,
                replies: ["Yes, I'm free.", "A bit busy right now.", "Give me 5 minutes.", "Almost done with work.", "I'm available now.", "Talk now?"]
            },
            {
                regex: /\b(good morning|morning|gm)\b/,
                replies: ["Good morning!", "Morning! Hope you slept well.", "Have a great day!", "GM! ☀️", "Top of the morning!"]
            },
            {
                regex: /\b(good night|night|gn)\b/,
                replies: ["Good night!", "Sweet dreams!", "Sleep well!", "GN! 🌙", "Talk to you tomorrow!"]
            },
            {
                regex: /\b(love you|ily|love u)\b/,
                replies: ["Love you too! ❤️", "Aww ❤️", "Miss you!", "You're the best!", "Sending love! ✨"]
            },
            {
                regex: /\b(sorry|apologize|my bad|forgive me)\b/,
                replies: ["No problem at all.", "It's fine, don't worry.", "All good!", "Apology accepted.", "Forget about it."]
            },
            {
                regex: /\b(cool|neat|awesome|wow|nice|amazing|great job)\b/,
                replies: ["I know, right?", "Totally!", "Glad you like it!", "Thanks!", "It is pretty cool.", "Awesome!"]
            },
            {
                regex: /\b(what are you doing|what u doin|wud|what's shaking)\b/,
                replies: ["Not much, you?", "Just chilling.", "Working on stuff.", "Watching a movie.", "Getting some food.", "Thinking about things."]
            },
            {
                regex: /\b(hungry|food|lunch|dinner|eat)\b/,
                replies: ["I'm starving!", "Let's get food.", "What's on the menu?", "I'm down for anything.", "Pizza?", "Maybe later."]
            },
            {
                regex: /\b(tired|sleepy|exhausted)\b/,
                replies: ["Go get some rest!", "Me too...", "Long day?", "Take a nap.", "Hope you feel better.", "Same here."]
            }
        ];

        for (const intent of INTENT_MAP) {
            if (lowerMsg.match(intent.regex)) {
                // Return up to 3 random suggestions from the matched intent
                suggestions = intent.replies.sort(() => 0.5 - Math.random()).slice(0, 3);
                break;
            }
        }

        if (suggestions.length === 0) {
            if (lowerMsg.includes('?')) {
                suggestions = ["I'm not sure.", "Yes, absolutely.", "Let me check.", "Maybe?", "I'll get back to you."];
            } else {
                suggestions = ["Okay.", "Got it.", "Tell me more.", "Interesting.", "I see.", "Right."];
            }
            suggestions = suggestions.sort(() => 0.5 - Math.random()).slice(0, 3);
        }

        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Basic Analytics for Current User
exports.getUserAnalytics = async (req, res) => {
    try {
        const totalMessagesSent = await Message.countDocuments({ sender: req.user._id });
        const chatsParticipated = await Chat.countDocuments({ users: req.user._id });
        
        res.json({
            totalMessagesSent,
            chatsParticipated
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
