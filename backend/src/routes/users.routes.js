import { Router } from "express";
import { register, login, getMe } from "../controllers/userController.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/me").get(getMe);   // restores session on page refresh
router.route("/logout").post(logout);

export default router;

