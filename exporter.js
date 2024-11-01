import 'dotenv/config'
import express from 'express';
import { PORT } from './constants.js'
import { showTitle } from "./utils/showTitle.js";
import routes from "./routes.js";

const app = express();
app.use(routes)
app.listen(PORT, () => {
    showTitle()
    console.log(`Exporter server is running on http://localhost:${PORT}`);
});
