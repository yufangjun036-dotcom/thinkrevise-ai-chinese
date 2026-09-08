# 独立学术英语评审说明（待使用）

## 目的

这份说明供第二名具备学术英语经验的评审者使用。评审者只判断文章和预设标签，不查看系统输出、提示词、修复记录或既往分数，避免模型结果反向影响金标准。

## 评审材料

- `cases.json`：36 个基础准确率案例。
- `academic-stability-cases.json`：17 个短篇学术判断正反例。
- `academic-longform-cases.json`：6 个内部编写的长文边界案例。
- `INDEPENDENT_REVIEW_PACKET_ZH.md`：自动生成、可直接填写的 59 案例评审表。
- `independent-review-response.template.json`：完成后用于机器汇总的 86 标签空白模板。

三套材料在完成独立复核前都不得用于宣称真实总体正确率。长文和稳定性案例当前状态均为 `internal_curated_pending_independent_review`。

## 每个案例的盲审问题

1. 预设问题是否真实存在，还是只是可选的文体偏好？
2. 问题类别是否准确？
3. 标记片段是否足以让学习者理解问题，是否过短或过长？
4. 建议方向是否保留作者原意，是否引入未经原文支持的事实或因果？
5. 对照文本是否真的不应在目标维度报错？
6. 是否发现预设标签之外的明确问题？如有，写明原文片段和理由。

## 允许的判定

- `同意`：标签和理由可以直接保留。
- `修改`：问题存在，但类别、范围或理由需要调整。
- `删除`：文本不存在该问题，或只是没有上下文依据的偏好。
- `不确定`：需要课程要求、学科规范或更多上下文才能判断。

## 独立性要求

- 评审前不运行产品，也不查看 `reports/accuracy/`。
- 不因为系统能否检出而改变标签。
- 对学术语域、论点、衔接和论证保持“允许合理变体”的原则。
- 只把拼写、主谓一致等可直接证明的语言问题标为确定错误。
- 评审完成后保留原判定、修改理由、日期和评审者背景；若双方有分歧，单独记录，不用多数计数掩盖。

## 完成后的处理

1. 将空白结果模板复制为 `independent-review-response.local.json`；该文件已排除出 Git。
2. 把“同意／修改／删除／不确定”分别填为 `agree`、`modify`、`delete`、`uncertain`。
3. “修改”或“删除”必须填写 `notes`。
4. 运行 `INDEPENDENT_REVIEW_FILE=benchmarks/accuracy/independent-review-response.local.json npm run review:score`。
5. 所有 `delete`、`uncertain` 和新增发现必须人工裁决，不能自动覆盖原金标准。
