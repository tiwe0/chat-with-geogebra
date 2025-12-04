import { openai, createOpenAI } from "@ai-sdk/openai"
import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { deepseek, createDeepSeek } from "@ai-sdk/deepseek"
import { streamText, type CoreMessage } from "ai"
import type { ConfigSettings } from "@/lib/store"

interface ChatRequest {
  messages: CoreMessage[]
  configSettings: ConfigSettings
}

export async function callChatAPI(request: ChatRequest) {
  const { messages, configSettings } = request
  
  console.debug("Chat API: 处理请求", {
    messageCount: messages.length,
    modelType: configSettings?.modelType,
  })

  const modelType = configSettings?.modelType || "gpt-4o"
  const systemPrompt = configSettings?.systemPrompt || 
    "你是一个专注于数学和GeoGebra的助手。帮助用户理解数学概念并使用GeoGebra进行可视化。"

  // 获取对应模型的API密钥
  let apiKey = ""
  if (modelType.startsWith("claude")) {
    apiKey = configSettings?.apiKeys?.anthropic || ""
  } else if (modelType.startsWith("deepseek")) {
    apiKey = configSettings?.apiKeys?.deepseek || ""
  } else {
    apiKey = configSettings?.apiKeys?.openai || ""
  }

  if (!apiKey) {
    const errorMessage = modelType.startsWith("claude")
      ? "需要 Anthropic API 密钥"
      : modelType.startsWith("deepseek")
      ? "需要 DeepSeek API 密钥"
      : "需要 OpenAI API 密钥"
    throw new Error(`${errorMessage}，请在设置中配置对应模型的 API 密钥`)
  }

  // 初始化模型
  let the_model
  if (modelType.startsWith("claude")) {
    the_model = createAnthropic({ apiKey })
  } else if (modelType.startsWith("deepseek")) {
    the_model = createDeepSeek({ apiKey })
  } else {
    the_model = createOpenAI({ apiKey })
  }

  const model = the_model(modelType)

  // 创建流式响应
  const result = await streamText({
    model,
    system: systemPrompt,
    messages,
  })

  return result
}
