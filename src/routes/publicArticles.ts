import { Router } from "express";
import { pool } from "../db.js";
import { toArticle } from "./articles.js";

export const publicArticlesRouter = Router();

publicArticlesRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM articles WHERE deleted_at IS NULL ORDER BY published_at DESC"
  );
  res.json({ items: rows.map(toArticle) });
});

publicArticlesRouter.get("/:slug", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM articles WHERE slug = $1 AND deleted_at IS NULL",
    [req.params.slug]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(toArticle(rows[0]));
});
