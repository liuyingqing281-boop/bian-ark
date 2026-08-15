import { defaultLocale, hasLocale } from "../../dictionaries";

interface Section {
  h: string;
  p: string;
}

const ZH: { title: string; updated: string; sections: Section[] } = {
  title: "隐私政策",
  updated: "最近更新：2026-08-06",
  sections: [
    { h: "1. 我们收集的信息", p: "账号信息（邮箱、手机号、微信 OpenID）、您创建的纪念馆内容（姓名、生卒日期、墓志铭、生平、照片与视频）、登录与支付所需的必要日志，以及为改进服务而收集的匿名使用统计（登录通道、功能成功率等，不含内容本身）。" },
    { h: "2. 逝者数据的特殊性", p: "纪念馆涉及逝者肖像、生平与影像。创建者声明其为逝者近亲属或已获得合法授权；我们以此声明为处理基础。若近亲属对某纪念馆内容有异议，可联系我们核实后处理（更正、限制可见或删除）。" },
    { h: "3. AI 生成内容", p: "平台提供 AI 祭品图片生成与数字人影像生成。您上传的肖像、声音样本仅用于完成对应生成任务；任务完成后，供应商侧将在约定期限内删除原始素材。依据《互联网信息服务深度合成管理规定》，所有 AI 生成内容均以显著方式标识（水印或「AI 生成」角标），不得用于冒充他人或误导公众。" },
    { h: "4. 声音克隆与数字人", p: "声音克隆仅在您勾选《肖像与声音授权声明》后进行；克隆音色仅用于本纪念馆内的数字人影像，不用于其他场景、不向第三方出售。数字人任务须经人工审核通过后才会公开展示；禁止生成名人或未经授权的他人形象。" },
    { h: "5. 信息的共享", p: "不出售您的个人信息。仅在以下情形共享：生成任务所需的国内供应商（阿里云、数字人服务商等，均签署数据保密与删除协议）、支付渠道（Stripe）、法律法规要求。" },
    { h: "6. 存储与删除", p: "数据存储于境内服务器。您可随时删除纪念馆、媒体与自定义祭品；删除账号后，其创建的私密纪念馆将被删除，已公开的纪念馆在移除个人信息后保留或按您的要求一并删除。" },
    { h: "7. 您的权利", p: "您有权访问、更正、导出、删除个人信息，有权撤回授权（撤回不影响撤回前基于授权已完成的处理）。通过登录页验证码即可管理账号。" },
    { h: "8. 联系我们", p: "对本政策或逝者数据处理有任何疑问，请通过平台内反馈渠道联系我们，我们将在 15 个工作日内答复。" },
  ],
};

const EN: { title: string; updated: string; sections: Section[] } = {
  title: "Privacy Policy",
  updated: "Last updated: 2026-08-06",
  sections: [
    { h: "1. Information we collect", p: "Account identifiers (email, phone, WeChat OpenID), memorial content you create (names, dates, epitaphs, biographies, photos and videos), operational logs required for login and payment, and anonymous usage statistics (login channels, feature success rates — never the content itself)." },
    { h: "2. Data of the deceased", p: "Memorials involve the likeness, biography and media of deceased persons. Creators declare they are close relatives or hold legal authorization, which forms the basis of our processing. Relatives may contact us to correct, restrict or remove content after verification." },
    { h: "3. AI-generated content", p: "We offer AI offering-image generation and digital human generation. Uploaded likeness and voice samples are used solely to fulfill the requested task and are deleted by the vendor after the agreed retention window. Per China's Deep Synthesis Regulation, all AI-generated content is prominently labeled (watermark or an AI badge) and must not be used to impersonate or mislead." },
    { h: "4. Voice cloning and digital humans", p: "Voice cloning happens only after you accept the likeness-and-voice consent statement. Cloned voices are used exclusively within your memorial's digital human video — never for other purposes, never sold. Digital human output is reviewed by a human before publication. Generating celebrities or unauthorized persons is prohibited." },
    { h: "5. Sharing", p: "We do not sell personal information. We share only with: domestic vendors required to fulfill generation tasks (under confidentiality and deletion agreements), payment processors (Stripe), and where required by law." },
    { h: "6. Storage and deletion", p: "Data is stored on servers in mainland China. You may delete memorials, media and custom offerings at any time. When an account is deleted, its private memorials are removed; public memorials are anonymized or removed on request." },
    { h: "7. Your rights", p: "You may access, correct, export and delete your personal information, and withdraw consent (without affecting processing already completed). Manage your account via code-based sign-in." },
    { h: "8. Contact", p: "Questions about this policy or deceased-person data handling: reach us through the in-product feedback channel. We respond within 15 business days." },
  ],
};

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
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