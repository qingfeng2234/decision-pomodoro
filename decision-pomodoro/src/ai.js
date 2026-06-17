import { AI_CONFIG_KEY } from './config.js';
import { showStatus, showModal, closeModal } from './ui.js';

export function toggleAIConfigFields() {
    var enabled = document.getElementById('aiEnabled').checked;
    var fields = document.getElementById('aiConfigFields');
    fields.style.display = enabled ? 'block' : 'none';
}

export function testAIConnection() {
    var endpoint = document.getElementById('aiEndpoint').value.trim();
    var apiKey = document.getElementById('aiApiKey').value.trim();
    var model = document.getElementById('aiModel').value.trim();

    if (!endpoint || !apiKey || !model) {
        document.getElementById('aiTestResult').style.display = 'block';
        document.getElementById('aiTestResult').className = 'status-message warning';
        document.getElementById('aiTestResult').textContent = '请填写完整信息';
        return;
    }

    document.getElementById('aiTestResult').style.display = 'block';
    document.getElementById('aiTestResult').className = 'status-message info';
    document.getElementById('aiTestResult').textContent = '⏳ 测试中...';

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: '回复"连接成功"即可' }],
            max_tokens: 20
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        document.getElementById('aiTestResult').className = 'status-message success';
        document.getElementById('aiTestResult').textContent = '✅ 连接成功！';
    })
    .catch(function(err) {
        document.getElementById('aiTestResult').className = 'status-message danger';
        document.getElementById('aiTestResult').textContent = '❌ 连接失败：' + err.message;
    });
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

export function applyAISuggestion() {
    var text = document.getElementById('aiSuggestionText').textContent;
    if (text) {
        document.getElementById('outputInput').value = text;
    }
    document.getElementById('aiSuggestion').classList.add('hidden');
    document.getElementById('btnAISuggest').classList.remove('hidden');
    showStatus('已采用 AI 建议', 'success');
}

export function dismissAISuggestion() {
    document.getElementById('aiSuggestion').classList.add('hidden');
    document.getElementById('btnAISuggest').classList.remove('hidden');
    showStatus('AI 建议已关闭，继续手动填写', 'info');
}
