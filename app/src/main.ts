import "./styles/tokens.css";
import "./styles/app.css";
import { mount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import App from "./App.svelte";

// Service worker: se actualiza solo. La app ya funciona offline tras el primer
// arranque porque todo el estado vive en IndexedDB.
registerSW({ immediate: true });

const target = document.getElementById("app");
if (!target) throw new Error('No se encontro el contenedor #app');

export default mount(App, { target });
