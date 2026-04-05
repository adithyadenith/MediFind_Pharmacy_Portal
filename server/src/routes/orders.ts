import { Router } from "express";
import { db, ordersTable, orderItemsTable, medicinesTable } from "../db";
import { eq, and } from "drizzle-orm";

const router = Router();

async function getOrderWithItems(orderId: number) {
  const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order.length) return null;

  const items = await db
    .select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      medicineId: orderItemsTable.medicineId,
      medicineName: medicinesTable.name,
      quantity: orderItemsTable.quantity,
      price: orderItemsTable.price,
    })
    .from(orderItemsTable)
    .innerJoin(medicinesTable, eq(orderItemsTable.medicineId, medicinesTable.id))
    .where(eq(orderItemsTable.orderId, orderId));

  const o = order[0];
  return {
    id: o.id,
    patientName: o.patientName,
    patientEmail: o.patientEmail,
    status: o.status,
    totalPrice: parseFloat(String(o.totalPrice)),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      medicineId: i.medicineId,
      medicineName: i.medicineName,
      quantity: i.quantity,
      price: parseFloat(String(i.price)),
    })),
  };
}

async function updateOrderStatus(orderId: number, status: string) {
  const [updated] = await db
    .update(ordersTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId))
    .returning();

  if (!updated) return null;
  return getOrderWithItems(updated.id);
}

router.get("/", async (req, res) => {
  const { status } = req.query;

  let query = db.select().from(ordersTable);
  const orders = status
    ? await db.select().from(ordersTable).where(eq(ordersTable.status, String(status))).orderBy(ordersTable.createdAt)
    : await db.select().from(ordersTable).orderBy(ordersTable.createdAt);

  const ordersWithItems = await Promise.all(
    orders.map((o) => getOrderWithItems(o.id))
  );

  return res.json(ordersWithItems.filter(Boolean));
});

router.post("/", async (req, res) => {
  const { patientName, patientEmail, items } = req.body;
  if (!patientName || !patientEmail || !items?.length) {
    return res.status(400).json({ error: "patientName, patientEmail and items are required" });
  }

  let totalPrice = 0;
  const medicineData: { medicine: typeof medicinesTable.$inferSelect; quantity: number }[] = [];

  for (const item of items) {
    const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, item.medicineId)).limit(1);
    if (!medicine) {
      return res.status(400).json({ error: `Medicine ${item.medicineId} not found` });
    }
    const itemTotal = parseFloat(String(medicine.price)) * item.quantity;
    totalPrice += itemTotal;
    medicineData.push({ medicine, quantity: item.quantity });
  }

  const [order] = await db.insert(ordersTable).values({
    patientName,
    patientEmail,
    status: "pending",
    totalPrice: String(totalPrice),
  }).returning();

  for (const { medicine, quantity } of medicineData) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      medicineId: medicine.id,
      quantity,
      price: String(parseFloat(String(medicine.price)) * quantity),
    });
  }

  const fullOrder = await getOrderWithItems(order.id);
  return res.status(201).json(fullOrder);
});

router.post("/:id/accept", async (req, res) => {
  const id = parseInt(req.params.id);
  const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);

  if (!order.length) return res.status(404).json({ error: "Order not found" });
  if (order[0].status !== "pending") return res.status(400).json({ error: "Order is not pending" });

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

  for (const item of items) {
    const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, item.medicineId)).limit(1);
    if (!medicine || medicine.quantity < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for medicine ${item.medicineId}` });
    }
  }

  for (const item of items) {
    const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, item.medicineId)).limit(1);
    await db.update(medicinesTable)
      .set({ quantity: medicine.quantity - item.quantity })
      .where(eq(medicinesTable.id, item.medicineId));
  }

  const [updated] = await db.update(ordersTable)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  const fullOrder = await getOrderWithItems(updated.id);
  return res.json(fullOrder);
});

router.post("/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id);
  const fullOrder = await updateOrderStatus(id, "rejected");
  if (!fullOrder) return res.status(404).json({ error: "Order not found" });
  return res.json(fullOrder);
});

router.post("/:id/ready", async (req, res) => {
  const id = parseInt(req.params.id);
  const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);

  if (!order.length) return res.status(404).json({ error: "Order not found" });
  if (order[0].status !== "accepted") {
    return res.status(400).json({ error: "Only accepted orders can be marked as ready" });
  }

  const fullOrder = await updateOrderStatus(id, "ready");
  return res.json(fullOrder);
});

router.post("/:id/complete", async (req, res) => {
  const id = parseInt(req.params.id);
  const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);

  if (!order.length) return res.status(404).json({ error: "Order not found" });
  if (order[0].status !== "ready") {
    return res.status(400).json({ error: "Only ready orders can be completed" });
  }

  const fullOrder = await updateOrderStatus(id, "completed");
  return res.json(fullOrder);
});

router.post("/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id);
  const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);

  if (!order.length) return res.status(404).json({ error: "Order not found" });
  if (!["accepted", "ready"].includes(order[0].status)) {
    return res.status(400).json({ error: "Only accepted or ready orders can be cancelled" });
  }

  const fullOrder = await updateOrderStatus(id, "cancelled");
  return res.json(fullOrder);
});

export default router;
