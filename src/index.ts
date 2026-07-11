import express from "express";
import { env } from "./env.js";
import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { authRouter } from "./routes/auth.js";

async function main() {
  await runMigrations();
  await runSeed();

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);

  app.listen(Number(env.PORT), () => {
    console.log(`[server] listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
