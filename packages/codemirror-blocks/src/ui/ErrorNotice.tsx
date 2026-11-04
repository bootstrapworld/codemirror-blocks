import React, { useEffect, useRef, useState } from "react";
import { say } from "../announcer";
import {
  onErrorRecorded,
  recordError,
  wasRecentlyActive,
} from "../state/activityLog";
import { openBugReport } from "./EditorButtons";

type Props = { language: string; blockMode: boolean; code: string };

/**
 * When something goes wrong while a person is using the editor, say so and
 * offer to report it (the report is the one the bug button makes: the code, the
 * recorded actions and the error, in a pre-filled GitHub issue). Nothing is
 * sent unless they choose to; their program is theirs.
 */
export const ErrorNotice = (props: Props) => {
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const hide = () => {
    shownRef.current = false;
    setShown(false);
  };

  useEffect(() => {
    // Errors the page has nothing to do with are none of our business, so only
    // those that follow something done to the editor count.
    const onError = (e: ErrorEvent) => {
      if (wasRecentlyActive()) recordError(e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (wasRecentlyActive()) recordError(e.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const stop = onErrorRecorded(() => {
      // (once, until it is dismissed: one bug can throw many times)
      if (shownRef.current) return;
      shownRef.current = true;
      setShown(true);
      say("Something went wrong. Press the report button to report it.");
    });
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      stop();
    };
  }, []);

  if (!shown) return null;
  return (
    <div className="error-notice" role="alert">
      <span>Something went wrong.</span>
      <button
        className="btn btn-default btn-sm"
        onClick={() => {
          openBugReport(props);
          hide();
        }}
      >
        Report this problem
      </button>
      <button className="btn btn-default btn-sm" onClick={hide}>
        Dismiss
      </button>
    </div>
  );
};
