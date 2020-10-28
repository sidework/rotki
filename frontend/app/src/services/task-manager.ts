import map from 'lodash/map';
import i18n from '@/i18n';
import { Task, TaskMeta } from '@/model/task';
import { TaskType } from '@/model/task-type';
import {
  ApiEventEntry,
  convertEventEntry,
  convertTradeHistoryOverview,
  TradeHistory
} from '@/model/trade-history-types';
import { api } from '@/services/rotkehlchen-api';
import { ActionResult, TaskNotFoundError } from '@/services/types-api';
import { Severity } from '@/store/notifications/consts';
import { notify } from '@/store/notifications/utils';
import store from '@/store/store';

class TaskManager {
  onTradeHistory(data: ActionResult<TradeHistory>, _meta: TaskMeta) {
    const { message, result } = data;

    if (message) {
      notify(
        `During trade history query we got:${message}. History report is probably not complete.`,
        'Trade History Query Warning',
        Severity.ERROR,
        true
      );
    }

    const { overview, all_events } = result;

    const payload = {
      overview: convertTradeHistoryOverview(overview),
      events: map(all_events, (event: ApiEventEntry) =>
        convertEventEntry(event)
      )
    };
    store.commit('reports/set', payload);
  }

  monitor() {
    const state = store.state;
    const taskState = state.tasks!;
    const { tasks: taskMap, locked } = taskState;

    for (const id in taskMap) {
      if (!Object.prototype.hasOwnProperty.call(taskMap, id)) {
        continue;
      }
      const task = taskMap[id];
      if (task.id == null) {
        notify(
          `Task ${task.type} -> ${task.meta.description} had a null identifier`,
          'Invalid task found',
          Severity.WARNING
        );
        continue;
      }

      if (locked.indexOf(task.id) > -1) {
        continue;
      }

      store.commit('tasks/lock', task.id);

      api
        .queryTaskResult(task.id, task.meta.numericKeys)
        .then(result => this.handleResult(result, task))
        .catch(e => {
          // When the request fails for any reason (pending or network error) then we unlock it
          store.commit('tasks/unlock', task.id);
          if (e instanceof TaskNotFoundError) {
            store.commit('tasks/remove', task.id);
            this.handleResult(
              {
                result: {},
                message: i18n.tc('task_manager.not_found', 0, {
                  taskId: task.id,
                  title: task.meta.title
                })
              },
              task
            );
          }
        });
    }
  }

  private handleResult(result: ActionResult<any>, task: Task<TaskMeta>) {
    if (task.meta.ignoreResult) {
      store.commit('tasks/remove', task.id);
      return;
    }

    if (result == null) {
      return;
    }

    const handler =
      this.handler[task.type] ?? this.handler[`${task.type}-${task.id}`];

    if (!handler) {
      notify(
        `No handler found for task '${task.type}' with id ${task.id}`,
        'Tasks',
        Severity.INFO
      );
      store.commit('tasks/remove', task.id);
      return;
    }

    try {
      handler(result, task.meta);
    } catch (e) {
      handler(
        {
          result: {},
          message: i18n.tc('task_manager.error', 0, {
            taskId: task.id,
            title: task.meta.title,
            error: e.message
          })
        },
        task.meta
      );
    }
    store.commit('tasks/remove', task.id);
  }

  private handler: {
    [type: string]: (result: any, meta: any) => void;
  } = {
    [TaskType.TRADE_HISTORY]: this.onTradeHistory
  };

  registerHandler<R, M extends TaskMeta>(
    task: TaskType,
    handlerImpl: (actionResult: ActionResult<R>, meta: M) => void,
    taskId?: string
  ) {
    const identifier = taskId ? `${task}-${taskId}` : task;
    this.handler[identifier] = handlerImpl;
  }

  unregisterHandler(task: TaskType, taskId?: string) {
    const identifier = taskId ? `${task}-${taskId}` : task;
    delete this.handler[identifier];
  }
}

export const taskManager = new TaskManager();
