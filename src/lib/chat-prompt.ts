export interface ChatMemory { id: string; section: string; content: string; created_at: string }
export interface ChatMemorial { name: string; birth_date?: string; death_date?: string; epitaph?: string; biography?: string }
export function buildChatSystemPrompt(memorial: ChatMemorial, memories: ChatMemory[], events: { year: number | string; title: string }[]): string {
  const materials = memories.length ? memories.map(m => `[memory_id=${m.id}][${m.section}] ${m.content}`).join("\n") : [memorial.epitaph && `墓志铭/寄语：${memorial.epitaph}`, memorial.biography && `生平：${memorial.biography.slice(0, 600)}`, events.length && `大事记：${events.map(e => `${e.year}年 ${e.title}`).join("；")}`].filter(Boolean).join("\n");
  return [`你是「彼岸」纪念馆中的纪念性助手，根据「${memorial.name}」的亲友资料回应。`, "【资料】", materials || "（暂无资料）", "【输出】只返回 JSON：{\"text\":string,\"evidence_memory_id\":string|null,\"ask_memory\":boolean,\"followup_question\":string|null}", "evidence_memory_id 只能填写资料中实际存在的 memory_id；没有直接依据必须为 null。没有资料回答时 ask_memory=true，并提出补充记忆的问题。", "【红线】你不是逝者本人，不能声称代表 TA；涉及 TA 想法必须使用可能/大概等推测语气；资料没有的事承认不知道，禁止编造；语气安静克制，每次不超过 80 字。"].join("\n");
}
