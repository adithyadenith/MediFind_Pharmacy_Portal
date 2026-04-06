import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { db, otpCodesTable, usersTable } from "../db";
import { and, eq, gt } from "drizzle-orm";
import { Resend } from "resend";

const router = Router();
const scrypt = promisify(scryptCallback);
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type OtpPurpose = "register" | "reset";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const derivedBuffer = Buffer.from(derived);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (derivedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(derivedBuffer, storedBuffer);
}

async function sendOtpEmail(email: string, otp: string, title: string, description: string) {
  if (!resend || !resendFromEmail) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  const result = await resend.emails.send({
    from: resendFromEmail,
    to: email,
    subject: title,
    text: `${description} Your MediFind verification code is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 16px;">${title}</h2>
        <p style="margin: 0 0 12px;">${description}</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.3em; margin: 16px 0;">${otp}</p>
        <p style="margin: 12px 0 0;">This code expires in 10 minutes.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message || "Resend failed to send the OTP email.");
  }
}

function getEmailDeliveryErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to send verification email";

  if (message.toLowerCase().includes("domain is not verified")) {
    return {
      status: 400,
      error:
        "Resend cannot send from this address because the sender domain is not verified. Use an email on your verified domain instead of gmail.com.",
    };
  }

  if (message.toLowerCase().includes("domain mismatch")) {
    return {
      status: 400,
      error:
        "Resend sender address does not match your verified domain. Set RESEND_FROM_EMAIL to an address on your verified domain.",
    };
  }

  return {
    status: 500,
    error: message || "Failed to send verification email",
  };
}

async function storeOtp(input: {
  email: string;
  code: string;
  purpose: OtpPurpose;
  pharmacyName?: string;
  address?: string;
  contactNumber?: string;
  databaseUrl?: string;
  pendingPasswordHash?: string;
}) {
  await db.delete(otpCodesTable).where(
    and(eq(otpCodesTable.email, input.email), eq(otpCodesTable.purpose, input.purpose))
  );

  await db.insert(otpCodesTable).values({
    ...input,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
}

async function findValidOtp(email: string, otp: string, purpose: OtpPurpose) {
  const records = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.email, email),
        eq(otpCodesTable.code, otp),
        eq(otpCodesTable.purpose, purpose),
        gt(otpCodesTable.expiresAt, new Date())
      )
    )
    .limit(1);

  return records[0] ?? null;
}

function setAuthenticatedSession(req: any, user: { id: number; email: string }) {
  req.session.userId = user.id;
  req.session.email = user.email;
}

router.post("/register/send-otp", async (req, res) => {
  const {
    pharmacyName,
    address,
    contactNumber,
    databaseUrl,
    email,
    password,
    confirmPassword,
  } = req.body ?? {};
  if (!pharmacyName || !address || !contactNumber || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: "All registration fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  if (existing[0]?.emailVerified) {
    return res.status(400).json({ error: "This pharmacy email is already registered" });
  }

  const otp = generateOtp();
  const pendingPasswordHash = await hashPassword(password);

  await storeOtp({
    email: normalizedEmail,
    code: otp,
    purpose: "register",
    pharmacyName,
    address,
    contactNumber,
    databaseUrl: typeof databaseUrl === "string" && databaseUrl.trim().length ? databaseUrl.trim() : undefined,
    pendingPasswordHash,
  });

  try {
    await sendOtpEmail(
      normalizedEmail,
      otp,
      "Confirm your MediFind pharmacy account",
      "Use the verification code below to confirm your pharmacy email address."
    );
  } catch (error) {
    await db.delete(otpCodesTable).where(
      and(eq(otpCodesTable.email, normalizedEmail), eq(otpCodesTable.purpose, "register"))
    );
    req.log.error({ err: error, email: normalizedEmail }, "Failed to send registration OTP email");
    const response = getEmailDeliveryErrorResponse(error);
    return res.status(response.status).json({ error: response.error });
  }

  return res.json({ message: `Verification code sent to ${normalizedEmail}` });
});

router.post("/register/verify-otp", async (req, res) => {
  const { email, otp } = req.body ?? {};
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const otpRecord = await findValidOtp(normalizedEmail, otp, "register");
  if (!otpRecord || !otpRecord.pendingPasswordHash || !otpRecord.pharmacyName || !otpRecord.address || !otpRecord.contactNumber) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);

  let user;
  if (existing.length) {
    const [updated] = await db
      .update(usersTable)
      .set({
        pharmacyName: otpRecord.pharmacyName,
        address: otpRecord.address,
        contactNumber: otpRecord.contactNumber,
        databaseUrl: otpRecord.databaseUrl,
        passwordHash: otpRecord.pendingPasswordHash,
        emailVerified: true,
        status: "pending",
        approvalStatus: "pending",
        approvedAt: null,
        approvedBy: null,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing[0].id))
      .returning();
    user = updated;
  } else {
    const [created] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        pharmacyName: otpRecord.pharmacyName,
        address: otpRecord.address,
        contactNumber: otpRecord.contactNumber,
        databaseUrl: otpRecord.databaseUrl,
        passwordHash: otpRecord.pendingPasswordHash,
        emailVerified: true,
        status: "pending",
        approvalStatus: "pending",
      })
      .returning();
    user = created;
  }

  await db.delete(otpCodesTable).where(
    and(eq(otpCodesTable.email, normalizedEmail), eq(otpCodesTable.purpose, "register"))
  );

  return res.json({
    id: user.id,
    email: user.email,
    status: user.status,
    approvalStatus: user.approvalStatus,
    message: "Email verified. Your pharmacy is pending admin approval before you can sign in.",
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  const user = existing[0];

  if (!user || !user.emailVerified || !user.passwordHash) {
    return res.status(404).json({ error: "This is not a registered pharmacy" });
  }

  if (user.status === "pending" || user.approvalStatus === "pending") {
    return res.status(403).json({ error: "Your pharmacy registration is awaiting admin approval" });
  }

  if (user.status === "rejected" || user.approvalStatus === "rejected") {
    return res.status(403).json({
      error: user.rejectionReason || "Your pharmacy registration was rejected by an administrator",
    });
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({ error: "Incorrect password" });
  }

  setAuthenticatedSession(req, user);
  return res.json({ id: user.id, email: user.email });
});

router.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  if (!existing[0]?.emailVerified) {
    return res.status(404).json({ error: "This is not a registered pharmacy" });
  }

  const otp = generateOtp();
  await storeOtp({ email: normalizedEmail, code: otp, purpose: "reset" });

  try {
    await sendOtpEmail(
      normalizedEmail,
      otp,
      "Reset your MediFind password",
      "Use the verification code below to reset your pharmacy password."
    );
  } catch (error) {
    await db.delete(otpCodesTable).where(
      and(eq(otpCodesTable.email, normalizedEmail), eq(otpCodesTable.purpose, "reset"))
    );
    req.log.error({ err: error, email: normalizedEmail }, "Failed to send reset OTP email");
    const response = getEmailDeliveryErrorResponse(error);
    return res.status(response.status).json({ error: response.error });
  }

  return res.json({ message: `Password reset code sent to ${normalizedEmail}` });
});

router.post("/forgot-password/reset", async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body ?? {};
  if (!email || !otp || !password || !confirmPassword) {
    return res.status(400).json({ error: "Email, OTP, password and confirmPassword are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  const user = existing[0];
  if (!user?.emailVerified) {
    return res.status(404).json({ error: "This is not a registered pharmacy" });
  }

  const otpRecord = await findValidOtp(normalizedEmail, otp, "reset");
  if (!otpRecord) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await db.delete(otpCodesTable).where(
    and(eq(otpCodesTable.email, normalizedEmail), eq(otpCodesTable.purpose, "reset"))
  );

  return res.json({ message: "Password updated successfully" });
});

router.get("/me", async (req, res) => {
  if (process.env.NODE_ENV !== "production") {
    return res.json({
      id: 1,
      email: "test@medifindsdgp.com",
      pharmacyName: "MediFind Admin",
      address: "123 Test Ave",
      contactNumber: "+94771234567",
      databaseUrl: "",
      status: "approved",
      approvalStatus: "approved",
    });
  }
  const session = req.session as any;
  if (!session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  const user = existing[0];

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    pharmacyName: user.pharmacyName,
    address: user.address,
    contactNumber: user.contactNumber,
    databaseUrl: user.databaseUrl,
    status: user.status,
    approvalStatus: user.approvalStatus,
  });
});

router.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Error destroying session");
    }
  });
  return res.json({ message: "Logged out successfully" });
});

export default router;
