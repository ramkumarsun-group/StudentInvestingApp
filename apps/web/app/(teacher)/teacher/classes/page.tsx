'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Users, GraduationCap, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatUSD } from '@student-investing/shared-utils';

export default function TeacherClassesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', semester: '', academicYear: '2025-2026' });

  const { data } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => apiClient.get('/teacher/classes').then((r: { data: unknown[] }) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => apiClient.post('/teacher/classes', data),
    onSuccess: () => {
      toast.success('Class created!');
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['teacher-classes'] });
    },
    onError: () => toast.error('Failed to create class'),
  });

  const classes = (data ?? []) as {
    id: string; name: string; join_code: string; student_count: number;
    semester: string; academic_year: string; is_active: boolean;
  }[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GraduationCap size={24} className="text-brand-400" />
          My Classes
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Class
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Class</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Class Name</label>
                <input className="input" placeholder="AP Finance Period 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Semester</label>
                <input className="input" placeholder="Fall 2025" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Academic Year</label>
                <input className="input" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                <button
                  className="btn-primary flex-1"
                  disabled={!form.name || createMutation.isPending}
                  onClick={() => createMutation.mutate(form)}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Classes Grid */}
      {classes.length === 0 ? (
        <div className="card p-12 text-center">
          <GraduationCap size={48} className="text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No classes yet. Create your first class to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/classes/${c.id}`}
              className="card p-5 hover:border-surface-700 transition-all group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors">{c.name}</h3>
                  <p className="text-slate-500 text-sm mt-0.5">{c.semester} · {c.academic_year}</p>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400" />
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Users size={14} />
                  {c.student_count} students
                </span>
                <span className="bg-surface-800 text-slate-300 px-2 py-0.5 rounded font-mono text-xs tracking-widest">
                  {c.join_code}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
