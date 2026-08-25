import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import suppliersRouter from "./suppliers";
import invoicesRouter from "./invoices";
import purchaseOrdersRouter from "./purchase-orders";
import purchaseItemMasterRouter from "./purchase-item-master";
import quotationsRouter from "./quotations";
import panelsRouter from "./panels";
import techSpecItemsRouter from "./tech-spec-items";
import categoriesRouter from "./categories";
import subCategoriesRouter from "./sub-categories";
import itemsRouter from "./items";
import itemMasterImportRouter from "./item-master-import";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();

// Public — no session required
router.use(healthRouter);
router.use(authRouter);

// Everything below requires a valid session
router.use(requireAuth);

router.use(clientsRouter);
router.use(suppliersRouter);
router.use(invoicesRouter);
router.use(purchaseOrdersRouter);
router.use(purchaseItemMasterRouter);
router.use(quotationsRouter);
router.use(panelsRouter);
router.use(techSpecItemsRouter);
router.use(categoriesRouter);
router.use(subCategoriesRouter);
router.use(itemsRouter);
router.use(itemMasterImportRouter);

export default router;
