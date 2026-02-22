/* @refresh reload */
import { render } from "solid-js/web";
import "./styles.css";
import App from "./App";
import { initServerUrl } from "./lib/server";

initServerUrl().then(() => {
  render(() => <App />, document.getElementById("root")!);
});
