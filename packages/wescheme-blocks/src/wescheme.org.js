/**
 * This file is meant to be used on the wescheme.org website.
 * It is bundled using the webpack.
 */
import { WeScheme } from "./index";
import { CodeMirrorBlocks, setLogReporter } from "codemirror-blocks";
import "codemirror/lib/codemirror.css";
import "./less/example.less";

const errorForm = document.createElement("div");
errorForm.innerHTML = `<iframe
  name="hidden_iframe"
  id="hidden_iframe"
  style={{ display: "none" }}
></iframe>
<form
  method="post"
  action="https://docs.google.com/forms/d/e/1FAIpQLScJMw-00Kl3bxqp9NhCjijn0I8okCtVeX3VrwT7M1uTsYqBkw/formResponse"
  name="theForm"
  id="errorLogForm"
  target="hidden_iframe"
  style={{ display: "none" }}
>
  <textarea
    name="entry.1311696515"
    id="description"
    defaultValue="Auto-Generated Crash Log"
  />
  <textarea
    name="entry.1568521986"
    id="history"
    defaultValue="default_history"
  />
  <textarea
    name="entry.785063835"
    id="exception"
    defaultValue="default_exception"
  />
  <input type="button" value="Submit" className="submit" />
</form>`;

export default function WeschemeBlocks(container, options) {
  if (!document.contains(errorForm)) {
    document.appendChild(errorForm);
  }

  setLogReporter((history, exception, description) => {
    document.getElementById("description").value = description;
    document.getElementById("history").value = JSON.stringify(history);
    document.getElementById("exception").value = String(exception);
    document.getElementById("errorLogForm").submit();
  });

  return CodeMirrorBlocks(container, options, WeScheme);
}
