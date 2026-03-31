'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();

  const { data } = useQuery({
    queryKey: ['class-detail', classId],
    queryFn: () => apiClient.get(`/teacher/classes/${classId}`).then((r: { data: Record<string, unknown> }) => r.data),
  });

  const cls = data as {
    name: string; join_code: string; semester: string;
    students: {
      id: string; username: string; total_value: number; total_return_pct: number;
      total_xp: number; level_name: string; lessons_completed: number;
    }[];
  } | undefined;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/teacher/classes" className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm">
        <ChevronLeft size={16} />
        My Classes
      </Link>

      {cls && (
        <>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white">{cls.name}</h1>
              <p className="text-slate-400 mt-1">{cls.semester}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Join code:</span>
              <span className="bg-surface-800 text-white px-3 py-1.5 rounded-lg font-mono tracking-widest text-lg font-bold">
                {cls.join_code}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Students', value: cls.students.length, icon: Users },
              { label: 'Avg Return', value: formatPercent(cls.students.reduce((s, st) => s + (st.total_return_pct ?? 0), 0) / (cls.students.length || 1)), icon: TrendingUp },
              { label: 'Avg Portfolio', value: formatUSD(cls.students.reduce((s, st) => s + (st.total_value ?? 100000), 0) / (cls.students.length || 1)), icon: TrendingUp },
              { label: 'Avg Lessons', value: Math.round(cls.students.reduce((s, st) => s + (st.lessons_completed ?? 0), 0) / (cls.students.length || 1)), icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className="text-brand-400" />
                  <p className="text-slate-400 text-xs">{label}</p>
                </div>
                <p className="text-xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Student Table */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-surface-800">
              <h2 className="font-semibold text-white">Student Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-surface-800">
                    <th className="text-left px-5 py-3">Rank</th>
                    <th className="text-left px-5 py-3">Student</th>
                    <th className="text-right px-5 py-3">Portfolio</th>
                    <th className="text-right px-5 py-3">Return</th>
                    <th className="text-right px-5 py-3">XP</th>
                    <th className="text-right px-5 py-3">Lessons</th>
                  </tr>
                </thead>
                <tbody>
                  {cls.students.map((s, i) => (
                    <tr key={s.id} className="border-b border-surface-800 hover:bg-surface-800/30">
                      <td className="px-5 py-3 text-slate-500 text-sm">#{i + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-brand-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {s.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{s.username}</p>
                            <p className="text-xs text-slate-500">{s.level_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-300 font-mono">{formatUSD(s.total_value ?? 100000)}</td>
                      <td className={cn('px-5 py-3 text-right text-sm font-mono font-semibold', (s.total_return_pct ?? 0) >= 0 ? 'positive' : 'negative')}>
                        {formatPercent(s.total_return_pct ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-yellow-400 font-semibold">{s.total_xp ?? 0}</td>
                      <td className="px-5 py-3 text-right text-sm text-slate-300">{s.lessons_completed ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
