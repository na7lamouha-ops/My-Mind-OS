import { SubmitButton } from '@/components/form';
import { Pill } from '@/components/ui';
import { deleteTaskCmd, setTaskStatusCmd, toggleNextActionCmd } from './actions';
import { taskStatusLabel } from '@/lib/labels';
import type { Task } from '@/schemas';

export function TaskRow({ task, projectName }: { task: Task; projectName?: string }) {
  const done = task.status === 'done';
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={done ? 'text-muted line-through' : ''}>{task.title}</span>
        {task.is_next_action && !done && <Pill value="doing" label="التالية" />}
        <Pill value={task.status} label={taskStatusLabel[task.status]} />
        {projectName && <span className="text-xs text-muted">— {projectName}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!done && task.status === 'todo' && (
          <form action={setTaskStatusCmd}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="project_id" value={task.project_id} />
            <input type="hidden" name="status" value="doing" />
            <SubmitButton size="sm" variant="ghost">
              ابدأ
            </SubmitButton>
          </form>
        )}
        {!done ? (
          <form action={setTaskStatusCmd}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="project_id" value={task.project_id} />
            <input type="hidden" name="status" value="done" />
            <SubmitButton size="sm" variant="primary">
              أكمل
            </SubmitButton>
          </form>
        ) : (
          <form action={setTaskStatusCmd}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="project_id" value={task.project_id} />
            <input type="hidden" name="status" value="todo" />
            <SubmitButton size="sm" variant="ghost">
              أعد الفتح
            </SubmitButton>
          </form>
        )}
        <form action={toggleNextActionCmd}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="project_id" value={task.project_id} />
          <input type="hidden" name="is_next_action" value={task.is_next_action ? 'false' : 'true'} />
          <SubmitButton size="sm" variant="ghost">
            {task.is_next_action ? 'إلغاء التالية' : 'اجعلها التالية'}
          </SubmitButton>
        </form>
        <form action={deleteTaskCmd}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="project_id" value={task.project_id} />
          <SubmitButton size="sm" variant="danger">
            حذف
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
