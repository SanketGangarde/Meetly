import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema({
    user_id: {
        type: "string",
        required: true
    },
    meetingCode: {
        type: "string",
        required: true,
        unique: true
    },
    password: {
        type: "string",
        required: true
    },
    date: {
        type: Date,
        default: Date.now(),
        required: true
    },
    time: {
        type: String,

    },
    duration: {
        type: String,

    },
    participants: {
        type: Number,

    },

    hostName: {
        type: "string",

    }

})

export const Meeting = mongoose.model('Meeting', meetingSchema);
