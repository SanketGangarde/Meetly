import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../src/models/user.model.js";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });


passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/v1/users/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Look for user by email
                let user = await User.findOne({ email: profile.emails[0].value });
                
                if (!user) {
                    // Create new user if they don't exist
                    user = new User({
                        name: profile.displayName,
                        // Add a random number to username to ensure uniqueness
                        username: profile.emails[0].value.split('@')[0] + Math.floor(Math.random() * 10000),
                        email: profile.emails[0].value,
                        googleId: profile.id
                    });
                    await user.save();
                } else if (!user.googleId) {
                    // Link google account to existing user
                    user.googleId = profile.id;
                    await user.save();
                }

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

export default passport;