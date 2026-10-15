"use client";

import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState, useEffect } from "react";
import type { AdminTeacher, AdminTuitionPackage } from "@/components/dashboard/admin-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { formatMinutes, safeAdminError } from "@/lib/admin-localization";
import { apiErrorCode } from "@/lib/localized-error";

function yuan(cents: number) { return (cents / 100).toFixed(0); }

export function TuitionManager({ locale, initialPackages, teachers }: { locale: Locale; initialPackages: AdminTuitionPackage[]; teachers: AdminTeacher[] }) {
  const [packages, setPackages] = useState(initialPackages);
  useEffect(() => setPackages(initialPackages), [initialPackages]);
  const [editing, setEditing] = useState<AdminTuitionPackage | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const grouped = useMemo(() => teachers.map((teacher) => ({ teacher, packages: packages.filter((item) => item.teacherId === teacher.id).sort((a, b) => a.sortOrder - b.sortOrder) })), [packages, teachers]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget);
    const originalUnitPriceCents = Math.round(Number(form.get("originalPriceYuan")) * 100);
    const unitPriceCents = Math.round(Number(form.get("priceYuan")) * 100);
    const payload = { teacherId: String(form.get("teacherId")), name: String(form.get("name")), lessonDurationMinutes: Number(form.get("lessonDurationMinutes")), lessonCount: Number(form.get("lessonCount")), originalUnitPriceCents, unitPriceCents, discountLabel: String(form.get("discountLabel")), validityMonths: Number(form.get("validityMonths")), isActive: form.get("isActive") === "on", sortOrder: Number(form.get("sortOrder")) };
    const url = editing ? `/api/admin/tuition-packages/${editing.id}` : "/api/admin/tuition-packages";
    const response = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) { setMessage(safeAdminError(locale, "课包保存失败，请检查内容后重试。", apiErrorCode(body), "Package save failed.")); return; }
    const teacherName = teachers.find((teacher) => teacher.id === body.data.teacherId)?.name ?? "";
    const next = { ...body.data, teacherName } as AdminTuitionPackage;
    setPackages((items) => editing ? items.map((item) => item.id === editing.id ? next : item) : [...items, next]);
    setEditing(null); setCreating(false); setMessage(locale === "zh" ? "私有课包已保存。" : "Private package saved.");
  }

  async function remove(item: AdminTuitionPackage) {
    if (!window.confirm(locale === "zh" ? `确认删除 ${item.teacherName} 的 ${item.name}？历史学员快照会保留。` : `Delete ${item.name} for ${item.teacherName}? Historical snapshots remain.`)) return;
    const response = await fetch(`/api/admin/tuition-packages/${item.id}`, { method: "DELETE" });
    if (response.ok) setPackages((items) => items.filter((pkg) => pkg.id !== item.id));
  }

  return <div className="grid gap-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">{locale === "zh" ? "教师私有课价" : "Private teacher tuition"}</h2><p className="mt-1 text-xs text-piano/45">{locale === "zh" ? "仅管理角色可见，不会进入官网、学员端或教师端。" : "Visible only to management roles; never exposed publicly or in portals."}</p></div><Button type="button" onClick={() => { setCreating(true); setEditing(null); }}><Plus size={16} />{locale === "zh" ? "新增课包" : "New package"}</Button></div>{creating || editing ? <PackageForm key={editing?.id ?? "new"} locale={locale} teachers={teachers} value={editing} onSubmit={save} onCancel={() => { setCreating(false); setEditing(null); }} /> : null}{message ? <p className="text-sm text-piano/60">{message}</p> : null}<div className="grid gap-5">{grouped.map(({ teacher, packages: teacherPackages }) => <section key={teacher.id}><h3 className="mb-3 text-sm font-semibold">{teacher.name}<span className="ml-2 font-normal text-piano/42">{teacher.title}</span></h3><div className="overflow-x-auto rounded-[22px] border border-piano/[0.06] bg-white/52"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-piano/45"><tr><th className="px-4 py-3">{locale === "zh" ? "课包" : "Package"}</th><th className="px-4 py-3">{locale === "zh" ? "时长" : "Duration"}</th><th className="px-4 py-3">{locale === "zh" ? "原价/节" : "Original"}</th><th className="px-4 py-3">{locale === "zh" ? "实收/节" : "Unit"}</th><th className="px-4 py-3">{locale === "zh" ? "有效期" : "Validity"}</th><th className="px-4 py-3">{locale === "zh" ? "操作" : "Actions"}</th></tr></thead><tbody>{teacherPackages.map((item) => <tr key={item.id} className="border-t border-piano/[0.05]"><td className="px-4 py-3 font-medium">{item.name}<span className="ml-2 text-xs text-gold">{item.discountLabel}</span></td><td className="px-4 py-3 text-piano/55">{item.lessonCount} × {formatMinutes(item.lessonDurationMinutes, locale)}</td><td className="px-4 py-3">¥{yuan(item.originalUnitPriceCents)}</td><td className="px-4 py-3 font-semibold">¥{yuan(item.unitPriceCents)}</td><td className="px-4 py-3">{item.validityMonths} {locale === "zh" ? "个月" : "months"}</td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(item); setCreating(false); }}><Edit3 size={14} />{locale === "zh" ? "编辑" : "Edit"}</Button><Button size="sm" variant="outline" onClick={() => remove(item)} aria-label={locale === "zh" ? "删除" : "Delete"}><Trash2 size={14} /></Button></div></td></tr>)}{!teacherPackages.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-piano/40">{locale === "zh" ? "暂无课包" : "No packages"}</td></tr> : null}</tbody></table></div></section>)}</div></div>;
}

function PackageForm({ locale, teachers, value, onSubmit, onCancel }: { locale: Locale; teachers: AdminTeacher[]; value: AdminTuitionPackage | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form onSubmit={onSubmit} className="glass-surface grid gap-3 rounded-[24px] p-4 sm:grid-cols-2 lg:grid-cols-4"><select name="teacherId" required defaultValue={value?.teacherId ?? teachers[0]?.id} className="h-12 rounded-full border border-white/45 bg-white/65 px-4 text-sm">{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</select><Input name="name" required minLength={2} defaultValue={value?.name ?? ""} placeholder={locale === "zh" ? "课包名称" : "Package name"} /><Input name="lessonDurationMinutes" type="number" min={15} max={180} required defaultValue={value?.lessonDurationMinutes ?? 45} placeholder={locale === "zh" ? "每节分钟" : "Minutes"} /><Input name="lessonCount" type="number" min={1} max={200} required defaultValue={value?.lessonCount ?? 12} placeholder={locale === "zh" ? "课时数" : "Lessons"} /><Input name="originalPriceYuan" type="number" min={1} step="0.01" required defaultValue={value ? yuan(value.originalUnitPriceCents) : ""} placeholder={locale === "zh" ? "原价/节（元）" : "Original/unit"} /><Input name="priceYuan" type="number" min={1} step="0.01" required defaultValue={value ? yuan(value.unitPriceCents) : ""} placeholder={locale === "zh" ? "实收/节（元）" : "Unit price"} /><Input name="discountLabel" required defaultValue={value?.discountLabel ?? "9.5 折"} placeholder={locale === "zh" ? "折扣标签" : "Discount"} /><Input name="validityMonths" type="number" min={1} max={60} required defaultValue={value?.validityMonths ?? 6} placeholder={locale === "zh" ? "有效月数" : "Validity months"} /><Input name="sortOrder" type="number" min={0} max={1000} required defaultValue={value?.sortOrder ?? 0} placeholder={locale === "zh" ? "排序" : "Sort"} /><label className="flex min-h-12 items-center gap-2 px-3 text-sm"><input name="isActive" type="checkbox" defaultChecked={value?.isActive ?? true} className="h-5 w-5 accent-piano" />{locale === "zh" ? "启用" : "Active"}</label><div className="flex gap-2 sm:col-span-2 lg:col-span-2"><Button type="submit"><Save size={15} />{locale === "zh" ? "保存" : "Save"}</Button><Button type="button" variant="outline" onClick={onCancel}><X size={15} />{locale === "zh" ? "取消" : "Cancel"}</Button></div></form>;
}
