import express from "express";
import { globalRegistry } from "../metrics/registry.js";

const router = express.Router();

router.get("/", async (req, res) => {
    res.set('Content-Type', globalRegistry.contentType);
    res.end(await globalRegistry.metrics());
})
router.get("/123", (req, res)=>{
    res.end("123")
})

export default router;