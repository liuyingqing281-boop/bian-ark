import { defaultLocale, hasLocale } from "../../dictionaries";

interface Section {
  h: string;
  p: string;
}

const ZH: { title: string; updated: string; sections: Section[] } = {
  title: "用户协议",
  updated: "最近更新：2026-08-06",
  sections: [
    { h: "1. 服务说明", p: "彼岸是在线缅怀平台，提供纪念馆创建、虚拟祭品供奉、亲友共同缅怀、开放数字墓园、AI 祭品生成与数字人影像等服务。免费功能长期可用，会员与增值服务以页面公示为准。" },
    { h: "2. 账号与登录", p: "支持微信扫码、邮箱验证码、手机号验证码登录。您应保证账号信息真实，并对账号下的行为负责。" },
    { h: "3. 内容规范", p: "禁止发布违法违规、侮辱诽谤、侵犯他人肖像权/名誉权的内容；禁止为未逝世者恶意建馆；禁止利用平台从事迷信诈骗等非法活动。违规内容经审核或举报核实后将予删除，情节严重者封禁账号。" },
    { h: "4. 逝者形象与授权", p: "创建纪念馆、上传逝者肖像/声音前，您须为逝者近亲属或已获合法授权。数字人功能须单独勾选授权声明；禁止生成名人或未经授权的他人形象。" },
    { h: "5. AI 生成内容", p: "AI 生成内容均以显著标识展示。您仅可将 AI 生成内容用于缅怀目的，不得用于冒充、误导、商业宣传或其他违反《互联网信息服务深度合成管理规定》的用途。" },
    { h: "6. 会员与付费", p: "会员权益与价格以会员页公示为准。数字人重做等单次付费服务，若因平台原因生成失败，将自动退还额度或退款。支付由 Stripe 处理，后续将支持微信支付/支付宝。" },
    { h: "7. 内容权属", p: "您上传的内容版权归原作者所有，您授予平台为提供服务所必需的存储、展示与处理许可。平台的界面、标识与代码归平台所有。" },
    { h: "8. 服务变更与免责", p: "我们可能调整功能与配额并提前公示。因不可抗力、供应商故障导致的服务中断，我们将尽力恢复但不承担间接损失。" },
    { h: "9. 争议解决", p: "本协议适用中华人民共和国法律。争议先行协商，协商不成提交平台运营主体所在地有管辖权的人民法院。" },
  ],
};

const EN: { title: string; updated: string; sections: Section[] } = {
  title: "Terms of Service",
  updated: "Last updated: 2026-08-06",
  sections: [
    { h: "1. The service", p: "Bi'an is an online remembrance platform offering memorial creation, virtual offerings, shared mourning with relatives, a public digital cemetery, AI offering generation and digital human videos. Core features remain free; membership and add-ons are priced as shown in the product." },
    { h: "2. Accounts", p: "Sign in via WeChat scan, email code or SMS code. You are responsible for the accuracy of your account information and all activity under it." },
    { h: "3. Content rules", p: "No unlawful, defamatory or rights-infringing content; no malicious memorials for living persons; no fraudulent use of the platform. Violations are removed after review or verified reports; severe cases lead to account suspension." },
    { h: "4. Likeness and consent", p: "Before creating a memorial or uploading a deceased person's likeness or voice, you must be a close relative or hold legal authorization. The digital human feature requires a separate consent checkbox. Generating celebrities or unauthorized persons is prohibited." },
    { h: "5. AI-generated content", p: "AI-generated content is prominently labeled. You may use it only for remembrance — not for impersonation, deception, commercial promotion, or any use violating China's Deep Synthesis Regulation." },
    { h: "6. Membership and payments", p: "Membership benefits and pricing are shown on the membership page. For one-off paid services such as digital human regeneration, failed generations automatically restore the credit or are refunded. Payments are processed by Stripe; WeChat Pay / Alipay support is planned." },
    { h: "7. Content rights", p: "You retain rights to content you upload and grant us the license needed to store, display and process it for the service. The platform's UI, branding and code belong to us." },
    { h: "8. Changes and liability", p: "Features and quotas may change with prior notice. For outages caused by force majeure or vendors we will restore service as quickly as possible but are not liable for indirect damages." },
    { h: "9. Disputes", p: "These terms are governed by the laws of the PRC. Disputes are resolved through negotiation first, then by the competent court at the operator's domicile." },
  ],
};

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const c = lang === "en" ? EN : ZH;
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl tracking-widest text-amber-300 mb-2">{c.title}</h1>
      <p className="text-xs text-stone-600 mb-10">{c.updated}</p>
      <div className="space-y-6">
        {c.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-sm text-amber-500 mb-2">{s.h}</h2>
            <p className="text-sm text-stone-400 leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}