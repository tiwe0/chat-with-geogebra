import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Sun, Moon, Monitor } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/lib/store"
import { useTheme } from "@/components/theme-provider"

export type ApiKeys = {
  openai?: string
  anthropic?: string
  deepseek?: string
  zzseek?: string
  zzseekBaseUrl?: string
}

export type ConfigSettings = {
  modelType: string
  apiKeys: ApiKeys
  systemPrompt: string
}

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "gpt-4", label: "GPT-4", provider: "openai" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "openai" },
  { value: "claude-3-opus", label: "Claude 3 Opus", provider: "anthropic" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet", provider: "anthropic" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku", provider: "anthropic" },
  { value: "deepseek-chat", label: "DeepSeek Chat", provider: "deepseek" },
  { value: "deepseek-coder", label: "DeepSeek Coder", provider: "deepseek" },
  { value: "zzseek", label: "ZZSeek", provider: "zzseek" },
  { value: "llama-3", label: "Llama 3", provider: "openai" },
]

export function ConfigDialog({ open, onOpenChange, onSave }: ConfigDialogProps) {
  // 从 store 获取配置
  const config = useAppStore((state) => state.config)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const updateApiKey = useAppStore((state) => state.updateApiKey)
  
  // 主题相关
  const { theme, setTheme } = useTheme()

  // 本地状态用于表单
  const [localConfig, setLocalConfig] = useState<ConfigSettings>(config)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("model")

  // 当对话框打开或配置更改时，更新本地状态
  useEffect(() => {
    setLocalConfig(config)
  }, [config, open])

  const handleSave = () => {
    console.debug("配置保存:", localConfig)

    // 获取当前选择的模型的提供商
    const selectedModel = MODEL_OPTIONS.find((model) => model.value === localConfig.modelType)
    const provider = selectedModel?.provider || "openai"

    console.debug("当前模型提供商:", { provider, modelType: localConfig.modelType })

    // 检查对应提供商的API密钥是否存在
    if (!localConfig.apiKeys[provider as keyof ApiKeys]) {
      console.debug("API密钥验证失败:", { provider, hasKey: false })
      setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key 是必填项`)
      setActiveTab("keys")
      return
    }

    console.debug("API密钥验证通过:", {
      provider,
      keyLength: localConfig.apiKeys[provider as keyof ApiKeys]?.length || 0,
    })

    // 更新store中的配置
    updateConfig(localConfig)

    // 显示保存成功提示
    setSaveSuccess(true)

    // 调用可选的onSave回调
    if (onSave) onSave()

    // 2秒后关闭对话框
    setTimeout(() => {
      setSaveSuccess(false)
      onOpenChange(false)
    }, 2000)

    setError(null)
  }

  const getCurrentProviderKey = () => {
    const selectedModel = MODEL_OPTIONS.find((model) => model.value === localConfig.modelType)
    return selectedModel?.provider || "openai"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>LLM 配置</DialogTitle>
          <DialogDescription>配置聊天应用的语言模型、API密钥和系统提示词。</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="model">模型</TabsTrigger>
            <TabsTrigger value="keys">API 密钥</TabsTrigger>
            <TabsTrigger value="prompt">系统提示词</TabsTrigger>
            <TabsTrigger value="appearance">外观</TabsTrigger>
            <TabsTrigger value="about">关于</TabsTrigger>
          </TabsList>

          <TabsContent value="model" className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="model" className="text-right">
                模型
              </Label>
              <div className="col-span-3">
                <Select
                  value={localConfig.modelType}
                  onValueChange={(value) => setLocalConfig({ ...localConfig, modelType: value })}
                >
                  <SelectTrigger id="model">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              当前选择的模型需要 <span className="font-medium">{getCurrentProviderKey().toUpperCase()}</span> API 密钥
            </div>
          </TabsContent>

          <TabsContent value="keys" className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="openaiKey" className="text-right">
                OpenAI
              </Label>
              <div className="col-span-3">
                <Input
                  id="openaiKey"
                  type="password"
                  value={localConfig.apiKeys.openai || ""}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      apiKeys: { ...localConfig.apiKeys, openai: e.target.value },
                    })
                  }
                  placeholder="输入 OpenAI API 密钥"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="anthropicKey" className="text-right">
                Anthropic
              </Label>
              <div className="col-span-3">
                <Input
                  id="anthropicKey"
                  type="password"
                  value={localConfig.apiKeys.anthropic || ""}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      apiKeys: { ...localConfig.apiKeys, anthropic: e.target.value },
                    })
                  }
                  placeholder="输入 Anthropic API 密钥"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deepseekKey" className="text-right">
                DeepSeek
              </Label>
              <div className="col-span-3">
                <Input
                  id="deepseekKey"
                  type="password"
                  value={localConfig.apiKeys.deepseek || ""}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      apiKeys: { ...localConfig.apiKeys, deepseek: e.target.value },
                    })
                  }
                  placeholder="输入 DeepSeek API 密钥"
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="zzseekKey" className="text-right">
                  ZZSeek API
                </Label>
                <div className="col-span-3">
                  <Input
                    id="zzseekKey"
                    type="password"
                    value={localConfig.apiKeys.zzseek || ""}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        apiKeys: { ...localConfig.apiKeys, zzseek: e.target.value },
                      })
                    }
                    placeholder="输入 ZZSeek API 密钥"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="zzseekBaseUrl" className="text-right">
                  ZZSeek URL
                </Label>
                <div className="col-span-3">
                  <Input
                    id="zzseekBaseUrl"
                    type="text"
                    value={localConfig.apiKeys.zzseekBaseUrl || ""}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        apiKeys: { ...localConfig.apiKeys, zzseekBaseUrl: e.target.value },
                      })
                    }
                    placeholder="https://your-zzseek-api.com/v1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    填写你的 ZZSeek 后端地址
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="systemPrompt" className="text-right pt-2">
                系统提示词
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="systemPrompt"
                  value={localConfig.systemPrompt}
                  onChange={(e) => setLocalConfig({ ...localConfig, systemPrompt: e.target.value })}
                  placeholder="输入系统提示词，定义AI助手的行为和知识范围"
                  className="min-h-[150px]"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                主题
              </Label>
              <div className="col-span-3 flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  className="flex-1"
                >
                  <Sun className="h-4 w-4 mr-2" />
                  浅色
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  className="flex-1"
                >
                  <Moon className="h-4 w-4 mr-2" />
                  深色
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  className="flex-1"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  系统
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              当前主题: {theme === "light" ? "浅色" : theme === "dark" ? "深色" : "跟随系统"}
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="text-2xl font-bold">🧮 GeoGebra 聊天助手</div>
                <div className="text-sm text-muted-foreground">Version 0.2.0</div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold mb-1">项目介绍</div>
                  <p className="text-xs text-muted-foreground">
                    基于 AI 的 GeoGebra 数学工具，结合大语言模型与交互式几何画板，为数学学习提供智能辅助。
                  </p>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-1">功能特性</div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>多模型支持：OpenAI、Claude、DeepSeek、自部署</li>
                    <li>GeoGebra 命令语法验证与实时执行</li>
                    <li>交互式几何画板与命令帮助</li>
                    <li>多对话管理与历史记录</li>
                    <li>深色/浅色主题切换</li>
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-1">技术栈</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs bg-muted px-2 py-1 rounded">React</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">TypeScript</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">Vite</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">Tailwind CSS</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">Zustand</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">AI SDK</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-1">开源协议</div>
                  <p className="text-xs text-muted-foreground">
                    MIT License © 2025
                  </p>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-1">联系方式</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>👨‍💻 GitHub: <a href="https://github.com/tiwe0/chat-with-geogebra" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">tiwe0/chat-with-geogebra</a></div>
                    <div>📧 问题反馈: <a href="https://github.com/tiwe0/chat-with-geogebra/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub Issues</a></div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="text-xs text-center text-muted-foreground">
                    感谢使用 GeoGebra 聊天助手 🚀
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {saveSuccess && <div className="p-2 bg-green-100 text-green-800 rounded-md text-center">设置已成功保存</div>}
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

