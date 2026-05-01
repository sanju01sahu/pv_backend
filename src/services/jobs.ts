import cron from "node-cron";
import { bonusesService } from "../modules/bonuses/bonuses.service.js";

export const registerJobs = () => {
  cron.schedule("5 0 1 * *", async () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const runMonth = month === 0 ? 12 : month;
    const runYear = month === 0 ? year - 1 : year;
    await bonusesService.runMonthlyBonus(runYear, runMonth);
  });
};
