import { commissionsService } from "../commissions/commissions.service.js";

export const bonusesService = {
  runMonthlyBonus: commissionsService.runMonthlyBonus
};
