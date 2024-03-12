import { WsOutputMessage } from "../../../shared/types";

export const partialReply = (msg: string, id: string): WsOutputMessage => {
  return {
    chatId: id,
    content: msg,
    type: "CHAT_PARTIAL_REPLY",
  };
};

export const chatError = (id: string, error: string): WsOutputMessage => {
  return {
    chatId: id,
    type: "CHAT_ERROR",
    error,
  };
};

export const taskStarted = (
  chatId: string,
  title: string,
  taskId: string
): WsOutputMessage => {
  return {
    chatId,
    type: "WORKER_TASK_STARTED",
    title,
    id: taskId,
  };
};

export const taskFinished = (
  chatId: string,
  taskId: string
): WsOutputMessage => {
  return {
    chatId,
    type: "WORKER_TASK_FINISHED",
    id: taskId,
  };
};

export const autoPilotOff = (id: string): WsOutputMessage => {
  return {
    chatId: id,
    type: "CHAT_AUTOPILOT_OFF",
  };
};

export const forcedMessage = (id: string, content: string): WsOutputMessage => {
  return {
    chatId: id,
    content,
    type: "CHAT_FORCED_MESSAGE",
  };
};
