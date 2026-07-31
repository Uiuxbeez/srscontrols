import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import quotationsRouter from "./quotations";
import panelsRouter from "./panels";
import techSpecItemsRouter from "./tech-spec-items";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(invoicesRouter);
router.use(quotationsRouter);
router.use(panelsRouter);
router.use(techSpecItemsRouter);

export default router;
