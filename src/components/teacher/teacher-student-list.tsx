import type { Locale } from "@/i18n/routing";

export type TeacherStudentItem = {
  id: string;
  studentNumber: string;
  fullName: string;
  goal: string | null;
  updatedAt: string;
};

function copy(locale: Locale, zh: string, en: string, ja = en) {
  return locale === "zh" ? zh : locale === "ja" ? ja : en;
}

export function TeacherStudentList({ locale, students }: { locale: Locale; students: TeacherStudentItem[] }) {
  if (!students.length) return <p className="border-y border-piano/[0.06] py-12 text-center text-sm text-piano/40">{copy(locale, "暂无关联学员", "No linked students", "担当生徒はいません")}</p>;

  return (
    <ul className="divide-y divide-piano/[0.07] border-y border-piano/[0.07]">
      {students.map((student) => (
        <li key={student.id} className="flex min-w-0 items-start gap-3 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-piano/[0.07] text-sm font-semibold">{student.fullName.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{student.fullName}</p><p className="text-xs font-medium text-piano/42">{student.studentNumber}</p></div>
            <p className="mt-1 break-words text-sm leading-6 text-piano/50">{student.goal || copy(locale, "暂未记录学习目标", "No learning goal recorded", "学習目標は未登録です")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
