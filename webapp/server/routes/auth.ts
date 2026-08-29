import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "../config/database";
import { getJwtSecret, isProduction } from "../config/env";
import {
  requireAuth,
  SESSION_COOKIE,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { User } from "../models/User";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/sign-up", async (request, response) => {
  const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
  const email =
    typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const passwordConfirmation =
    typeof request.body.passwordConfirmation === "string"
      ? request.body.passwordConfirmation
      : "";

  if (name.length < 2 || name.length > 80) {
    response.status(400).json({ message: "Name must be between 2 and 80 characters." });
    return;
  }

  if (!emailPattern.test(email)) {
    response.status(400).json({ message: "Enter a valid email address." });
    return;
  }

  if (password.length < 8) {
    response.status(400).json({ message: "Password must contain at least 8 characters." });
    return;
  }

  if (password !== passwordConfirmation) {
    response.status(400).json({ message: "Passwords do not match." });
    return;
  }

  await connectToDatabase();

  const existingUser = await User.exists({ email });
  if (existingUser) {
    response.status(409).json({ message: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await User.create({ name, email, password: passwordHash });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      response.status(409).json({ message: "An account with this email already exists." });
      return;
    }
    throw error;
  }

  response.status(201).json({ message: "Account created. You can now sign in." });
});

router.post("/sign-in", async (request, response) => {
  const email =
    typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";

  if (!email || !password) {
    response.status(400).json({ message: "Email and password are required." });
    return;
  }

  await connectToDatabase();
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    response.status(401).json({ message: "Email or password is incorrect." });
    return;
  }

  const token = jwt.sign({}, getJwtSecret(), {
    subject: user._id.toString(),
    expiresIn: "7d",
  });

  setSessionCookie(response, token);
  response.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
  });
});

router.get(
  "/session",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response) => {
    await connectToDatabase();
    const user = await User.findById(request.auth?.userId);

    if (!user) {
      response.clearCookie(SESSION_COOKIE, { path: "/" });
      response.status(401).json({ message: "Your account could not be found." });
      return;
    }

    response.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });
  },
);

router.post("/sign-out", (_request, response) => {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
  });
  response.status(204).send();
});

function setSessionCookie(response: Response, token: string) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export default router;
