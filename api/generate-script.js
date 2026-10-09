// Vercel Serverless Function: POST /api/generate-script
import { generateForRole } from "../server/modelProviders.mjs";

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
    const contextPackage = buildContextPackage(body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
      const providerId = normalizeProviderId(
        (body?.role?.modelProvider) || "deepseek"
      );

      const result = await generateForRole({
        env: process.env,
        contextPackage,
        signal: controller.signal,
        providerId
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json({
        content: result.content,
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

function buildContextPackage(body) {
  const tenant = body?.tenant || {};
  const account = body?.account || {};
  const role = body?.role || {};
  const requestText = String(body?.requestText || "").trim();

  if (!tenant.id || !account.id || !role.id || !requestText) {
    const error = new Error("请先选择服务商家、运营账号和负责岗位，并填写任务需求。");
    error.statusCode = 400;
    throw error;
  }

  if (requestText.length > 2000) {
    const error = new Error("任务需求太长，请先压缩到 2000 字以内。");
    error.statusCode = 400;
    throw error;
  }

  return {
    actorRole: normalizeActorRole(body?.actorRole),
    tenant: {
      id: String(tenant.id),
      name: String(tenant.name || ""),
      businessUnitName: String(tenant.businessUnitName || "")
    },
    account: {
      id: String(account.id),
      name: String(account.name || ""),
      platform: String(account.platform || ""),
      stage: String(account.stage || "")
    },
    role: {
      id: String(role.id),
      title: String(role.title || ""),
      shortDuty: String(role.shortDuty || ""),
      forbidden: Array.isArray(role.forbidden)
        ? role.forbidden.filter((item) => typeof item === "string").slice(0, 8)
        : [],
      publishedVersion: String(role.publishedVersion || ""),
      publishedSummary: String(role.publishedSummary || ""),
      sessionMaterials: String(role.sessionMaterials || "").slice(0, 6000),
      recentMessages: Array.isArray(role.recentMessages)
        ? role.recentMessages.slice(-6).map((msg) => ({
            from: String(msg.from || "admin"),
            text: String(msg.text || "").slice(0, 600)
          }))
        : []
    },
    requestText,
    videoFrames: Array.isArray(body?.role?.videoFrames)
      ? body.role.videoFrames.filter(Boolean).slice(0, 5)
      : []
  };
}

function normalizeActorRole(value) {
  if (value === "admin" || value === "agent" || value === "store") return value;
  return "store";
}

function normalizeProviderId(value) {
  return value === "doubao" ? "doubao" : "deepseek";
}
