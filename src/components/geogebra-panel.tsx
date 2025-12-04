import { useEffect, useRef, useState, useCallback } from "react"
import Geogebra from "react-geogebra"
import { Button } from "@/components/ui/button"

interface GeogebraPanelProps {
  onClose: () => void
  onExecuteLatestCommands: () => void
  onDebug: () => void
}

export function GeogebraPanel({ onClose, onExecuteLatestCommands, onDebug }: GeogebraPanelProps) {
  const [key, setKey] = useState(0) // 用于强制重建
  const appRef = useRef<any>(null)
  
  // 重置 GeoGebra（清空内容）
  const handleReset = useCallback(() => {
    if (appRef.current) {
      try {
        appRef.current.reset()
        console.log("[GeoGebra] 内容已清空")
      } catch (error) {
        console.error("[GeoGebra] 清空失败:", error)
      }
    }
  }, [])
  
  // 重建 GeoGebra
  const handleRecreate = useCallback(() => {
    console.log("[GeoGebra] 强制重建 applet")
    setKey(prev => prev + 1)
  }, [])
  
  // 当组件挂载时设置全局引用
  useEffect(() => {
    // react-geogebra 会自动设置 window.ggbApplet
    const checkApplet = setInterval(() => {
      if (window.ggbApplet) {
        console.log("[GeoGebra] React GeoGebra 实例就绪")
        appRef.current = window.ggbApplet
        window.ggbAppletReady = true
        clearInterval(checkApplet)
      }
    }, 100)
    
    return () => {
      clearInterval(checkApplet)
      window.ggbAppletReady = false
    }
  }, [key]) // key 变化时重新检查

  // 监听窗口大小变化
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const panel = document.getElementById("geogebra-panel")
        const title = document.getElementById("geogebra-title")
        
        if (panel && title && appRef.current && typeof appRef.current.setSize === 'function') {
          const width = panel.clientWidth
          const height = panel.clientHeight - title.clientHeight
          console.log(`[GeoGebra] 调整大小: ${width}x${height}`)
          
          try {
            appRef.current.setSize(width, height)
          } catch (error) {
            console.error("[GeoGebra] 设置大小失败:", error)
          }
        }
      }, 250) // 防抖 250ms
    }

    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(resizeTimer)
      window.removeEventListener("resize", handleResize)
    }
  }, [key]) // key 变化时重新绑定事件

  return (
    <div id="geogebra-panel" className="flex flex-col h-full lg:w-[50%] border-l">
      <div id="geogebra-title" className="flex items-center justify-between p-4 border-b">
        <h3 className="text-xl font-medium">GeoGebra</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDebug} 
            className="h-8"
            title="显示 GeoGebra 状态信息"
          >
            调试
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRecreate} 
            className="h-8"
            title="强制重建 GeoGebra applet"
          >
            重建
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onExecuteLatestCommands} 
            className="h-8"
          >
            执行命令
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset} 
            className="h-8"
          >
            清理
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClose} 
            className="h-8"
          >
            隐藏
          </Button>
        </div>
      </div>
      <div className="w-full h-full relative">
        <Geogebra
          key={key}
          id="ggb-element"
          appName="classic"
          showToolBar={true}
          showAlgebraInput={true}
          showMenuBar={true}
          enableLabelDrags={false}
          enableShiftDragZoom={true}
          enableRightClick={true}
          showResetIcon={true}
          allowStyleBar={false}
          appletOnLoad={() => {
            console.log("[GeoGebra] React GeoGebra appletOnLoad 回调")
            // 立即设置大小
            setTimeout(() => {
              const panel = document.getElementById("geogebra-panel")
              const title = document.getElementById("geogebra-title")
              
              if (panel && title && window.ggbApplet && typeof window.ggbApplet.setSize === 'function') {
                const width = panel.clientWidth
                const height = panel.clientHeight - title.clientHeight
                console.log(`[GeoGebra] 初始化大小: ${width}x${height}`)
                
                try {
                  window.ggbApplet.setSize(width, height)
                } catch (error) {
                  console.error("[GeoGebra] 初始化设置大小失败:", error)
                }
              }
            }, 100)
          }}
        />
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          #ggb-element-holder { width: 100% !important; height: 100% !important; }
          #ggb-element { width: 100% !important; height: 100% !important; }
          div.applet_scaler { width: 100% !important; height: 100% !important;  zoom: 1 !important; transform: none !important; }
        `
      }} />
    </div>
  )
}
