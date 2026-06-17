import { AI_CONFIG_KEY } from './config.js';
import { showStatus, closeModal } from './ui.js';

export function toggleAIConfigFields() {
    var enabled = document.getElementById('aiEnabled').checked;
    var fields = document.getElementById('aiConfigFields');
    fields.style.display = enabled ? 'block' : 'none';
}

export async function testAIConnection() {
    var endpoint = document.getElementById('aiEndpoint').value.trim();
    var apiKey = document.getElementById('aiApiKey').value.trim();
    var model = document.getElementById('aiModel').value.trim();
    var resultEl = document.getElementById('aiTestResult');

    function setResult(level, text) {
        resultEl.style.display = 'block';
        resultEl.className = 'status-message ' + level;
        resultEl.textContent = text;
    }

    if (!endpoint || !apiKey || !model) {
        setResult('warning', '请填写完整信息');
        return;
    }

    setResult('info', '⏳ 测试中...');

    try {
        const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: '回复"连接成功"即可' }],
                max_tokens: 20
            })
        });

        const text = await r.text();

        if (!r.ok) {
            const body = text.slice(0, 200) || '(空响应)';
            setResult('danger', '❌ HTTP ' + r.status + '：' + body);
            return;
        }

        try {
            JSON.parse(text);
            setResult('success', '✅ 连接成功！');
        } catch {
            setResult('danger', '❌ 响应不是 JSON：' + (text.slice(0, 100) || '(空响应)'));
        }
    } catch (err) {
        setResult('danger', '❌ 网络错误：' + err.message);
    }
}

export function saveAIConfig() {
    var config = {
        enabled: document.getElementById('aiEnabled').checked,
        endpoint: document.getElementById('aiEndpoint').value.trim(),
        apiKey: document.getElementById('aiApiKey').value.trim(),
        model: document.getElementById('aiModel').value.trim()
    };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
    closeModal('aiConfigModal');
    showStatus('AI 配置已保存', 'success');
}
