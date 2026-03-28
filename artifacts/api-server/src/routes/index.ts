import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import farmsRouter from "./farms.js";
import animalsRouter from "./animals.js";
import inventoryRouter from "./inventory.js";
import activityRouter from "./activity.js";
import zonesRouter from "./zones.js";
import searchRouter from "./search.js";
import chatRouter from "./chat.js";
import financesRouter from "./finances.js";
import contactsRouter from "./contacts.js";
import seedRouter from "./seed.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(farmsRouter);
router.use(animalsRouter);
router.use(inventoryRouter);
router.use(activityRouter);
router.use(zonesRouter);
router.use(searchRouter);
router.use(chatRouter);
router.use(financesRouter);
router.use(contactsRouter);
router.use(seedRouter);

export default router;
