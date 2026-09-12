<script lang="ts">
  import { i18n } from "../lib/i18n/i18n.svelte";
  import AppBar from "../lib/components/AppBar.svelte";

  const CONTACTO = "contact@appstracta.app";
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("ayuda.titulo")} />
  </header>

  <div class="pantalla-cuerpo">
    <article class="legal">
      <p>{i18n.t("ayuda.intro")}</p>

      <h2>{i18n.t("ayuda.iniciar_titulo")}</h2>
      <p>{i18n.t("ayuda.iniciar_texto")}</p>

      <h2>{i18n.t("ayuda.grupos_titulo")}</h2>
      <p>{i18n.t("ayuda.grupos_texto")}</p>

      <h2>{i18n.t("ayuda.horas_titulo")}</h2>
      <p>{i18n.t("ayuda.horas_texto")}</p>

      <h2>{i18n.t("ayuda.auxiliares_titulo")}</h2>
      <p>{i18n.t("ayuda.auxiliares_texto")}</p>

      <h2>{i18n.t("ayuda.finalizar_titulo")}</h2>
      <p>{i18n.t("ayuda.finalizar_texto")}</p>

      <h2>{i18n.t("ayuda.historial_titulo")}</h2>
      <p>{i18n.t("ayuda.historial_texto")}</p>

      <h2>{i18n.t("ayuda.compartir_titulo")}</h2>
      <p>{i18n.t("ayuda.compartir_texto")}</p>

      <h2>{i18n.t("ayuda.estadisticas_titulo")}</h2>
      <p>{i18n.t("ayuda.estadisticas_texto")}</p>

      <h2>{i18n.t("ayuda.asistencia_titulo")}</h2>
      <p>{i18n.t("ayuda.asistencia_texto")}</p>

      <h2>{i18n.t("ayuda.datos_titulo")}</h2>
      <p>{i18n.t("ayuda.datos_texto")}</p>

      <h2>{i18n.t("ayuda.cuenta_titulo")}</h2>
      <p>{i18n.t("ayuda.cuenta_texto")}</p>

      <h2>{i18n.t("ayuda.panel_titulo")}</h2>
      <p>{i18n.t("ayuda.panel_texto")}</p>

      <h2>{i18n.t("ayuda.contacto_titulo")}</h2>
      <p>{i18n.t("ayuda.contacto_texto")}</p>
      <a class="btn-primario legal-contacto" href={`mailto:${CONTACTO}`}>
        {i18n.t("ayuda.contacto_boton")}
      </a>
    </article>
  </div>
</div>

<style>
  .legal {
    max-width: 44rem;
    line-height: 1.5;
  }
  .legal h2 {
    margin: 1.4rem 0 0.4rem;
    font-size: 1.05rem;
  }
  .legal-contacto {
    display: inline-block;
    margin-top: 8px;
    text-decoration: none;
    text-align: center;
  }
</style>
