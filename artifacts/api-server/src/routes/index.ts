import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import quotationsRouter from "./quotations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(invoicesRouter);
router.use(quotationsRouter);

export default router;
