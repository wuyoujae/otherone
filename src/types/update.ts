export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateProgress {
  percent: number;
}

export interface UpdateStatusPayload {
  status: UpdateStatus;
  version?: string;
  percent?: number;
  error?: string;
}
