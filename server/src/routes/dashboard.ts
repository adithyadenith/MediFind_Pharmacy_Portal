import { Router } from "express";
import { db, ordersTable, medicinesTable, orderItemsTable } from "../db";
import { eq, lt, count, sum } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  const [totalOrders] = await db.select({ count: count() }).from(ordersTable);
  const [pendingOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [completedOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "completed"));
  const rejected = await db.select().from(ordersTable);
  const [inventoryCount] = await db.select({ count: count() }).from(medicinesTable);
  const [lowStockCount] = await db.select({ count: count() }).from(medicinesTable).where(lt(medicinesTable.quantity, 10));

  const totalRevenueOrders = await db.select().from(ordersTable).where(eq(ordersTable.status, "completed"));
  const totalRevenue = totalRevenueOrders.reduce((acc, o) => acc + parseFloat(String(o.totalPrice)), 0);
  const rejectedOrders = rejected.filter((o) => o.status === "rejected" || o.status === "cancelled").length;

  return res.json({
    totalOrders: totalOrders.count,
    pendingOrders: pendingOrders.count,
    completedOrders: completedOrders.count,
    rejectedOrders,
    inventoryCount: inventoryCount.count,
    lowStockCount: lowStockCount.count,
    totalRevenue,
  });
});

router.get("/recent-orders", async (req, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(ordersTable.createdAt)
    .limit(5);

  const ordersWithItems = await Promise.all(
    orders.map(async (o) => {
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
        .where(eq(orderItemsTable.orderId, o.id));

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
    })
  );

  return res.json(ordersWithItems);
});

router.get("/low-stock", async (req, res) => {
  const medicines = await db
    .select()
    .from(medicinesTable)
    .where(lt(medicinesTable.quantity, 10))
    .orderBy(medicinesTable.quantity);

  return res.json(medicines.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    quantity: m.quantity,
    price: parseFloat(String(m.price)),
    expiryDate: m.expiryDate,
    status: m.quantity === 0 ? "out_of_stock" : "low",
    createdAt: m.createdAt.toISOString(),
  })));
});

export default router;
