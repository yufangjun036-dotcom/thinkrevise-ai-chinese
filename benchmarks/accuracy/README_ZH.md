# ThinkRevise AI 准确率基准

这套基准用于回答“系统是否真的找对问题”，而不是证明系统能够返回很多反馈。

## 当前测试集

- 共 36 个案例。
- 33 个第一稿案例：单一客观错误、单一学术表达问题、无明显错误的强文本、多错误混合文本，以及残句、连写句、逗号拼接、论点、衔接和论证案例。
- 3 个第二稿案例：正确修正一个错误、修正后产生新错误、完整清理学术表达问题。
- 客观语言错误与需要语境判断的学术建议分开评分。

`cases.json` 是金标准数据。每个 `quote` 必须逐字出现在对应文章中；第二稿案例中的每个原问题必须明确归入“已经修正”或“仍然存在”。

第一轮逐项复核与判定边界见 [`GOLD_AUDIT_ZH.md`](GOLD_AUDIT_ZH.md)。

另有 `academic-stability-cases.json`，包含 17 个用于排查学术判断阶段波动的固定正反例，覆盖范围限定、因果判断、中心论点、跨句衔接和证据—结论匹配。它目前是项目内部构造的数据集，状态为 `internal_curated_pending_independent_review`；与 `cases.json` 分开维护，不能称为已经独立人工复核的金标准。

`academic-longform-cases.json` 增加 6 篇不少于 140 词的内部长文，检查学术判断在较长上下文中的范围限定、因果边界、证据—结论匹配、论点聚焦、跨段衔接、原文定位和完全重复反馈。独立评审方法见 [`INDEPENDENT_REVIEW_GUIDE_ZH.md`](INDEPENDENT_REVIEW_GUIDE_ZH.md)。

## 指标含义

- **客观错误召回率**：人工标注的拼写、语法、时态等错误中，系统找到了多少。
- **客观错误精确率（相对当前金标准）**：系统返回的客观错误中，有多少匹配当前人工标注。
- **客观修改建议接受率**：已正确定位的客观问题中，修改说明是否包含金标准认可的正确形式；复杂句子结构修改仍由人工复核。
- **学术建议覆盖率**：系统是否发现了预先标注的典型非学术表达。未匹配的额外学术建议需要人工复核，不能自动算作误报。
- **引用定位准确率**：返回的问题片段能否逐字定位到原文。
- **重复率**：同一类别和同一文本位置是否被重复报告。
- **第二稿修正准确率**：已经修改的问题是否正确进入“已经修正”。
- **第二稿遗留召回率**：未修改的问题是否继续保留。
- **第二稿新错召回率**：修改过程中产生的新错误是否被发现。

## 安全运行方式

只校验测试集结构，不调用 API，也不产生费用：

```bash
npm run benchmark:validate
```

同时校验 17 例学术稳定性数据结构、不调用 API：

```bash
npm run benchmark:academic-validate
```

校验长文学术数据集结构与输入长度、不调用 API：

```bash
npm run benchmark:longform-validate
```

只运行一个指定案例：

```bash
RUN_LIVE_BENCHMARK=1 BENCHMARK_CASES=obj-spelling-teh PROTOTYPE_URL=http://127.0.0.1:3002 npm run benchmark:live
```

限制为前 5 个案例：

```bash
RUN_LIVE_BENCHMARK=1 BENCHMARK_LIMIT=5 PROTOTYPE_URL=http://127.0.0.1:3002 npm run benchmark:live
```

完整运行全部案例：

```bash
RUN_LIVE_BENCHMARK=1 PROTOTYPE_URL=http://127.0.0.1:3002 npm run benchmark:live
```

真实运行会在 `reports/accuracy/` 保存 JSON 明细和 Markdown 摘要。完整批量会产生多次真实 AI 请求，因此必须由使用者明确设置 `RUN_LIVE_BENCHMARK=1`。

## 发布前仍需做的工作

当前 0.2.0 数据集由项目开发阶段人工构造，并已完成第一轮内部逐项复核。进入公开发布门前，应由另一名具备学术英语经验的人复核金标准，并根据首轮结果确定正式通过门槛。测试集不能根据某一次模型输出反向修改，否则会失去独立评价价值。
