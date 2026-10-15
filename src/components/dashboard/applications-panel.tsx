"use client";

import { formatTeachingDate } from "@/lib/teaching-time";

import { Archive, CheckCircle2, Search, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { AccountApprovalDialog } from "@/components/dashboard/account-approval-dialog";
import type { AdminApplication, AdminCampus, AdminTeacher, AdminTuitionPackage } from "@/components/dashboard/admin-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { formatApplicationRole, formatApplicationStatus, safeAdminError } from "@/lib/admin-localization";
import { applicationDeletionReasonOptions, type ApplicationDeletionReasonCode } from "@/lib/application-deletion-reasons";
import { apiErrorCode } from "@/lib/localized-error";

export function ApplicationsPanel({ locale, initialApplications, teachers, packages, campuses }: { locale: Locale; initialApplications: AdminApplication[]; teachers: AdminTeacher[]; packages: AdminTuitionPackage[]; campuses: AdminCampus[] }) {
  const [applications, setApplications] = useState(initialApplications);
  useEffect(() => setApplications(initialApplications), [initialApplications]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [deletingApplication, setDeletingApplication] = useState<AdminApplication | null>(null);
  const [deleteReasonCode, setDeleteReasonCode] = useState<ApplicationDeletionReasonCode>(applicationDeletionReasonOptions[0].code);
  const [deleteLinkedAccount, setDeleteLinkedAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const visible = useMemo(() => applications.filter((item) => (filter === "ALL" || item.status === filter) && `${item.name} ${item.phone} ${item.email ?? ""}`.toLowerCase().includes(query.toLowerCase())), [applications, filter, query]);

  async function review(id: string, status: "REVIEWING" | "DECLINED" | "ARCHIVED") {
    const response = await fetch(`/api/admin/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setApplications((items) => items.map((item) => item.id === id ? { ...item, status } : item));
  }

  function openDelete(application: AdminApplication) {
    setDeletingApplication(application);
    setDeleteReasonCode(applicationDeletionReasonOptions[0].code);
    setDeleteLinkedAccount(false);
    setMessage("");
  }

  async function remove() {
    if (!deletingApplication || deleting) return;
    const application = deletingApplication;
    const reason = applicationDeletionReasonOptions.find((item) => item.code === deleteReasonCode) ?? applicationDeletionReasonOptions[0];
    setDeleting(true);
    setMessage("");
    const response = await fetch(`/api/admin/applications/${application.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE", reason: reason.notice[locale], deleteLinkedAccount }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(safeAdminError(locale, "删除申请失败，请刷新后重试。", apiErrorCode(body), "Application deletion failed."));
      setDeleting(false);
      return;
    }
    setApplications((items) => items.filter((item) => item.id !== application.id));
    setDeletingApplication(null);
    setDeleting(false);
    setMessage(locale === "zh" ? "申请记录已删除。" : locale === "ja" ? "申込み記録を削除しました。" : "Application record deleted.");
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-piano/35" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-11" placeholder={locale === "zh" ? "搜索姓名、电话或邮箱" : "Search name, phone, or email"} /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-12 rounded-full border border-white/40 bg-white/60 px-4 text-sm"><option value="ALL">{locale === "zh" ? "全部状态" : "All statuses"}</option>{["PENDING", "REVIEWING", "CONFIRMED", "DECLINED", "ARCHIVED"].map((status) => <option value={status} key={status}>{formatApplicationStatus(status, locale)}</option>)}</select>
      </div>
      <div className="grid gap-3">
        {visible.map((application) => (
          <article key={application.id} className="glass-surface grid gap-4 rounded-[22px] p-4 lg:grid-cols-[minmax(180px,0.7fr)_minmax(220px,1fr)_auto] lg:items-center">
            <div><div className="flex items-center gap-2"><p className="font-semibold">{application.name}</p><span className="rounded-full bg-piano/[0.06] px-2 py-1 text-[10px]">{formatApplicationRole(application.role, locale)}</span></div><p className="mt-1 text-xs text-piano/45">{application.phone} · {formatTeachingDate(new Date(application.createdAt), locale)}</p></div>
            <div><p className="text-sm text-piano/60">{application.goal || application.education || (locale === "zh" ? "未填写补充说明" : "No additional note")}</p><p className="mt-1 text-xs font-medium text-gold">{formatApplicationStatus(application.status, locale)}</p>{application.approvedUser ? <p className="mt-1 text-xs text-piano/45">{locale === "zh" ? "账号" : "Account"} · {application.approvedUser.email}</p> : null}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => review(application.id, "REVIEWING")} disabled={application.status === "CONFIRMED"}><ShieldCheck size={14} />{locale === "zh" ? "审核" : "Review"}</Button>
              {application.status === "CONFIRMED" ? (
                <Button size="sm" disabled={application.status === "CONFIRMED"}><CheckCircle2 size={14} />{locale === "zh" ? "账号已开通" : "Account approved"}</Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => setSelected(application)}><CheckCircle2 size={14} />{locale === "zh" ? "批准并建号" : "Approve"}</Button>
                  <Button size="sm" variant="outline" onClick={() => review(application.id, "DECLINED")}><XCircle size={14} />{locale === "zh" ? "拒绝" : "Decline"}</Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => review(application.id, "ARCHIVED")} disabled={application.status === "CONFIRMED"} aria-label={locale === "zh" ? "归档" : "Archive"}><Archive size={14} /></Button>
              <Button size="sm" variant="outline" onClick={() => openDelete(application)} aria-label={locale === "zh" ? "永久删除" : locale === "ja" ? "完全に削除" : "Delete permanently"}><Trash2 size={14} /></Button>
            </div>
          </article>
        ))}
        {!visible.length ? <p className="py-14 text-center text-sm text-piano/45">{locale === "zh" ? "暂无符合条件的账号申请" : "No matching applications"}</p> : null}
      </div>
      {message ? <p role="status" className="text-sm text-piano/58">{message}</p> : null}
      {selected ? <AccountApprovalDialog locale={locale} application={selected} teachers={teachers} packages={packages} campuses={campuses} onClose={() => setSelected(null)} onApproved={(id, account) => {
        setApplications((items) => items.map((item) => item.id === id ? { ...item, status: "CONFIRMED", approvedUser: account } : item));
        setSelected((item) => item?.id === id ? { ...item, status: "CONFIRMED", approvedUser: account } : item);
      }} /> : null}
      <Dialog open={Boolean(deletingApplication)} onOpenChange={(open) => { if (!open && !deleting) setDeletingApplication(null); }}>
        <DialogContent className="w-[calc(100vw-24px)] max-w-lg">
          <DialogTitle>{locale === "zh" ? "删除申请记录" : locale === "ja" ? "申込み記録を削除" : "Delete application record"}</DialogTitle>
          <DialogDescription>
            {locale === "zh" ? `请选择删除 ${deletingApplication?.name ?? "该申请"} 的原因。操作完成后不可恢复。` : locale === "ja" ? "削除理由を選択してください。この操作は元に戻せません。" : "Choose a reason. This action cannot be undone."}
          </DialogDescription>
          <label className="grid gap-2 text-sm">
            <span>{locale === "zh" ? "删除原因" : locale === "ja" ? "削除理由" : "Reason"}</span>
            <select value={deleteReasonCode} onChange={(event) => setDeleteReasonCode(event.target.value as ApplicationDeletionReasonCode)} className="h-12 rounded-full border border-piano/10 bg-white px-4">
              {applicationDeletionReasonOptions.map((reason) => <option key={reason.code} value={reason.code}>{reason.label[locale]}</option>)}
            </select>
          </label>
          {deletingApplication?.approvedUser ? (
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-piano/62">
              <input type="checkbox" checked={deleteLinkedAccount} onChange={(event) => setDeleteLinkedAccount(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-piano" />
              <span>{locale === "zh" ? "同时关闭并删除关联登录账号；仅勾选此项时才会发送账号关闭通知邮件。" : locale === "ja" ? "関連するログインアカウントも削除し、アカウント終了のお知らせを送信します。" : "Also delete the linked login account and send an account-closure notice."}</span>
            </label>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeletingApplication(null)} disabled={deleting}>{locale === "zh" ? "取消" : locale === "ja" ? "キャンセル" : "Cancel"}</Button>
            <Button type="button" onClick={remove} disabled={deleting}>{deleting ? (locale === "zh" ? "正在删除..." : locale === "ja" ? "削除中..." : "Deleting...") : (locale === "zh" ? "确认删除" : locale === "ja" ? "削除を確認" : "Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
