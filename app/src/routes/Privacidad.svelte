<script lang="ts">
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { router } from "../lib/stores/router.svelte";

  // Vuelve a la pantalla de cuenta (funciona tanto autenticado como anónimo).
  function volver(): void {
    router.ir("cuenta");
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <div class="appbar">
      <button type="button" class="appbar-menu" onclick={volver}>
        <span class="volver-icono" aria-hidden="true">&larr;</span>
      </button>
      <h1>{i18n.t("privacidad.titulo")}</h1>
    </div>
  </header>

  <div class="pantalla-cuerpo">
    <article class="legal">
      <p class="legal-fecha">Última actualización: 9 de septiembre de 2026</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        <strong>Víctor José Tornet García</strong>, titular del proyecto
        <strong>Appstracta</strong>. Correo de contacto para asuntos de
        privacidad: <strong>contact@appstracta.app</strong>.
      </p>
      <p>
        Cuando un jefe de cuadrilla da de alta a sus trabajadores en la
        aplicación, debe informarles de este tratamiento y de sus derechos.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <p>De los <strong>jefes de cuadrilla</strong> (usuarios de la cuenta):</p>
      <ul>
        <li>Correo electrónico (para el acceso sin contraseña).</li>
        <li>Datos de la suscripción y facturación, gestionados por Stripe.</li>
      </ul>
      <p>De los <strong>trabajadores</strong> dados de alta por el jefe:</p>
      <ul>
        <li>Nombre y alias o código.</li>
        <li>Cuadrilla y, si se indica, código QR e importe de transporte.</li>
        <li>
          Registro diario de asistencia y de las unidades recolectadas en cada
          parte de trabajo.
        </li>
      </ul>

      <h2>3. Finalidad</h2>
      <p>
        Registrar el trabajo a destajo en campo, calcular la asistencia y la
        producción de cada trabajador, y hacer funcionar la aplicación
        (sincronización entre dispositivos del mismo responsable).
      </p>

      <h2>4. Base jurídica</h2>
      <p>
        La gestión de la relación laboral o de servicios entre el trabajador y su
        empleador, y el interés legítimo en organizar y documentar el trabajo de
        la cuadrilla.
      </p>

      <h2>5. Conservación</h2>
      <p>
        Los datos se conservan mientras la cuenta esté activa. El jefe de
        cuadrilla puede <strong>anonimizar</strong> los datos de un trabajador en
        cualquier momento desde su ficha: se borran nombre, alias, código QR y
        transporte, y sus registros pasados quedan asociados a «Trabajador
        eliminado».
      </p>

      <h2>6. Destinatarios</h2>
      <p>
        Proveedores que tratan datos por cuenta del responsable como encargados
        del tratamiento:
      </p>
      <ul>
        <li>MongoDB Atlas — base de datos.</li>
        <li>Railway — servidor de la aplicación.</li>
        <li>Cloudflare — distribución de la aplicación web.</li>
        <li>Resend — envío del correo con el enlace de acceso.</li>
        <li>Stripe — cobro de la suscripción.</li>
      </ul>
      <p>No se ceden ni venden datos a terceros con otros fines.</p>

      <h2>7. Transferencias internacionales</h2>
      <p>
        Algunos de estos proveedores pueden tratar datos fuera del Espacio
        Económico Europeo, en cuyo caso se aplican garantías adecuadas (cláusulas
        contractuales tipo de la Comisión Europea).
      </p>

      <h2>8. Datos en el dispositivo</h2>
      <p>
        Para funcionar sin conexión, la aplicación guarda los datos en el propio
        dispositivo (almacenamiento local del navegador). Se eliminan al cerrar
        sesión.
      </p>

      <h2>9. Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de acceso, rectificación, supresión,
        oposición, limitación y portabilidad escribiendo a
        <strong>contact@appstracta.app</strong>. Si consideras que el tratamiento no
        se ajusta a la normativa, puedes reclamar ante la Agencia Española de
        Protección de Datos (<span class="legal-url">www.aepd.es</span>).
      </p>

      <h2>10. Cambios en esta política</h2>
      <p>
        Cualquier cambio se reflejará en esta misma página, actualizando la fecha
        del encabezado.
      </p>
    </article>

    <button type="button" class="btn-secundario legal-volver" onclick={volver}>
      {i18n.t("privacidad.volver")}
    </button>
  </div>
</div>

<style>
  .legal {
    max-width: 44rem;
    line-height: 1.5;
  }
  .legal-fecha {
    color: var(--c-texto-suave);
    font-size: 0.9rem;
  }
  .legal h2 {
    margin: 1.4rem 0 0.4rem;
    font-size: 1.05rem;
  }
  .legal ul {
    margin: 0.3rem 0;
    padding-inline-start: 1.2rem;
  }
  .legal li {
    margin: 0.2rem 0;
  }
  .legal-url {
    white-space: nowrap;
  }
  .legal-volver {
    width: 100%;
    margin: 1.5rem 0 0.5rem;
  }
</style>
