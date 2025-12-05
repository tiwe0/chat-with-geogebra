import { openai, createOpenAI } from "@ai-sdk/openai"
import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { deepseek, createDeepSeek } from "@ai-sdk/deepseek"
import { streamText, type CoreMessage, StreamData, createDataStreamResponse } from "ai"
import type { ConfigSettings } from "@/lib/store"

interface ChatRequest {
  messages: CoreMessage[]
  configSettings: ConfigSettings
  conversationId?: string
}

// ZZSeek API 流式响应处理
async function callZZSeekAPI(request: ChatRequest) {
  const { messages, configSettings, conversationId } = request
  
  const apiKey = configSettings?.apiKeys?.zzseek || ""
  const baseUrl = configSettings?.apiKeys?.zzseekBaseUrl || "https://api.dify.ai/v1"
  
  if (!apiKey) {
    throw new Error("需要 ZZSeek API 密钥，请在设置中配置")
  }

  // 获取最后一条用户消息
  const lastUserMessage = messages.filter(m => m.role === "user").pop()
  if (!lastUserMessage) {
    throw new Error("没有找到用户消息")
  }

  // 构建请求体
  const requestBody: any = {
    inputs: {},
    query: typeof lastUserMessage.content === 'string' 
      ? lastUserMessage.content 
      : JSON.stringify(lastUserMessage.content),
    response_mode: "streaming",
    user: "user-" + Date.now(),
  }

  // 如果有对话 ID，添加到请求中
  if (conversationId) {
    requestBody.conversation_id = conversationId
  }

  const response = await fetch(`${baseUrl}/chat-messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ZZSeek API 错误: ${response.status} - ${errorText}`)
  }

  // 将 ZZSeek/Dify SSE 流转换为兼容格式
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      
      if (!reader) {
        controller.close()
        return
      }

      try {
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          
          // 保留最后一个可能不完整的行
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue

            const data = line.slice(6) // 移除 'data: ' 前缀
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              
              // ZZSeek/Dify 返回格式处理 - 只处理包含实际文本内容的事件
              if (json.event === 'message' && json.answer) {
                // 使用 AI SDK 的数据流格式: "0:" + JSON.stringify(text) + "\n"
                controller.enqueue(encoder.encode(`0:${JSON.stringify(json.answer)}\n`))
              } else if (json.event === 'agent_message' && json.answer) {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(json.answer)}\n`))
              } else if (json.event === 'message_end' && json.answer) {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(json.answer)}\n`))
              }
              // 忽略其他事件类型如: node_started, node_finished, workflow_started 等
            } catch (e) {
              // 忽略解析错误,这些可能是系统事件
            }
          }
        }
      } catch (error) {
        controller.error(error)
      } finally {
        controller.close()
      }
    }
  })

  // 返回与 streamText 兼容的响应对象
  return {
    toTextStreamResponse: () => new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      }
    })
  }
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

  // 如果是 ZZSeek 模型，使用特殊处理
  if (modelType === "zzseek") {
    return callZZSeekAPI(request)
  }

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
