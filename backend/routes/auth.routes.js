import express from "express"
import { register , login, getMe, updateProfile, changePassword, deleteAccount } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

const welcome_messages = ()=>{
    console.log("welcome")
}
router.post("/register" , register);
