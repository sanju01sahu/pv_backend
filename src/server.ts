import "dotenv/config";
import { app } from "./app.js";
import { registerJobs } from "./services/jobs.js";

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  registerJobs();
  console.log(`Server running on port ${port}`);
});
