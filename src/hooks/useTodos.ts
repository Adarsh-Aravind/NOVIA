import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Todo, TodoRecurrence } from '../types';

export function useTodos(coupleId: string | null, userId: string | null) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchTodos = async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('couple_id', coupleId)
      .order('due_at', { ascending: true });

    if (error) {
      console.error('[Todos] Fetch error:', error);
    } else {
      setTodos((data || []) as Todo[]);
    }
  };

  useEffect(() => {
    if (!coupleId) {
      setTodos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchTodos().finally(() => setLoading(false));

    const channel = supabase
      .channel(`todos-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: `couple_id=eq.${coupleId}` },
        () => fetchTodos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const addTodo = async (input: {
    title: string;
    notes?: string;
    dueAt: Date;
    recurrence: TodoRecurrence;
  }) => {
    if (!coupleId || !userId || !input.title.trim()) return null;

    const { data, error } = await supabase
      .from('todos')
      .insert({
        couple_id: coupleId,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        due_at: input.dueAt.toISOString(),
        recurrence: input.recurrence,
        is_completed: false,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Todos] Add failed:', error);
      return null;
    }
    await fetchTodos();
    return data as Todo;
  };

  const toggleTodo = async (todoId: string, completed: boolean) => {
    const { error } = await supabase
      .from('todos')
      .update({ is_completed: completed })
      .eq('id', todoId);
    if (error) console.error('[Todos] Toggle failed:', error);
    else await fetchTodos();
  };

  const deleteTodo = async (todoId: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', todoId);
    if (error) console.error('[Todos] Delete failed:', error);
    else await fetchTodos();
  };

  return {
    todos,
    loading,
    addTodo,
    toggleTodo,
    deleteTodo,
  };
}
