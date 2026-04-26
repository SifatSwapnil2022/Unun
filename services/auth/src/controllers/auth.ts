import { Request, Response } from 'express';
import User from '../model/User.js'; // ← import your model
import jwt from 'jsonwebtoken';

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { email, name, picture } = req.body;

        let user = await User.findOne({ email }); // ← let not const

        if (!user) {
            user = await User.create({
                email,
                name,
                image: picture,
            });
        }

        const token = jwt.sign({ user }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
        res.status(200).json({ message: "Login successful", user, token }); // ← send response

    } catch (error) {
        console.error("Error in loginUser:", error);
        res.status(500).json({ message: "Server error" });
    }
};