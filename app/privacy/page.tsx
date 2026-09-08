import Link from "next/link";

export const metadata = {
  title: "隐私与 AI 使用说明｜ThinkRevise AI (Chinese)",
};

export default function PrivacyPage() {
  return <main className="privacy-page">
    <nav><Link href="/">← 返回 ThinkRevise AI</Link></nav>
    <article>
      <p className="overline">公开测试版说明</p>
      <h1>隐私与 AI 使用说明</h1>
      <p className="privacy-lead">ThinkRevise AI 用于学术英语写作练习。请在提交前删除姓名、学号、联系方式、未公开研究数据以及其他个人或敏感信息。</p>

      <section>
        <h2>哪些内容会发送给 AI</h2>
        <p>当你使用实时分析、自定义主题理解或演示初稿生成功能时，当前文章、主题描述、目标词、自我检查和必要的上一轮反馈会发送到服务端，再由服务端发送给 OpenAI API。API 密钥只保存在服务端，不会进入浏览器。</p>
      </section>

      <section>
        <h2>本项目保存什么</h2>
        <p>当前版本不要求注册账号，也没有建立保存文章的应用数据库。为了避免刷新时丢稿，写作进度暂存在当前浏览器标签页的 sessionStorage 中；主动重新开始或关闭该标签页会清除这项临时进度。</p>
        <p>服务端只记录排查故障和控制费用所需的匿名状态，例如请求类型、耗时、令牌数量和错误类别，不应记录完整文章、主题内容或 API 密钥。</p>
      </section>

      <section>
        <h2>OpenAI 数据处理边界</h2>
        <p>本项目向 Responses API 发送请求时设置 <code>store: false</code>，并且不主动建立可供本应用再次读取的模型响应记录。根据 OpenAI 官方数据控制说明，API 数据默认不会用于训练模型，除非账户明确选择共享；但默认的滥用监控日志仍可能包含提示和响应，并通常最多保留 30 天。符合条件的组织可以另行申请更严格的数据保留控制。</p>
        <p><a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">查看 OpenAI 官方数据控制说明</a></p>
      </section>

      <section>
        <h2>AI 反馈的限制</h2>
        <p>AI 可能漏掉错误、误判正确表达或改变原意。反馈和最终改写都需要学习者自行核对，不能代替教师评分、事实核查、引用检查或课程对 AI 使用方式的规定。</p>
      </section>

      <section>
        <h2>公开使用保护</h2>
        <p>系统会限制单个访客的请求频率、每日次数和同时进行的请求数，并设置全站每日额度保护。达到限制时，文章仍会保留在浏览器中，稍后即可重试。</p>
      </section>

      <p className="privacy-updated">更新日期：2026 年 9 月 8 日</p>
    </article>
  </main>;
}
