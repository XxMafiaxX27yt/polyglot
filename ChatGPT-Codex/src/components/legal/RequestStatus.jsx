import { CircleAlert, CircleCheck } from 'lucide-react';

/** Result line for a server request. Text + icon, never colour alone. */
export default function RequestStatus({ request }) {
  if (request.status === 'busy') {
    return (
      <p className="req-status" role="status">
        Sending…
      </p>
    );
  }
  if (request.status === 'error') {
    return (
      <p className="req-status bad" role="alert">
        <CircleAlert size={15} aria-hidden="true" />
        {request.message}
      </p>
    );
  }
  if (request.status === 'ok') {
    return (
      <p className="req-status good" role="status">
        <CircleCheck size={15} aria-hidden="true" />
        {request.message}
      </p>
    );
  }
  return null;
}
