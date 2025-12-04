/**
 * GeoGebra 辅助函数
 * 用于处理 GeoGebra applet 的初始化和管理
 */

// 检测是否在 Tauri 环境中运行
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// 检查 GeoGebra 是否已加载
export function isGeoGebraLoaded(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.GGBApplet !== 'undefined'
}

// 检查 GeoGebra applet 实例是否存在且可用
export function isGeoGebraReady(): boolean {
  return typeof window !== 'undefined' && 
         window.ggbApplet !== undefined && 
         window.ggbApplet !== null &&
         typeof window.ggbApplet.evalCommand === 'function'
}

// 等待 GeoGebra 准备就绪
export function waitForGeoGebra(
  timeout: number = 10000,
  interval: number = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const check = () => {
      if (isGeoGebraReady()) {
        console.log('[GeoGebra Helper] GeoGebra 已就绪')
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('GeoGebra 加载超时'))
      } else {
        setTimeout(check, interval)
      }
    }
    
    check()
  })
}

// 获取 GeoGebra 状态信息（用于调试）
export function getGeoGebraStatus() {
  return {
    isTauri: isTauriEnvironment(),
    scriptLoaded: isGeoGebraLoaded(),
    appletReady: isGeoGebraReady(),
    hasGGBApplet: typeof window !== 'undefined' && 'GGBApplet' in window,
    hasGgbApplet: typeof window !== 'undefined' && 'ggbApplet' in window,
    ggbAppletType: typeof window !== 'undefined' && window.ggbApplet ? typeof window.ggbApplet : 'undefined',
    containerExists: typeof document !== 'undefined' && document.getElementById('geogebra-container') !== null,
  }
}

// 记录 GeoGebra 状态（调试用）
export function logGeoGebraStatus() {
  const status = getGeoGebraStatus()
  console.log('[GeoGebra Helper] 状态检查:', status)
  return status
}

// 安全地执行 GeoGebra 命令
export async function executeGeoGebraCommand(command: string): Promise<boolean> {
  try {
    if (!isGeoGebraReady()) {
      console.warn('[GeoGebra Helper] applet 未就绪，等待...')
      await waitForGeoGebra()
    }
    
    window.ggbApplet.evalCommand(command)
    return true
  } catch (error) {
    console.error(`[GeoGebra Helper] 执行命令失败: "${command}"`, error)
    return false
  }
}

// 安全地重置 GeoGebra
export async function resetGeoGebra(): Promise<boolean> {
  try {
    if (!isGeoGebraReady()) {
      console.warn('[GeoGebra Helper] applet 未就绪，无法重置')
      return false
    }
    
    window.ggbApplet.reset()
    console.log('[GeoGebra Helper] 重置成功')
    return true
  } catch (error) {
    console.error('[GeoGebra Helper] 重置失败:', error)
    return false
  }
}

// 安全地设置 GeoGebra 大小
export function setGeoGebraSize(width: number, height: number): boolean {
  try {
    if (!isGeoGebraReady()) {
      console.warn('[GeoGebra Helper] applet 未就绪，无法设置大小')
      return false
    }
    
    window.ggbApplet.setSize(width, height)
    console.log(`[GeoGebra Helper] 设置大小: ${width}x${height}`)
    return true
  } catch (error) {
    console.error('[GeoGebra Helper] 设置大小失败:', error)
    return false
  }
}
