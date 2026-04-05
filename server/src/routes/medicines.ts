import { Router } from "express";
import { db, medicinesTable } from "../db";
import { eq } from "drizzle-orm";

const router = Router();

function getStatus(quantity: number): string {
  if (quantity === 0) return "out_of_stock";
  if (quantity < 10) return "low";
  return "available";
}

function formatMedicine(m: typeof medicinesTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    quantity: m.quantity,
    price: parseFloat(String(m.price)),
    expiryDate: m.expiryDate,
    status: getStatus(m.quantity),
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const medicines = await db.select().from(medicinesTable).orderBy(medicinesTable.name);
  return res.json(medicines.map(formatMedicine));
});

router.post("/", async (req, res) => {
  const { name, category, quantity, price, expiryDate } = req.body;
  if (!name || !category || quantity === undefined || !price || !expiryDate) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const [medicine] = await db.insert(medicinesTable).values({
    name,
    category,
    quantity: parseInt(quantity),
    price: String(price),
    expiryDate,
  }).returning();

  return res.status(201).json(formatMedicine(medicine));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, category, quantity, price, expiryDate } = req.body;

  const [medicine] = await db
    .update(medicinesTable)
    .set({
      name,
      category,
      quantity: parseInt(quantity),
      price: String(price),
      expiryDate,
    })
    .where(eq(medicinesTable.id, id))
    .returning();

  if (!medicine) {
    return res.status(404).json({ error: "Medicine not found" });
  }

  return res.json(formatMedicine(medicine));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(medicinesTable).where(eq(medicinesTable.id, id));
  return res.json({ message: "Medicine deleted" });
});

export default router;
