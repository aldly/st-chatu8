# DNA 在 TauriTavern 的请求修复

基础分支：`dna测试分支9`，基础提交：`88276ce`。修复分支：`fix/tauritavern-dna-proxy`。

## 修改范围

只修改 `dna.js` 的公共 OpenAI 发送链路、响应解析、取消检查及 SSE 读取，另加隔离测试和本说明。没有修改 ComfyUI 工作流、角色/服装管理或已有 DNA 档案结构，无需重新填写智绘姬 API Key。

- 通过稳定的 `__TAURITAVERN__.abiVersion` 和 `invoke.safeInvoke` 检测宿主，不依赖 UA 或通用 `__TAURI__`。
- TauriTavern 中统一调用 `/api/backends/chat-completions/generate`，使用 `custom` / `openai_compat` 专用请求字段、`use_sysprompt` 和 `getRequestHeaders()`。将原直连 endpoint 去掉 `/chat/completions` 后作为 `custom_url`，保留原配置的路径。
- 沿用智绘姬已选配置的 Key 和自定义头，将其序列化为 JSON 字符串放进 `custom_include_headers`，由原生层覆盖上游认证头。本地接口头仍由宿主生成；不将上游 Authorization 放进本地接口头。智绘姬无显式认证头时允许原生层沿用已有 `api_key_custom`。不修改宿主连接配置或密钥存储。
- TauriTavern 中固定非流式，包括手动生成、立即记录、自动记录和测试入口。此路径不使用 WebView 直连，也不因 `bypass_proxy` 开启而退回直连。普通 SillyTavern 保留直连，同时尊重智绘姬 `stream` 和 DNA 的实时显示开关。
- 解析正常 `choices` 与 `data.choices`，兼容文本内容数组及已有 Tool 参数解析。区分 HTTP 状态、API error、空响应、无正文、坏 JSON、网络失败和取消；不回显原始 HTTP 错误体，API 错误清除已知密钥及自定义头值。
- SSE 按事件读取，处理 UTF-8 分片、CRLF、末尾无换行、`[DONE]` 和 `finish_reason`。空流、坏事件及缺少结束标记报错，不隐式再发送第二个请求；服务端返回普通 JSON 时直接解析同一响应。已有用户配置的有限内容过滤/空正文重试仍由 `callSafe` 管理。
- 全程传递同一个 AbortSignal，收到响应和读完正文后再次检查取消。取消后不返回部分内容供调用方建档。多段任务中取消前已成功保存的段落沿用原有保留行为。

## 官方实现核对

核对 TauriTavern main 提交 `fff9af0333be97697be2313981699ab0ce35c236`：

- [Host ABI](https://github.com/Darkatse/TauriTavern/blob/fff9af0333be97697be2313981699ab0ce35c236/src/tauri/main/bootstrap.js)
- [请求构造器和本地请求头](https://github.com/Darkatse/TauriTavern/blob/fff9af0333be97697be2313981699ab0ce35c236/src/scripts/custom-request.js)
- [原生生成与取消路由](https://github.com/Darkatse/TauriTavern/blob/fff9af0333be97697be2313981699ab0ce35c236/src/tauri/main/routes/ai-routes.js)
- [自定义 Header 格式](https://github.com/Darkatse/TauriTavern/blob/fff9af0333be97697be2313981699ab0ce35c236/src-tauri/crates/tt-application/src/services/chat_completion_service/additional_parameters.rs)
- [上游密钥配置](https://github.com/Darkatse/TauriTavern/blob/fff9af0333be97697be2313981699ab0ce35c236/src-tauri/crates/tt-application/src/services/chat_completion_service/config.rs)

本补丁修复已确认的发送路径及强制流式问题；不据此认定约 10 秒失败、Magpie 499 的全部根因已确认。

## 本地验证

需要 Node.js 22 或更新版本，无需安装依赖：

```sh
node --input-type=module --check < dna.js
node --test tests/dna-request.test.cjs
git diff --check
```

测试直接执行 `dna.js` 中的真实函数，fetch、宿主 UI 和档案保存使用隔离 fixture。包括原生请求字段与档案 JSON、直连、包装响应、错误、取消、SSE、Tool，以及真实手动生成/立即记录/自动扫描入口的成功与取消行为。不调用真实模型或 Magpie，不使用真实 Key。

未通过真实 iPhone、已安装 TauriTavern 版本或局域网 Magpie 端到端验证。真机需检查日志显示“请求通道：TauriTavern 原生非流式”，连续运行手动生成/立即记录/自动记录，并在等待期间点击中断，确认没有新增该次档案。还需对照 Magpie 日志确认 499 是否消失；如仍发生，按时间检查服务端超时、手机网络/前后台切换与宿主版本。

## 私人仓库与安装

- [修复分支](https://github.com/aldly/st-chatu8/tree/fix/tauritavern-dna-proxy)
- 仓库 Git 地址：`https://github.com/aldly/st-chatu8.git`
- 分支：`fix/tauritavern-dna-proxy`

仓库保持私有。当前核对的官方 TauriTavern 原生扩展安装器仅支持匿名 HTTP(S) Git，明确拒绝带用户名/密码的 URL，并拒绝 query/fragment。私人仓库的 GitHub 登录态不会自动变成原生 Git 认证，因此上述私人地址无法直接在该安装器匿名安装。不要把 GitHub token 填进 URL；GitHub 的 `/tree/...` 分支浏览页也不是 Git 安装地址。

未自动安装到手机，也未改变现有手机插件或档案。若要在官方安装器中直接安装，需要另行提供其能够匿名访问的仓库；本次没有公开该私人仓库。

## 回滚

修复集中在单个 Git commit，使用 `git revert <修复提交>` 可回滚代码、测试和说明。基础提交 `88276ce` 可用于对比。回滚不迁移或删除 DNA 档案；不要为回滚卸载插件或清空设置。
