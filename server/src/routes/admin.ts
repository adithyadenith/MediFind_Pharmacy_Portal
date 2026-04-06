import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, usersTable } from "../db";

const router = Router();

function requireAdminApiKey(req: any, res: any, next: any) {
  const expectedApiKey = process.env.ADMIN_PORTAL_API_KEY;
  if (!expectedApiKey) {
    return res.status(503).json({ error: "Admin approval API is not configured" });
  }

  const authorizationHeader = req.get("authorization");
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : null;
  const headerApiKey = req.get("x-admin-api-key");
  const providedApiKey = bearerToken || headerApiKey;

  if (providedApiKey !== expectedApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

router.use(requireAdminApiKey);

router.get("/pharmacies", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const baseQuery = db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      pharmacyName: usersTable.pharmacyName,
      address: usersTable.address,
      contactNumber: usersTable.contactNumber,
      databaseUrl: usersTable.databaseUrl,
      emailVerified: usersTable.emailVerified,
      status: usersTable.status,
      approvalStatus: usersTable.approvalStatus,
      approvedAt: usersTable.approvedAt,
      approvedBy: usersTable.approvedBy,
      rejectionReason: usersTable.rejectionReason,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable);

  const pharmacies = status
    ? await baseQuery.where(eq(usersTable.approvalStatus, status)).orderBy(desc(usersTable.createdAt))
    : await baseQuery.orderBy(desc(usersTable.createdAt));
  return res.json(pharmacies);
});

router.post("/pharmacies/:id/approve", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  if (Number.isNaN(pharmacyId) || pharmacyId <= 0) {
    return res.status(400).json({ error: "Invalid pharmacy id" });
  }

  const approvedBy =
    typeof req.body?.approvedBy === "string" && req.body.approvedBy.trim().length
      ? req.body.approvedBy.trim()
      : "admin-portal";

  const [updated] = await db
    .update(usersTable)
    .set({
      status: "approved",
      approvalStatus: "approved",
      approvedAt: new Date(),
      approvedBy,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, pharmacyId))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      status: usersTable.status,
      approvalStatus: usersTable.approvalStatus,
      approvedAt: usersTable.approvedAt,
      approvedBy: usersTable.approvedBy,
    });

  if (!updated) {
    return res.status(404).json({ error: "Pharmacy not found" });
  }

  return res.json(updated);
});

router.post("/pharmacies/:id/reject", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  if (Number.isNaN(pharmacyId) || pharmacyId <= 0) {
    return res.status(400).json({ error: "Invalid pharmacy id" });
  }

  const rejectionReason =
    typeof req.body?.reason === "string" && req.body.reason.trim().length
      ? req.body.reason.trim()
      : "Registration was rejected by an administrator";

  const approvedBy =
    typeof req.body?.rejectedBy === "string" && req.body.rejectedBy.trim().length
      ? req.body.rejectedBy.trim()
      : "admin-portal";

  const [updated] = await db
    .update(usersTable)
    .set({
      status: "rejected",
      approvalStatus: "rejected",
      approvedAt: null,
      approvedBy,
      rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, pharmacyId))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      status: usersTable.status,
      approvalStatus: usersTable.approvalStatus,
      approvedBy: usersTable.approvedBy,
      rejectionReason: usersTable.rejectionReason,
    });

  if (!updated) {
    return res.status(404).json({ error: "Pharmacy not found" });
  }

  return res.json(updated);
});

export default router;
