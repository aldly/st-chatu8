const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../dna.js'), 'utf8');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const profile = { api_url: 'https://model.invalid', api_key: 'fixture-secret', model: 'fixture-model', stream: false };
const archive = [{ 姓名: '测试角色', 核心DNA: '测试资料' }];
const completion = (content = JSON.stringify(archive)) => ({ choices: [{ message: { content }, finish_reason: 'stop' }] });
const json = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const nativeHost = { abiVersion: 1, invoke: { safeInvoke() {} } };

// 直接执行 dna.js 中的真实请求/解析函数；隔离宿主 UI，不复制请求实现。
function harness({ native = true, config = {}, fetchImpl } = {}) {
    const calls = [], logs = [];
    const ctx = vm.createContext({
        AbortController, TextDecoder, Response, console,
        __TAURITAVERN__: native ? nativeHost : undefined,
        S: { retryCount: 0, replyMaxTokens: 10000, enabled: true, autoScan: true, autoEvery: 1, scanDepth: 3 },
        chatu8Profile: () => ({ ...profile, ...config }),
        numOr: (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback,
        normalizeMessages: (prompt) => Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }],
        applyBreakthrough: (_, messages) => ({ messages }),
        getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'fixture-csrf' }),
        document: { querySelector: () => null },
        log: (message) => logs.push(message), toast() {},
        chatu8ToolConfig: () => null, decodeToolCall: () => '',
        fetch: async (url, init) => {
            calls.push({ url, ...init, payload: JSON.parse(init.body) });
            return fetchImpl ? fetchImpl(url, init, ctx) : json(completion());
        },
    });
    vm.runInContext(slice('function resolveApi(scope)', '/* ------------------------------ 附加配置：智绘姬的自定义 Tool'), ctx);
    vm.runInContext(slice('function extractBracket(', 'function normalizeProfile('), ctx);
    return { ctx, calls, logs };
}

for (const url of ['https://model.invalid', 'https://model.invalid/v1/', 'https://model.invalid/v1/chat/completions']) {
    test(`原生非流式构造和建档 JSON 解析：${url}`, async () => {
        const { ctx, calls } = harness({ config: { api_url: url, stream: true, enable_custom_headers: true, custom_headers: 'X-Test: fixture-header' } });
        const result = await ctx.callSafe('测试', '', 'gen', '', 1234, () => {});
        assert.deepEqual(JSON.parse(JSON.stringify(ctx.parseProfileList(result))), archive);
        assert.equal(calls.length, 1);
        const req = calls[0];
        assert.equal(req.url, '/api/backends/chat-completions/generate');
        assert.equal(req.payload.chat_completion_source, 'custom');
        assert.equal(req.payload.custom_api_format, 'openai_compat');
        assert.equal(req.payload.custom_url, 'https://model.invalid/v1');
        assert.equal(req.payload.model, profile.model);
        assert.equal(req.payload.max_tokens, 1234);
        assert.equal(req.payload.temperature, 0.8);
        assert.equal(req.payload.stream, false);
        assert.equal(req.payload.messages[0].content, '测试');
        assert.equal(req.headers['X-CSRF-Token'], 'fixture-csrf');
        assert.equal(req.headers.Authorization, undefined);
        assert.equal(JSON.parse(req.payload.custom_include_headers).Authorization, 'Bearer fixture-secret');
        assert.equal(JSON.parse(req.payload.custom_include_headers)['X-Test'], 'fixture-header');
        assert.equal(req.signal.aborted, false);
    });
}

test('普通酒馆直连、温度和输出上限保持兼容，关闭配置流式时回调不会强制流式', async () => {
    const { ctx, calls } = harness({ native: false, config: { temperature: 0.4, max_tokens: 2345 } });
    ctx.__TAURI__ = {}; // 通用 Tauri 标记也不能误判为 TauriTavern。
    await ctx.callSafe('测试', '', undefined, '', undefined, () => {});
    assert.equal(calls[0].url, 'https://model.invalid/v1/chat/completions');
    assert.equal(calls[0].headers.Authorization, 'Bearer fixture-secret');
    assert.equal(calls[0].payload.temperature, 0.4);
    assert.equal(calls[0].payload.max_tokens, 2345);
    assert.equal(calls[0].payload.stream, false);
    assert.equal(calls[0].payload.chat_completion_source, undefined);
});

test('无智绘姬显式 Key 时允许原生端复用已有 custom 密钥；自定义认证头优先', async () => {
    const a = harness({ config: { api_key: '' } });
    await a.ctx.callSafe('测试');
    assert.equal(JSON.parse(a.calls[0].payload.custom_include_headers).Authorization, undefined);
    const b = harness({ config: { enable_custom_headers: true, custom_headers: 'Authorization: Bearer fixture-override' } });
    await b.ctx.callSafe('测试');
    assert.equal(JSON.parse(b.calls[0].payload.custom_include_headers).Authorization, 'Bearer fixture-override');
});

for (const wrapped of [false, true]) {
    test(`解析 OpenAI 响应，data 包装=${wrapped}`, async () => {
        const { ctx } = harness({ fetchImpl: () => json(wrapped ? { data: completion() } : completion()) });
        assert.equal(await ctx.callSafe('测试'), JSON.stringify(archive));
    });
}

for (const [name, response, code] of [
    ['HTTP 错误', () => new Response('fixture-secret', { status: 499 }), 'HTTP_ERROR'],
    ['API error', () => json({ error: { message: 'upstream fixture-secret' } }), 'API_ERROR'],
    ['包装 API error', () => json({ data: { error: { message: 'failure' } } }), 'API_ERROR'],
    ['空响应', () => new Response('  '), 'EMPTY_RESPONSE'],
    ['无正文', () => json(completion('')), 'EMPTY_CONTENT'],
    ['JSON 失败', () => new Response('<html>fixture-secret</html>'), 'INVALID_JSON'],
    ['连接失败', () => { throw new TypeError('Load failed'); }, 'NETWORK_ERROR'],
    ['读取中断', () => new Response(new ReadableStream({ start(c) { c.error(new TypeError('Load failed')); } })), 'NETWORK_ERROR'],
]) {
    test(name, async () => {
        const { ctx, calls, logs } = harness({ fetchImpl: response });
        await assert.rejects(ctx.callSafe('测试'), (e) => e.code === code && !e.message.includes('fixture-secret'));
        assert.equal(calls.length, 1);
        assert.ok(!logs.join().includes('fixture-secret'));
    });
}

test('用户取消：fetch 收到同一个 signal，晚到成功也不能返回建档内容', async () => {
    for (const lateSuccess of [false, true]) {
        const { ctx, calls } = harness({ fetchImpl: async (_, init, context) => {
            context.doAbort();
            if (!lateSuccess) throw new DOMException('aborted', 'AbortError');
            return json(completion());
        } });
        await assert.rejects(ctx.callSafe('测试'), /已手动中断/);
        assert.equal(calls[0].signal.aborted, true);
        assert.equal(calls.length, 1);
    }
});

test('读取响应体期间取消，不接受晚到正文', async () => {
    const { ctx } = harness({ fetchImpl: (_, __, context) => ({ ok: true, headers: new Headers(), text: async () => {
        context.doAbort();
        return JSON.stringify(completion());
    } }) });
    await assert.rejects(ctx.callSafe('测试'), /已手动中断/);
});

function sse(text) {
    const bytes = new TextEncoder().encode(text);
    return new Response(new ReadableStream({ start(c) {
        // 按字节分片覆盖 UTF-8 及 CRLF 边界。
        for (const byte of bytes) c.enqueue(Uint8Array.of(byte));
        c.close();
    } }), { headers: { 'content-type': 'text/event-stream' } });
}
const frame = (content, finish) => 'data: ' + JSON.stringify({ choices: [{ delta: { content }, finish_reason: finish }] }) + '\r\n\r\n';
for (const [name, text, expected] of [
    ['DONE 后无需等连接关闭', frame('中文') + 'data: [DONE]\r\n\r\n', '中文'],
    ['最后事件无换行', frame('中文') + 'data: [DONE]', '中文'],
    ['finish_reason 完成', frame('中文', 'stop'), '中文'],
    ['缺少结束标志', frame('部分档案'), 'STREAM_INTERRUPTED'],
    ['空流', 'data: [DONE]\n\n', 'STREAM_EMPTY'],
    ['错误事件', 'data: {"error":{"message":"failure"}}\n\n', 'API_ERROR'],
    ['坏 JSON', 'data: {bad}\n\n', 'STREAM_JSON'],
]) {
    test(`SSE ${name}，不隐式重发`, async () => {
        const { ctx, calls } = harness({ native: false, config: { stream: true }, fetchImpl: () => sse(text) });
        ctx.S.retryCount = 5;
        const request = ctx.callSafe('测试', '', 'gen', '', 0, () => {});
        if (expected === '中文') assert.equal(await request, expected);
        else await assert.rejects(request, (e) => e.code === expected);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].payload.stream, true);
        assert.equal(calls[0].payload.max_tokens, undefined);
    });
}

test('服务端忽略流式返回 JSON 时直接解析同一响应', async () => {
    const { ctx, calls } = harness({ native: false, config: { stream: true } });
    assert.equal(await ctx.callSafe('测试', '', 'gen', '', 0, () => {}), JSON.stringify(archive));
    assert.equal(calls.length, 1);
});

test('SSE 用户在收到部分内容时取消，不返回部分档案、不重发', async () => {
    const { ctx, calls } = harness({ native: false, config: { stream: true }, fetchImpl: () => sse(frame('部分') + frame('完成', 'stop')) });
    await assert.rejects(ctx.callSafe('测试', '', 'gen', '', 0, () => ctx.doAbort()), /已手动中断/);
    assert.equal(calls.length, 1);
});

// 验证 UI 入口的真实调用关系；底层 lib/gen 都执行同一个 callSafe → callAI。
test('手动生成、立即记录、自动扫描共用发送逻辑', async () => {
    assert.match(slice('async function onGenDna(', '/* ----------'), /await callSafe\(/);
    assert.match(slice('async function runScan(', '/* ------------------------------ 面板 UI'), /await callSafe\(/);
    assert.match(source, /\[data-dna="scanNow"\]'\)\.addEventListener\('click', \(\) => runScan\(/);
    assert.match(slice('function onMessageReceived(', 'function onChatChanged('), /runScan\(\{ depth: S.scanDepth, auto: true \}\)/);
    for (const scope of [undefined, 'lib', 'gen']) {
        const { ctx, calls } = harness();
        await ctx.callSafe('测试', '', scope, '', 0, () => {});
        assert.equal(calls[0].url, '/api/backends/chat-completions/generate');
        assert.equal(calls[0].payload.stream, false);
    }
});

test('输出上限错误不能误报为网络错误，Tool 仍使用非流式并解析参数', async () => {
    const a = harness({ fetchImpl: () => json({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }) });
    await assert.rejects(a.ctx.callSafe('测试'), (e) => e.code === 'OUTPUT_LIMIT');
    const b = harness({ native: false, config: { stream: true }, fetchImpl: () => json({ choices: [{ message: {
        tool_calls: [{ function: { arguments: JSON.stringify(archive) } }],
    } }] }) });
    b.ctx.applyBreakthrough = (_, messages) => ({ messages, tools: [{ type: 'function' }], toolChoice: 'auto' });
    assert.equal(await b.ctx.callSafe('测试', '', 'gen', '', 0, () => {}), JSON.stringify(archive));
    assert.equal(b.calls[0].payload.stream, false);
    assert.equal(b.calls[0].payload.tool_choice, 'auto');
});

test('SSE 已收到 DONE 而服务端保持连接时立即完成并关闭 reader', { timeout: 1000 }, async () => {
    let cancelled = false;
    const { ctx } = harness({ native: false, config: { stream: true }, fetchImpl: () => new Response(new ReadableStream({
        start(c) { c.enqueue(new TextEncoder().encode(frame('完成') + 'data: [DONE]\n\n')); },
        cancel() { cancelled = true; },
    }), { headers: { 'content-type': 'text/event-stream' } }) });
    assert.equal(await ctx.callSafe('测试', '', 'gen', '', 0, () => {}), '完成');
    assert.equal(cancelled, true);
});

function installEntryFixtures(ctx) {
    const saved = [];
    const prompt = [{ role: 'user', content: '测试正文' }];
    const g = { prompt, text: '测试正文', chars: ['测试角色'], entries: [] };
    Object.assign(ctx, {
        scanning: false, dnaBannerKind: '', lastAutoFloor: 0,
        GEN_MODE_LABEL: { chars: '按角色生成' }, OLD_RECORD_BUDGET: 1000,
        setBusy: (value) => { ctx.scanning = value; },
        dnaBanner() {}, dnaBannerHide() {},
        clampInt: (_, __, ___, fallback) => fallback,
        collectChatText: async () => ({ text: '测试正文', count: 1, from: 1, to: 1 }),
        cardLabel: () => '测试卡', cardOrigins: () => [], pickOldRecords: () => [],
        buildRecordPrompt: () => prompt, promptChars: () => 4, estimateTokens: () => 4, promptTextOf: () => '测试正文',
        logBreakthrough() {}, liveBegin() {}, liveEnd() {}, liveDelta() {}, libDeltaCb: () => null,
        appendAiReplyMeta() {}, renderList() {}, saveSettings() {}, renderGenInfo() {},
        normalizeProfile: (value) => value,
        saveProfile: (value) => { saved.push(value); return { results: [{ r: 'created', name: value['姓名'] }] }; },
        autoSwitchForms: () => [], formGroups: () => new Map(),
        genMode: () => 'chars', buildGenJobs: () => [{ g }], genBrief: () => '测试', presetEnabledOf: () => false,
        getContext: () => ({ chat: [{ mes: '测试正文' }] }),
    });
    vm.runInContext(slice('async function runScan(', '/* ------------------------------ 面板 UI'), ctx);
    vm.runInContext(slice('async function onGenDna(', '/* ---------- 选择状态存取'), ctx);
    vm.runInContext(slice('function onMessageReceived(', 'function onChatChanged('), ctx);
    return saved;
}
for (const entry of ['manual', 'immediate', 'auto']) {
    for (const cancel of [false, true]) {
        test(`真实入口 ${entry}，取消=${cancel}：经过公共发送路径，取消不写档案`, async () => {
            const { ctx, calls, logs } = harness({ fetchImpl: (_, __, context) => {
                if (cancel) context.doAbort();
                return json(completion());
            } });
            const saved = installEntryFixtures(ctx);
            if (entry === 'manual') await ctx.onGenDna('chars');
            else if (entry === 'immediate') await ctx.runScan({ depth: 3 });
            else {
                let running;
                const realRunScan = ctx.runScan;
                ctx.runScan = (opts) => (running = realRunScan(opts));
                ctx.onMessageReceived();
                await running;
            }
            assert.equal(calls.length, 1, logs.join('\n'));
            assert.equal(calls[0].url, '/api/backends/chat-completions/generate');
            assert.equal(calls[0].payload.stream, false);
            assert.equal(saved.length, cancel ? 0 : 1, logs.join('\n'));
            assert.ok(!logs.some((line) => /is not defined|is not a function/.test(line)), logs.join('\n'));
        });
    }
}
