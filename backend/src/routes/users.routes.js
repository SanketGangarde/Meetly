import { Router } from "express";
import { register, login, getMe, addMeetingHistory, getMeetingHistory, logout, googleAuthCallback } from "../controllers/userController.js";
import passport from "../../config/passport.js";



const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/me").get(getMe);                             // restores session on page refresh
router.route("/meeting-history").post(addMeetingHistory).get(getMeetingHistory);

router.route("/logout").post(logout);

// Google OAuth routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/auth/google/callback", (req, res, next) => {
    const clientUrl = process.env.CLIENT_URL || "";
    passport.authenticate("google", { session: false, failureRedirect: `${clientUrl}/auth?error=auth_failed` })(req, res, next);
}, googleAuthCallback);

export default router;
