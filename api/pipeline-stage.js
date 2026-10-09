// Vercel Serverless Function: POST /api/pipeline-stage
import { generatePipelineStage, parsePipelineJson } from "../server/modelProviders.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const stage = String(body?.stage || "").trim();
    const input = String(body?.input || "").trim();

    if (!stage) {
      return res.status(400).json({ message: "缺少流水线阶段参数 stage。" });
    }

    const contextPackage = {
      tenant: {
        id: String(body?.tenant?.id || ""),
        name: String(body?.tenant?.name || ""),
        businessUnitName: String(body?.tenant?.businessUnitName || "")
      },
      account: {
        id: String(body?.account?.id || ""),
        name: String(body?.account?.name || ""),
        platform: String(body?.account?.platform || ""),
        stage: String(body?.account?.stage || "")
      },
      role: {
        id: String(body?.role?.id || ""),
        title: String(body?.role?.title || "")
      },
      sessionMaterials: String(body?.sessionMaterials || "").slice(0, 6000),
      userInput: String(body?.userInput || "").slice(0, 2000)
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
      const result = await generatePipelineStage({
        env: process.env,
        stage,
        input,
        contextPackage,
        signal: controller.signal
      });

      const parsed = parsePipelineJson(result.content);

      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json({
        stage,
        output: parsed,
        rawText: result.content,
        model: result.model
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const status = error.statusCode || 502;
    const message = error.name === "AbortError"
      ? "模型请求超时，请稍后重试。"
      : error.message || "生成失败，请稍后再试。";
    return res.status(status).json({ message });
  }
}
