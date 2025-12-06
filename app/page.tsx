"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronRight, Plus } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ConfigDialog } from "@/components/config-dialog"
import { Textarea } from "@/components/ui/textarea"
import { ChatInterface } from "@/components/chat-interface"
import { Toast } from "@/components/toast"
import { Sidebar } from "@/components/sidebar"
import { GeoGebraPanel } from "@/components/geogebra-panel"
import { useAppStore, convertChatMessagesToStore, convertStoreMessagesToChat } from "@/lib/store"
import { useGeoGebraCommands } from "@/hooks/use-geogebra-commands"
import { useGeoGebra } from "@/hooks/use-geogebra"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { logger } from "@/lib/logger"
import Head from "next/head"

// 声明全局类型
declare global {
  interface Window {
    GGBApplet: any
    ggbApplet: any
    ggbAppletReady: boolean
  }
}

export default function ChatPage() {
  // 使用自定义钩子
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const { error, setError, clearError, setTemporaryError, handleError } = useErrorHandler()
  const { extractLatestCommands } = useGeoGebraCommands()
  const { executeCommands } = useGeoGebra()

  // 从store获取状态 - 使用选择器函数避免不必要的重新渲染
  const config = useAppStore((state) => state.config)
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const showGeogebra = useAppStore((state) => state.showGeogebra)

  // 本地UI状态
  const [configOpen, setConfigOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 获取当前对话的消息 - 使用选择器避免不必要的重新渲染
  const currentMessages = useAppStore((state) => state.messages[activeConversationId] || [])

  // 使用useMemo缓存初始消息和配置,避免每次渲染都创建新对象
  // 注意: 只在 activeConversationId 改变时重新计算,而不是每次 currentMessages 改变时
  const initialMessages = useMemo(() => {
    const messages = useAppStore.getState().messages[activeConversationId] || []
    return convertStoreMessagesToChat(messages)
  }, [activeConversationId])

  const chatConfig = useMemo(
    () => ({
      configSettings: config,
    }),
    [config],
  )

  // 回调函数
  const onResponse = useCallback(
    (response: Response) => {
      clearError()

      if (!response.ok) {
        response
          .json()
          .then((data) => {
            handleError(data.error || "请求处理失败，请检查API密钥和网络连接")
          })
          .catch((err) => {
            handleError(err, "请求处理失败，请检查API密钥和网络连接")
          })
      }
    },
    [clearError, handleError],
  )

  const onFinish = useCallback(
    (message: any) => {
      logger.info("聊天完成", { messageLength: message.content.length })
    },
    [],
  )

  const onError = useCallback(
    (error: Error) => {
      handleError(error)
    },
    [handleError],
  )

  // 初始化聊天钩子 - 使用 key 强制重新初始化
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error: chatError,
  } = useChat({
    key: activeConversationId, // 关键: 使用 key 确保切换对话时重新初始化
    id: activeConversationId,
    api: "/api/chat",
    body: chatConfig,
    initialMessages,
    onResponse,
    onFinish,
    onError,
  })

  // 同步 useChat 的消息到 store
  useEffect(() => {
    if (messages.length > 0) {
      const storeMessages = convertChatMessagesToStore(messages)
      const currentStoreMessages = useAppStore.getState().messages[activeConversationId] || []
      
      // 只有当消息数量或最后一条消息内容不同时才更新
      if (storeMessages.length !== currentStoreMessages.length || 
          (storeMessages.length > 0 && currentStoreMessages.length > 0 &&
           storeMessages[storeMessages.length - 1].content !== currentStoreMessages[currentStoreMessages.length - 1].content)) {
        useAppStore.getState().setMessages(activeConversationId, storeMessages)
      }
    }
  }, [messages, activeConversationId])

  // 处理聊天错误
  useEffect(() => {
    if (chatError) {
      handleError(chatError)
    }
  }, [chatError, handleError])

  // 当activeConversationId变化时，重置错误状态
  useEffect(() => {
    clearError()
  }, [activeConversationId, clearError])

  // 当用户提交消息时，更新store中的对话标题
  useEffect(() => {
    if (messages.length > 0 && messages[0].role === "user") {
      const title = messages[0].content.slice(0, 20) + (messages[0].content.length > 20 ? "..." : "")
      const conversation = conversations.find((c) => c.id === activeConversationId)
      if (conversation && conversation.title !== title) {
        useAppStore.getState().updateConversationTitle(activeConversationId, title)
      }
    }
  }, [messages, activeConversationId, conversations])

  // 自定义提交处理函数
  const handleChatSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim()) return

      clearError()
      logger.info("提交消息", { inputLength: input.length })

      try {
        handleSubmit(e)
      } catch (err) {
        handleError(err)
      }
    },
    [input, clearError, handleSubmit, handleError],
  )

  // 事件处理函数
  const toggleSidebar = useCallback(() => {
    logger.info("切换侧边栏", { 当前状态: sidebarOpen })
    useAppStore.getState().setSidebarOpen(!sidebarOpen)
  }, [sidebarOpen])

  const handleCreateConversation = useCallback(() => {
    if (!isLoading) {
      logger.info("创建新对话")
      useAppStore.getState().createConversation()
    }
  }, [isLoading])

  const handleSetShowGeogebra = useCallback((show: boolean) => {
    logger.info("设置显示GeoGebra", { show })
    useAppStore.getState().setShowGeogebra(show)
  }, [])

  const handleSetActiveConversation = useCallback((id: string) => {
    logger.info("设置活动对话", { id })
    useAppStore.getState().setActiveConversation(id)
  }, [])

  const handleDeleteConversation = useCallback((id: string) => {
    logger.info("删除对话", { id })
    useAppStore.getState().deleteConversation(id)
  }, [])

  // 执行最新消息中的所有GeoGebra命令
  const executeLatestCommands = useCallback(() => {
    const commands = extractLatestCommands(messages)

    if (commands.length === 0) {
      setTemporaryError("没有找到GeoGebra命令")
      return
    }

    logger.info("执行最新消息中的GeoGebra命令", { commandCount: commands.length })
    executeCommands(commands)
    setTemporaryError(`已执行${commands.length}条GeoGebra命令`)
  }, [messages, extractLatestCommands, executeCommands, setTemporaryError])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta charSet="utf-8" />
      </Head>
      <div className="flex h-screen bg-background">
        {/* Config Dialog */}
        <ConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          onSave={() => setSaveSuccess(true)}
        />

        {/* Sidebar for conversations */}
        {isDesktop && sidebarOpen && (
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onCreateConversation={handleCreateConversation}
            onDeleteConversation={handleDeleteConversation}
            onSelectConversation={handleSetActiveConversation}
            onToggleSidebar={toggleSidebar}
            onOpenConfig={() => setConfigOpen(true)}
            isLoading={isLoading}
          />
        )}

        {isDesktop && !sidebarOpen && (
          <div className="w-10 flex-shrink-0 flex items-center justify-center border-r">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-none"
              onClick={toggleSidebar}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">展开侧栏</span>
            </Button>
          </div>
        )}

        {/* Main content area with chat and GeoGebra */}
        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Chat section */}
          {isDesktop && !showGeogebra && (
            <Button
              variant="outline"
              className="absolute top-4 right-4 z-10"
              onClick={() => handleSetShowGeogebra(true)}
            >
              显示 GeoGebra
            </Button>
          )}
          <div
            className={`${
              isDesktop && showGeogebra ? "lg:w-[50%]" : "w-full"
            } flex flex-row relative`}
          >
            {/* Mobile view tabs */}
            <div className="lg:hidden w-full">
              <Tabs defaultValue="chat" className="w-full">
                <div className="flex items-center p-2 border-b">
                  <TabsList className="flex-1">
                    <TabsTrigger value="chat">对话</TabsTrigger>
                    <TabsTrigger value="settings">设置</TabsTrigger>
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCreateConversation}
                    disabled={isLoading}
                    className="ml-2"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <TabsContent
                  value="chat"
                  className="h-[calc(100vh-112px)] flex flex-col"
                >
                  <ChatInterface
                    messages={messages}
                    input={input}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleChatSubmit}
                    isLoading={isLoading}
                    error={error}
                    onExecuteCommands={executeCommands}
                  />
                </TabsContent>

                <TabsContent
                  value="settings"
                  className="h-[calc(100vh-112px)] p-4"
                >
                  <div className="space-y-4">
                    <h3 className="text-xl font-medium">设置</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">模型类型</label>
                        <select
                          className="w-full p-2 bg-background border rounded-md"
                          value={config.modelType}
                          onChange={(e) =>
                            useAppStore
                              .getState()
                              .updateConfig({ modelType: e.target.value })
                          }
                        >
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          <option value="claude-3-opus">Claude 3 Opus</option>
                          <option value="claude-3-sonnet">
                            Claude 3 Sonnet
                          </option>
                          <option value="claude-3-haiku">Claude 3 Haiku</option>
                          <option value="deepseek-chat">DeepSeek Chat</option>
                          <option value="deepseek-coder">DeepSeek Coder</option>
                          <option value="llama-3">Llama 3</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          OpenAI API 密钥
                        </label>
                        <input
                          type="password"
                          value={config.apiKeys.openai || ""}
                          onChange={(e) =>
                            useAppStore
                              .getState()
                              .updateApiKey("openai", e.target.value)
                          }
                          placeholder="输入 OpenAI API 密钥"
                          className="w-full p-2 bg-background border rounded-md"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Anthropic API 密钥
                        </label>
                        <input
                          type="password"
                          value={config.apiKeys.anthropic || ""}
                          onChange={(e) =>
                            useAppStore
                              .getState()
                              .updateApiKey("anthropic", e.target.value)
                          }
                          placeholder="输入 Anthropic API 密钥"
                          className="w-full p-2 bg-background border rounded-md"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          DeepSeek API 密钥
                        </label>
                        <input
                          type="password"
                          value={config.apiKeys.deepseek || ""}
                          onChange={(e) =>
                            useAppStore
                              .getState()
                              .updateApiKey("deepseek", e.target.value)
                          }
                          placeholder="输入 DeepSeek API 密钥"
                          className="w-full p-2 bg-background border rounded-md"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          系统提示词
                        </label>
                        <Textarea
                          value={config.systemPrompt}
                          onChange={(e) =>
                            useAppStore
                              .getState()
                              .updateConfig({ systemPrompt: e.target.value })
                          }
                          placeholder="输入系统提示词，定义AI助手的行为和知识范围"
                          className="min-h-[100px]"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSaveSuccess(true);
                          setTimeout(() => setSaveSuccess(false), 3000);
                        }}
                      >
                        保存设置
                      </Button>
                      {saveSuccess && (
                        <div className="mt-2 p-2 bg-green-100 text-green-800 rounded-md text-center">
                          设置已成功保存
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop chat interface */}
            <div className="flex-1 hidden lg:flex flex-col">
              <ChatInterface
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleChatSubmit}
                isLoading={isLoading}
                onOpenConfig={() => setConfigOpen(true)}
                error={error}
                onExecuteCommands={executeCommands}
              />
            </div>
          </div>

          {/* GeoGebra section (desktop only) */}
          {isDesktop && showGeogebra && (
            <GeoGebraPanel
              onHide={() => handleSetShowGeogebra(false)}
              onExecuteLatestCommands={executeLatestCommands}
            />
          )}
        </div>
        {saveSuccess && (
          <Toast variant="success" position="top">
            设置已成功保存
          </Toast>
        )}
        {error && (
          <Toast
            variant="error"
            position="top"
            open={!!error}
            onClose={clearError}
          >
            {error}
          </Toast>
        )}
      </div>
    </>
  );
}

