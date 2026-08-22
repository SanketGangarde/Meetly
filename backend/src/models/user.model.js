import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    username: {
        type: String,
        required: true,
        unique: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        // Optional because Google OAuth users won't have a password
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // allows null values without unique constraint errors
    },

    token: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
})

export const User = mongoose.model('User', userSchema);