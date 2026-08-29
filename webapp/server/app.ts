import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import authRoutes from "./routes/auth";
import leaderboardRoutes from "./routes/leaderboard";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.use("/api", (_request, response) => {
  response.status(404).json({ message: "API route not found." });
});

app.use(
  (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error(error);
    response.status(500).json({ message: "Something went wrong. Please try again." });
  },
);

export default app;
