# 组件实现约束

## 理念

交互与展示规则优先做成可单测的纯逻辑，React / opentui 组件只负责状态连接和渲染。代码按概念内聚，让维护者读取一个概念时不必跨目录拼接行为。

## 组织方式

- `state/` 只定义公开数据形状，不能依赖 React、OpenTUI 或 Store；`store/` 负责发布订阅，
  React hook 只存在于 `store/react.ts`。
- 每个界面领域在 `surfaces/<surface>/` 内同时拥有 Surface、子组件和纯逻辑，例如 Timeline
  拥有 transcript / clip / diff，Composer 拥有 editor / completion / interactions。
- `terminal/` 只存多个 Surface 真正共用的终端原语。带 Timeline、Composer 或 Sidecar
  语义的逻辑不得为了复用外观进入这里。
- `ChatShell` 只组合 Surface 和承接全局文本选择，不订阅具体 State。
- 根 `index.ts` 是唯一公开入口；内部路径可直接调整，不提供旧目录 alias 或兼容 re-export。
- 新交互先判断能否拆成“纯函数 + 薄组件”，以便对边界和状态转换做稳定单测。

## 全局交互

双击选词是一切可见文本的通性，不是某个 widget 的局部能力。`useTokenSelectionOnDoubleClick` 只在 `ChatShell` 根容器挂一次，通过 opentui 鼠标事件冒泡覆盖后代文本；text / textarea 不应各自注册 selection handler。

上游实现参考 opentui/react；组件形态和工具渲染可参考 pi-mono 与 opencode。
