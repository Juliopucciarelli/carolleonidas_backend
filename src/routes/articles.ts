import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { slugify, ensureUniqueSlug } from "../lib/slug.js";
import { ARTICLE_CATEGORIES } from "../lib/categories.js";

export const articlesRouter = Router();

const articleInputSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  authors: z.string().min(1),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(ARTICLE_CATEGORIES),
  keywords: z.array(z.string()).default([]),
  summary: z.string().optional().or(z.literal("")),
  doi: z.string().url().optional().or(z.literal("")),
  journal: z.string().max(100).optional().or(z.literal("")),
});

const articleUpdateSchema = articleInputSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine((v) => [10, 30, 50].includes(v), {
    message: "pageSize must be 10, 30 or 50",
  }).default(30),
  search: z.string().optional(),
  category: z.enum(ARTICLE_CATEGORIES).optional(),
  publishedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  publishedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function toArticle(row: any) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    authors: row.authors,
    publishedAt: row.published_at.toISOString().slice(0, 10),
    category: row.category,
    keywords: row.keywords,
    summary: row.summary,
    doi: row.doi,
    journal: row.journal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

articlesRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { page, pageSize, search, category, publishedFrom, publishedTo } = parsed.data;

  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`title ILIKE $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (publishedFrom) {
    params.push(publishedFrom);
    conditions.push(`published_at >= $${params.length}`);
  }
  if (publishedTo) {
    params.push(publishedTo);
    conditions.push(`published_at <= $${params.length}`);
  }

  const where = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT count(*) FROM articles WHERE ${where}`,
    params
  );
  const total = Number(countResult.rows[0].count);

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const listResult = await pool.query(
    `SELECT * FROM articles WHERE ${where} ORDER BY published_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    items: listResult.rows.map(toArticle),
    total,
    page,
    pageSize,
  });
});

articlesRouter.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM articles WHERE id = $1 AND deleted_at IS NULL",
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(toArticle(rows[0]));
});

articlesRouter.post("/", async (req, res) => {
  const parsed = articleInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const input = parsed.data;

  const baseSlug = slugify(input.title);
  const slug = await ensureUniqueSlug(baseSlug, async (candidate) => {
    const { rows } = await pool.query(
      "SELECT 1 FROM articles WHERE slug = $1 AND deleted_at IS NULL",
      [candidate]
    );
    return rows.length > 0;
  });

  const { rows } = await pool.query(
    `INSERT INTO articles (title, slug, authors, published_at, category, keywords, summary, doi, journal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.title,
      slug,
      input.authors,
      input.publishedAt,
      input.category,
      input.keywords,
      input.summary || null,
      input.doi || null,
      input.journal || null,
    ]
  );

  res.status(201).json(toArticle(rows[0]));
});

articlesRouter.put("/:id", async (req, res) => {
  const parsed = articleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const input = parsed.data;

  const existing = await pool.query(
    "SELECT 1 FROM articles WHERE id = $1 AND deleted_at IS NULL",
    [req.params.id]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const fields: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    authors: input.authors,
    published_at: input.publishedAt,
    category: input.category,
    keywords: input.keywords,
    summary: input.summary === "" ? null : input.summary,
    doi: input.doi === "" ? null : input.doi,
    journal: input.journal === "" ? null : input.journal,
  };

  const setClauses: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    params.push(value);
    setClauses.push(`${column} = $${params.length}`);
  }
  setClauses.push("updated_at = now()");

  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE articles SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );

  res.json(toArticle(rows[0]));
});

articlesRouter.delete("/:id", async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE articles SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json({ ok: true });
});
