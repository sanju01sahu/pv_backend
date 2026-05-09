import { Response } from "express";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sendApiResponse<T>(
  res: Response,
  message: string,
  payload?: T,
  status = 200
) {
  if (status === 204) {
    res.set("X-Message", message);
    return res.status(204).send();
  }

  if (payload === undefined) {
    return res.status(status).json({ message });
  }

  if (Array.isArray(payload)) {
    res.set("X-Message", message);
    return res.status(status).json(payload);
  }

  if (isObject(payload)) {
    if ("message" in payload) return res.status(status).json(payload);
    return res.status(status).json({ message, ...payload });
  }

  return res.status(status).json({ message, data: payload });
}
