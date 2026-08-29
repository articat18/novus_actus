/**
 * Vercel serverless entry point.
 *
 * The `/api/(.*)` rewrite in vercel.json routes every API request to this
 * function, which hands it to the Express app. The real application code lives
 * in `_src/` (the underscore keeps Vercel from treating those files as separate
 * functions).
 */
import { createApp } from "./_src/app.js";

const app = createApp();

export default app;
