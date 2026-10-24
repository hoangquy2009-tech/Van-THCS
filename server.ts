import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Thứ tự ưu tiên mô hình theo yêu cầu:
// gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.1-pro -> gemini-3.5-flash
// -> gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> gemini-2.5-pro -> gemini-2.5-flash
// -> gemini-2.5-flash-lite -> gemini-3-flash -> gemini-2-flash -> gemini-2-flash-lite
const MODELS_PRIORITY = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.1-pro",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-2-flash",
  "gemini-2-flash-lite"
];

// Ánh xạ tên mô hình sang định danh SDK hợp lệ nếu cần
function resolveModelId(model: string): string {
  if (model === "gemini-3.1-pro") {
    return "gemini-3.1-pro-preview";
  }
  return model;
}

// Ngưỡng ký tự tối thiểu để kích hoạt Context Caching (~32k token)
const CACHE_CHAR_THRESHOLD = 110000;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Hỗ trợ nội dung văn bản / tài liệu lớn
  app.use(express.json({ limit: '50mb' }));

  // API tạo đề thi tự động với Fallback Array & Context Caching Engine
  app.post("/api/generate-exam", async (req, res) => {
    const { userPrompt, systemPrompt } = req.body;
    
    if (!userPrompt || !systemPrompt) {
      return res.status(400).json({ error: "Thiếu dữ liệu prompt đầu vào." });
    }

    const inputCharCount = (userPrompt?.length || 0) + (systemPrompt?.length || 0);
    const logs: string[] = [];
    
    console.log(`[API] Bắt đầu xử lý. Tổng dung lượng đầu vào: ${inputCharCount.toLocaleString()} ký tự.`);
    logs.push(`[Đánh giá dung lượng] Đầu vào: ${inputCharCount.toLocaleString()} ký tự. (Ngưỡng Cache: > ${CACHE_CHAR_THRESHOLD.toLocaleString()} ký tự)`);

    // Vòng lặp try-catch duyệt qua mảng các mô hình ưu tiên
    for (const model of MODELS_PRIORITY) {
      const targetModel = resolveModelId(model);
      try {
        logs.push(`Đang thử mô hình: ${model}...`);
        console.log(`[API] Đang thử mô hình: ${model} (${targetModel})`);

        let cachedContentName: string | undefined = undefined;

        // 2. Trí tuệ Tối ưu Hóa (Context Caching Engine)
        // Nếu Text quá dài (> 110.000 ký tự), gọi caches.create() với TTL 3600s (1 giờ)
        if (inputCharCount > CACHE_CHAR_THRESHOLD) {
          try {
            logs.push(`[Context Caching] Nội dung > 110.000 ký tự. Đang kích hoạt caches.create() cho ${targetModel} (TTL: 3600s)...`);
            console.log(`[Context Caching] Creating context cache for model ${targetModel}...`);

            const cache = await ai.caches.create({
              model: targetModel,
              config: {
                displayName: `exam_cache_${Date.now()}`,
                ttl: "3600s",
                contents: [
                  {
                    role: "user",
                    parts: [{ text: userPrompt }]
                  }
                ],
                systemInstruction: systemPrompt ? {
                  role: "user",
                  parts: [{ text: systemPrompt }]
                } : undefined
              }
            });

            if (cache && cache.name) {
              cachedContentName = cache.name;
              logs.push(`[Context Caching] Cache thành công với ID: ${cachedContentName}. Rẽ nhánh: Chỉ gửi lệnh rút gọn.`);
              console.log(`[Context Caching] Cache created: ${cachedContentName}`);
            }
          } catch (cacheError: any) {
            const cErrorMsg = cacheError.message || String(cacheError);
            logs.push(`[Context Caching] Setup cache không thành công (${cErrorMsg}). Rẽ nhánh: Trở về chế độ bắn Nhắc đầy đủ truyền thống.`);
            console.warn(`[Context Caching] Cache creation failed for ${targetModel}:`, cErrorMsg);
            cachedContentName = undefined;
          }
        } else {
          logs.push(`Dung lượng tệp/lệnh (${inputCharCount.toLocaleString()} ký tự) <= 110.000 ký tự. Áp dụng chế độ bắn Nhắc đầy đủ truyền thống.`);
        }

        // Rẽ nhánh Gọi mô hình (Call Branching):
        let contentsToSend: any;
        let configToSend: any;

        if (cachedContentName) {
          // If Cache thành công: nội dung gửi chỉ còn là một câu cực ngắn "Hãy sinh kết quả dựa trên Cache", đính kèm cachedContent ID
          contentsToSend = "Hãy sinh kết quả dựa trên Cache";
          configToSend = {
            cachedContent: cachedContentName,
            temperature: 0.2,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 8192,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            responseMimeType: "application/json"
          };
        } else {
          // If Cache failed / Dung lượng tệp nhỏ: Trở về chế độ bắn Nhắc đầy đủ theo cách truyền thống
          contentsToSend = userPrompt;
          configToSend = {
            temperature: 0.2,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 8192,
            systemInstruction: systemPrompt,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            responseMimeType: "application/json"
          };
        }

        let response;
        try {
          response = await ai.models.generateContent({
            model: targetModel,
            contents: contentsToSend,
            config: configToSend
          });
        } catch (genError: any) {
          // Nếu gọi qua cache bị lỗi tương thích, dự phòng gọi lại bằng prompt đầy đủ cho model này
          if (cachedContentName) {
            console.warn(`[API] Gọi qua Cache lỗi (${genError.message}). Thử lại chế độ truyền thống cho ${targetModel}...`);
            logs.push(`Gọi qua Cache bị từ chối. Thử lại với prompt đầy đủ trên ${targetModel}...`);
            response = await ai.models.generateContent({
              model: targetModel,
              contents: userPrompt,
              config: {
                temperature: 0.2,
                topK: 20,
                topP: 0.8,
                maxOutputTokens: 8192,
                systemInstruction: systemPrompt,
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
                responseMimeType: "application/json"
              }
            });
          } else {
            throw genError;
          }
        }

        logs.push(`Thành công sinh nội dung bằng mô hình: ${model}`);
        console.log(`[API] Thành công sử dụng mô hình: ${model}`);

        return res.json({ 
          text: response.text, 
          modelUsed: model,
          cacheUsed: Boolean(cachedContentName),
          cacheId: cachedContentName || null,
          charCount: inputCharCount,
          logs: logs
        });
        
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        logs.push(`Mô hình ${model} báo lỗi (${errorMsg}). Tự động chuyển mượt sang mô hình kế tiếp.`);
        console.warn(`[API] Cảnh báo: Mô hình ${model} báo lỗi (${errorMsg}). Chuyển sang mô hình tiếp theo trong danh sách ưu tiên.`);
        // Tiếp tục thử mô hình kế tiếp trong mảng for...of mà không làm gián đoạn trải nghiệm người dùng
      }
    }

    // Nếu đã duyệt hết tất cả các mô hình mà vẫn gặp sự cố
    const finalError = "Tất cả các mô hình trong danh sách ưu tiên đều không thể hoàn thành yêu cầu.";
    logs.push(finalError);
    console.error(`[API] ${finalError}`);
    return res.status(500).json({ error: finalError, logs: logs });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
