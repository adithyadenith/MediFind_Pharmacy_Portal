import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import medicinesRouter from "./medicines";
import ordersRouter from "./orders";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/medicines", medicinesRouter);
router.use("/orders", ordersRouter);
router.use("/dashboard", dashboardRouter);

export default router;
