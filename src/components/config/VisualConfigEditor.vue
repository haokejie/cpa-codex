<script setup lang="ts">
import type { VisualConfigValues, PayloadRule, PayloadFilterRule, PayloadModelEntry, PayloadParamEntry } from "../../types";
import { makeClientId } from "../../types";
import {
  VISUAL_CONFIG_PAYLOAD_VALUE_TYPE_OPTIONS,
  VISUAL_CONFIG_PROTOCOL_OPTIONS,
} from "../../composables/useVisualConfig";

const props = withDefaults(defineProps<{
  values: VisualConfigValues;
  disabled?: boolean;
  onChange: (values: Partial<VisualConfigValues>) => void;
}>(), {
  disabled: false,
});

const updateValues = (partial: Partial<VisualConfigValues>) => {
  props.onChange(partial);
};

const updateStreaming = (key: keyof VisualConfigValues["streaming"], value: string) => {
  updateValues({
    streaming: {
      ...props.values.streaming,
      [key]: value,
    },
  });
};

type PayloadRuleKind = "default" | "override";
const ruleKeyMap: Record<PayloadRuleKind, "payloadDefaultRules" | "payloadOverrideRules"> = {
  default: "payloadDefaultRules",
  override: "payloadOverrideRules",
};

const updateRuleList = (kind: PayloadRuleKind, list: PayloadRule[]) => {
  updateValues({ [ruleKeyMap[kind]]: list } as Partial<VisualConfigValues>);
};

const updateFilterList = (list: PayloadFilterRule[]) => {
  updateValues({ payloadFilterRules: list });
};

const addRule = (kind: PayloadRuleKind) => {
  const list = [...props.values[ruleKeyMap[kind]]];
  list.push({ id: makeClientId(), models: [], params: [] });
  updateRuleList(kind, list);
};

const removeRule = (kind: PayloadRuleKind, ruleId: string) => {
  const list = props.values[ruleKeyMap[kind]].filter((rule) => rule.id !== ruleId);
  updateRuleList(kind, list);
};

const updateRule = (kind: PayloadRuleKind, ruleId: string, updater: (rule: PayloadRule) => PayloadRule) => {
  const list = props.values[ruleKeyMap[kind]].map((rule) => (rule.id === ruleId ? updater(rule) : rule));
  updateRuleList(kind, list);
};

const addRuleModel = (kind: PayloadRuleKind, ruleId: string) => {
  updateRule(kind, ruleId, (rule) => ({
    ...rule,
    models: [...rule.models, { id: makeClientId(), name: "", protocol: undefined }],
  }));
};

const updateRuleModel = (
  kind: PayloadRuleKind,
  ruleId: string,
  modelId: string,
  patch: Partial<PayloadModelEntry>,
) => {
  updateRule(kind, ruleId, (rule) => ({
    ...rule,
    models: rule.models.map((model) => (model.id === modelId ? { ...model, ...patch } : model)),
  }));
};

const removeRuleModel = (kind: PayloadRuleKind, ruleId: string, modelId: string) => {
  updateRule(kind, ruleId, (rule) => ({
    ...rule,
    models: rule.models.filter((model) => model.id !== modelId),
  }));
};

const addRuleParam = (kind: PayloadRuleKind, ruleId: string) => {
  updateRule(kind, ruleId, (rule) => ({
    ...rule,
    params: [
      ...rule.params,
      { id: makeClientId(), path: "", valueType: "string", value: "" },
    ],
  }));
};

const updateRuleParam = (
  kind: PayloadRuleKind,
  ruleId: string,
  paramId: string,
  patch: Partial<PayloadParamEntry>,
) => {
  updateRule(kind, ruleId, (rule) => ({
    ...rule,
    params: rule.params.map((param) => (param.id === paramId ? { ...param, ...patch } : param)),
  }));
};

const removeRuleParam = (kind: PayloadRuleKind, ruleId: string, paramId: string) => {
  updateRule(kind, ruleId, (rule) => ({
    ...rule,
    params: rule.params.filter((param) => param.id !== paramId),
  }));
};

const addFilterRule = () => {
  const list = [...props.values.payloadFilterRules];
  list.push({ id: makeClientId(), models: [], params: [] });
  updateFilterList(list);
};

const removeFilterRule = (ruleId: string) => {
  updateFilterList(props.values.payloadFilterRules.filter((rule) => rule.id !== ruleId));
};

const updateFilterRule = (ruleId: string, updater: (rule: PayloadFilterRule) => PayloadFilterRule) => {
  updateFilterList(props.values.payloadFilterRules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)));
};

const addFilterModel = (ruleId: string) => {
  updateFilterRule(ruleId, (rule) => ({
    ...rule,
    models: [...rule.models, { id: makeClientId(), name: "", protocol: undefined }],
  }));
};

const updateFilterModel = (ruleId: string, modelId: string, patch: Partial<PayloadModelEntry>) => {
  updateFilterRule(ruleId, (rule) => ({
    ...rule,
    models: rule.models.map((model) => (model.id === modelId ? { ...model, ...patch } : model)),
  }));
};

const removeFilterModel = (ruleId: string, modelId: string) => {
  updateFilterRule(ruleId, (rule) => ({
    ...rule,
    models: rule.models.filter((model) => model.id !== modelId),
  }));
};

const addFilterParam = (ruleId: string) => {
  updateFilterRule(ruleId, (rule) => ({
    ...rule,
    params: [...rule.params, ""],
  }));
};

const updateFilterParam = (ruleId: string, index: number, value: string) => {
  updateFilterRule(ruleId, (rule) => ({
    ...rule,
    params: rule.params.map((param, idx) => (idx === index ? value : param)),
  }));
};

const removeFilterParam = (ruleId: string, index: number) => {
  updateFilterRule(ruleId, (rule) => ({
    ...rule,
    params: rule.params.filter((_, idx) => idx !== index),
  }));
};
</script>

<template>
  <div class="visual-editor">
    <section class="section">
      <div class="section-title">基础网络</div>
      <div class="grid">
        <label class="field">
          <span>Host</span>
          <input class="input" :disabled="disabled" :value="values.host" @input="updateValues({ host: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field">
          <span>Port</span>
          <input class="input" :disabled="disabled" :value="values.port" @input="updateValues({ port: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">TLS</div>
      <div class="grid">
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.tlsEnable" @change="updateValues({ tlsEnable: ($event.target as HTMLInputElement).checked })" />
          <span>启用 TLS</span>
        </label>
        <label class="field">
          <span>Cert</span>
          <input class="input" :disabled="disabled" :value="values.tlsCert" @input="updateValues({ tlsCert: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field">
          <span>Key</span>
          <input class="input" :disabled="disabled" :value="values.tlsKey" @input="updateValues({ tlsKey: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">远程管理</div>
      <div class="grid">
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.rmAllowRemote" @change="updateValues({ rmAllowRemote: ($event.target as HTMLInputElement).checked })" />
          <span>允许远程访问</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.rmDisableControlPanel" @change="updateValues({ rmDisableControlPanel: ($event.target as HTMLInputElement).checked })" />
          <span>禁用管理面板</span>
        </label>
        <label class="field">
          <span>Secret Key</span>
          <input class="input" :disabled="disabled" :value="values.rmSecretKey" @input="updateValues({ rmSecretKey: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field">
          <span>Panel Repo</span>
          <input class="input" :disabled="disabled" :value="values.rmPanelRepo" @input="updateValues({ rmPanelRepo: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">认证与密钥</div>
      <div class="grid">
        <label class="field">
          <span>Auth Dir</span>
          <input class="input" :disabled="disabled" :value="values.authDir" @input="updateValues({ authDir: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field full">
          <span>API Keys（每行一个）</span>
          <textarea class="textarea" :disabled="disabled" :value="values.apiKeysText" @input="updateValues({ apiKeysText: ($event.target as HTMLTextAreaElement).value })"></textarea>
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">运行开关</div>
      <div class="grid">
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.debug" @change="updateValues({ debug: ($event.target as HTMLInputElement).checked })" />
          <span>Debug</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.commercialMode" @change="updateValues({ commercialMode: ($event.target as HTMLInputElement).checked })" />
          <span>商业模式</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.loggingToFile" @change="updateValues({ loggingToFile: ($event.target as HTMLInputElement).checked })" />
          <span>写日志到文件</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.usageStatisticsEnabled" @change="updateValues({ usageStatisticsEnabled: ($event.target as HTMLInputElement).checked })" />
          <span>启用使用统计</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.forceModelPrefix" @change="updateValues({ forceModelPrefix: ($event.target as HTMLInputElement).checked })" />
          <span>强制模型前缀</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.wsAuth" @change="updateValues({ wsAuth: ($event.target as HTMLInputElement).checked })" />
          <span>WS 鉴权</span>
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">日志与重试</div>
      <div class="grid">
        <label class="field">
          <span>日志总大小上限（MB）</span>
          <input class="input" :disabled="disabled" :value="values.logsMaxTotalSizeMb" @input="updateValues({ logsMaxTotalSizeMb: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field">
          <span>请求重试次数</span>
          <input class="input" :disabled="disabled" :value="values.requestRetry" @input="updateValues({ requestRetry: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field">
          <span>最大重试间隔</span>
          <input class="input" :disabled="disabled" :value="values.maxRetryInterval" @input="updateValues({ maxRetryInterval: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="field">
          <span>代理 URL</span>
          <input class="input" :disabled="disabled" :value="values.proxyUrl" @input="updateValues({ proxyUrl: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">配额回退与路由</div>
      <div class="grid">
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.quotaSwitchProject" @change="updateValues({ quotaSwitchProject: ($event.target as HTMLInputElement).checked })" />
          <span>切换项目</span>
        </label>
        <label class="toggle">
          <input type="checkbox" :disabled="disabled" :checked="values.quotaSwitchPreviewModel" @change="updateValues({ quotaSwitchPreviewModel: ($event.target as HTMLInputElement).checked })" />
          <span>切换预览模型</span>
        </label>
        <label class="field">
          <span>路由策略</span>
          <select class="select" :disabled="disabled" :value="values.routingStrategy" @change="updateValues({ routingStrategy: ($event.target as HTMLSelectElement).value as VisualConfigValues['routingStrategy'] })">
            <option value="round-robin">轮询</option>
            <option value="fill-first">填充优先</option>
          </select>
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Streaming</div>
      <div class="grid">
        <label class="field">
          <span>Keepalive Seconds</span>
          <input class="input" :disabled="disabled" :value="values.streaming.keepaliveSeconds" @input="updateStreaming('keepaliveSeconds', ($event.target as HTMLInputElement).value)" />
        </label>
        <label class="field">
          <span>Bootstrap Retries</span>
          <input class="input" :disabled="disabled" :value="values.streaming.bootstrapRetries" @input="updateStreaming('bootstrapRetries', ($event.target as HTMLInputElement).value)" />
        </label>
        <label class="field">
          <span>Nonstream Keepalive</span>
          <input class="input" :disabled="disabled" :value="values.streaming.nonstreamKeepaliveInterval" @input="updateStreaming('nonstreamKeepaliveInterval', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Payload Default Rules</div>
      <button class="btn-ghost" type="button" :disabled="disabled" @click="addRule('default')">添加规则</button>
      <div v-if="values.payloadDefaultRules.length === 0" class="hint">暂无规则</div>
      <div v-for="rule in values.payloadDefaultRules" :key="rule.id" class="rule-card">
        <div class="rule-head">
          <span>规则</span>
          <button class="btn-link" type="button" :disabled="disabled" @click="removeRule('default', rule.id)">删除</button>
        </div>
        <div class="rule-block">
          <div class="rule-title">模型</div>
          <button class="btn-ghost" type="button" :disabled="disabled" @click="addRuleModel('default', rule.id)">添加模型</button>
          <div v-for="model in rule.models" :key="model.id" class="rule-row">
            <input class="input" :disabled="disabled" :value="model.name" placeholder="模型名" @input="updateRuleModel('default', rule.id, model.id, { name: ($event.target as HTMLInputElement).value })" />
            <select class="select" :disabled="disabled" :value="model.protocol || ''" @change="updateRuleModel('default', rule.id, model.id, { protocol: ($event.target as HTMLSelectElement).value as PayloadModelEntry['protocol'] })">
              <option v-for="option in VISUAL_CONFIG_PROTOCOL_OPTIONS" :key="option.value" :value="option.value">{{ option.defaultLabel }}</option>
            </select>
            <button class="btn-link" type="button" :disabled="disabled" @click="removeRuleModel('default', rule.id, model.id)">移除</button>
          </div>
        </div>
        <div class="rule-block">
          <div class="rule-title">参数</div>
          <button class="btn-ghost" type="button" :disabled="disabled" @click="addRuleParam('default', rule.id)">添加参数</button>
          <div v-for="param in rule.params" :key="param.id" class="rule-row">
            <input class="input" :disabled="disabled" :value="param.path" placeholder="路径" @input="updateRuleParam('default', rule.id, param.id, { path: ($event.target as HTMLInputElement).value })" />
            <select class="select" :disabled="disabled" :value="param.valueType" @change="updateRuleParam('default', rule.id, param.id, { valueType: ($event.target as HTMLSelectElement).value as PayloadParamEntry['valueType'] })">
              <option v-for="option in VISUAL_CONFIG_PAYLOAD_VALUE_TYPE_OPTIONS" :key="option.value" :value="option.value">{{ option.defaultLabel }}</option>
            </select>
            <input class="input" :disabled="disabled" :value="param.value" placeholder="值" @input="updateRuleParam('default', rule.id, param.id, { value: ($event.target as HTMLInputElement).value })" />
            <button class="btn-link" type="button" :disabled="disabled" @click="removeRuleParam('default', rule.id, param.id)">移除</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Payload Override Rules</div>
      <button class="btn-ghost" type="button" :disabled="disabled" @click="addRule('override')">添加规则</button>
      <div v-if="values.payloadOverrideRules.length === 0" class="hint">暂无规则</div>
      <div v-for="rule in values.payloadOverrideRules" :key="rule.id" class="rule-card">
        <div class="rule-head">
          <span>规则</span>
          <button class="btn-link" type="button" :disabled="disabled" @click="removeRule('override', rule.id)">删除</button>
        </div>
        <div class="rule-block">
          <div class="rule-title">模型</div>
          <button class="btn-ghost" type="button" :disabled="disabled" @click="addRuleModel('override', rule.id)">添加模型</button>
          <div v-for="model in rule.models" :key="model.id" class="rule-row">
            <input class="input" :disabled="disabled" :value="model.name" placeholder="模型名" @input="updateRuleModel('override', rule.id, model.id, { name: ($event.target as HTMLInputElement).value })" />
            <select class="select" :disabled="disabled" :value="model.protocol || ''" @change="updateRuleModel('override', rule.id, model.id, { protocol: ($event.target as HTMLSelectElement).value as PayloadModelEntry['protocol'] })">
              <option v-for="option in VISUAL_CONFIG_PROTOCOL_OPTIONS" :key="option.value" :value="option.value">{{ option.defaultLabel }}</option>
            </select>
            <button class="btn-link" type="button" :disabled="disabled" @click="removeRuleModel('override', rule.id, model.id)">移除</button>
          </div>
        </div>
        <div class="rule-block">
          <div class="rule-title">参数</div>
          <button class="btn-ghost" type="button" :disabled="disabled" @click="addRuleParam('override', rule.id)">添加参数</button>
          <div v-for="param in rule.params" :key="param.id" class="rule-row">
            <input class="input" :disabled="disabled" :value="param.path" placeholder="路径" @input="updateRuleParam('override', rule.id, param.id, { path: ($event.target as HTMLInputElement).value })" />
            <select class="select" :disabled="disabled" :value="param.valueType" @change="updateRuleParam('override', rule.id, param.id, { valueType: ($event.target as HTMLSelectElement).value as PayloadParamEntry['valueType'] })">
              <option v-for="option in VISUAL_CONFIG_PAYLOAD_VALUE_TYPE_OPTIONS" :key="option.value" :value="option.value">{{ option.defaultLabel }}</option>
            </select>
            <input class="input" :disabled="disabled" :value="param.value" placeholder="值" @input="updateRuleParam('override', rule.id, param.id, { value: ($event.target as HTMLInputElement).value })" />
            <button class="btn-link" type="button" :disabled="disabled" @click="removeRuleParam('override', rule.id, param.id)">移除</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Payload Filter Rules</div>
      <button class="btn-ghost" type="button" :disabled="disabled" @click="addFilterRule">添加规则</button>
      <div v-if="values.payloadFilterRules.length === 0" class="hint">暂无规则</div>
      <div v-for="rule in values.payloadFilterRules" :key="rule.id" class="rule-card">
        <div class="rule-head">
          <span>规则</span>
          <button class="btn-link" type="button" :disabled="disabled" @click="removeFilterRule(rule.id)">删除</button>
        </div>
        <div class="rule-block">
          <div class="rule-title">模型</div>
          <button class="btn-ghost" type="button" :disabled="disabled" @click="addFilterModel(rule.id)">添加模型</button>
          <div v-for="model in rule.models" :key="model.id" class="rule-row">
            <input class="input" :disabled="disabled" :value="model.name" placeholder="模型名" @input="updateFilterModel(rule.id, model.id, { name: ($event.target as HTMLInputElement).value })" />
            <select class="select" :disabled="disabled" :value="model.protocol || ''" @change="updateFilterModel(rule.id, model.id, { protocol: ($event.target as HTMLSelectElement).value as PayloadModelEntry['protocol'] })">
              <option v-for="option in VISUAL_CONFIG_PROTOCOL_OPTIONS" :key="option.value" :value="option.value">{{ option.defaultLabel }}</option>
            </select>
            <button class="btn-link" type="button" :disabled="disabled" @click="removeFilterModel(rule.id, model.id)">移除</button>
          </div>
        </div>
        <div class="rule-block">
          <div class="rule-title">参数路径</div>
          <button class="btn-ghost" type="button" :disabled="disabled" @click="addFilterParam(rule.id)">添加参数</button>
          <div v-for="(param, idx) in rule.params" :key="`${rule.id}-${idx}`" class="rule-row">
            <input class="input" :disabled="disabled" :value="param" placeholder="路径" @input="updateFilterParam(rule.id, idx, ($event.target as HTMLInputElement).value)" />
            <button class="btn-link" type="button" :disabled="disabled" @click="removeFilterParam(rule.id, idx)">移除</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.visual-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--zinc-200);
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--zinc-800);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--zinc-600);
}

.field.full {
  grid-column: 1 / -1;
}

.input,
.textarea,
.select {
  border: 1px solid var(--zinc-200);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--zinc-800);
  background: #fff;
}

.textarea {
  min-height: 80px;
  resize: vertical;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--zinc-700);
}

.btn-ghost {
  height: 30px;
  padding: 0 12px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  align-self: flex-start;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--zinc-50);
  border-color: var(--zinc-300);
  color: var(--zinc-900);
}
.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-link {
  border: none;
  background: transparent;
  color: var(--red-600);
  font-size: 12px;
  cursor: pointer;
}

.hint {
  font-size: 12px;
  color: var(--zinc-400);
}

.rule-card {
  border: 1px solid var(--zinc-200);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--zinc-50);
}

.rule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--zinc-800);
}

.rule-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-title {
  font-size: 12px;
  color: var(--zinc-500);
}

.rule-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
}

.rule-row .btn-link {
  justify-self: end;
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .rule-row {
    grid-template-columns: 1fr;
  }
}
</style>
