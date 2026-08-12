import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { api, handleApiError } from '../../lib/api';
import { Customer, CustomerNote } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

const noteSchema = z.object({ note: z.string().min(1, 'Note cannot be empty') });
type NoteForm = z.infer<typeof noteSchema>;

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNoteForm, setShowNoteForm] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Customer>(`/customers/${id}`).then(r => r.data),
  });

  const { data: notes } = useQuery({
    queryKey: ['customer-notes', id],
    queryFn: () => api.get<{ data: CustomerNote[] }>(`/customers/${id}/notes`).then(r => r.data),
    enabled: !!id,
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
  });

  const noteMutation = useMutation({
    mutationFn: (data: NoteForm) =>
      api.post(`/customers/${id}/notes`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', id] });
      toast.success('Note added');
      reset();
      setShowNoteForm(false);
    },
    onError: handleApiError,
  });

  if (isLoading || !customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canEdit = user?.role === 'admin' || user?.role === 'sales';
  const canNote = user?.role === 'admin' || user?.role === 'sales';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2" aria-label="Go back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <StatusBadge status={customer.status} />
            <StatusBadge status={customer.customer_type} />
          </div>
          {customer.business_name && (
            <p className="text-sm text-gray-500 mt-0.5">{customer.business_name}</p>
          )}
        </div>
        {canEdit && (
          <Link to={`/customers/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Mobile</p>
          <p className="font-semibold text-gray-900 mt-1">{customer.mobile}</p>
        </div>
        {customer.email && (
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Email</p>
            <p className="font-semibold text-gray-900 mt-1">{customer.email}</p>
          </div>
        )}
        {customer.gst_number && (
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">GST Number</p>
            <p className="font-semibold text-gray-900 mt-1">{customer.gst_number}</p>
          </div>
        )}
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Address</p>
          <p className="text-sm text-gray-700 mt-1">{customer.address}</p>
        </div>
        {customer.follow_up_date && (
          <div className={`card p-4 ${new Date(customer.follow_up_date) <= new Date() ? 'border-orange-300 bg-orange-50' : ''}`}>
            <p className="text-xs text-gray-500 uppercase font-medium">Follow-up Date</p>
            <p className={`font-semibold mt-1 ${new Date(customer.follow_up_date) <= new Date() ? 'text-orange-700' : 'text-gray-900'}`}>
              {format(new Date(customer.follow_up_date), 'MMMM d, yyyy')}
            </p>
          </div>
        )}
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Added By</p>
          <p className="text-sm text-gray-700 mt-1">{customer.created_by_name}</p>
          <p className="text-xs text-gray-400">{format(new Date(customer.created_at), 'MMM d, yyyy')}</p>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Notes</h2>
          {canNote && (
            <button
              className="btn-secondary text-sm"
              onClick={() => setShowNoteForm(!showNoteForm)}
            >
              {showNoteForm ? 'Cancel' : <><Plus className="w-4 h-4" />Add Note</>}
            </button>
          )}
        </div>

        {showNoteForm && (
          <form
            onSubmit={handleSubmit((d) => noteMutation.mutate(d))}
            className="mb-4 space-y-3"
          >
            <div>
              <label className="label" htmlFor="note">Note</label>
              <textarea
                id="note"
                rows={3}
                className={`input resize-none ${errors.note ? 'border-red-500' : ''}`}
                placeholder="Enter your note..."
                {...register('note')}
              />
              {errors.note && (
                <p className="mt-1 text-xs text-red-600">{errors.note.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary" disabled={noteMutation.isPending}>
              {noteMutation.isPending ? 'Saving...' : 'Save Note'}
            </button>
          </form>
        )}

        {!notes?.data || notes.data.length === 0 ? (
          <p className="text-sm text-gray-500">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.data.map((note) => (
              <li key={note.id} className="border-l-4 border-blue-200 pl-4 py-1">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {note.created_by_name} — {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
