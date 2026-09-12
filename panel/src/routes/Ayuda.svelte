<script lang="ts">
  const CONTACTO = "contact@appstracta.app";

  function escribir(): void {
    window.location.href = `mailto:${CONTACTO}`;
  }
</script>

<h1>Ayuda</h1>

<div class="ayuda">
  <p>
    Guía rápida de cada pantalla del panel. Si tienes dudas que no resuelve
    esta página, escríbenos — abajo tienes el contacto.
  </p>

  <h2>Resumen</h2>
  <p>
    Cifras generales de la empresa: nº de cuadrillas, trabajadores activos,
    partes de este mes y partes todavía abiertos.
  </p>

  <h2>Cuadrillas</h2>
  <p>
    Crea, renombra o elimina cuadrillas (solo se puede eliminar una sin
    trabajadores asignados). El jefe de cuadrilla también puede crear
    cuadrillas desde su app.
  </p>

  <h2>Trabajadores</h2>
  <p>
    Consulta la ficha de cada trabajador, cambia su cuadrilla y exporta el
    listado filtrado a Excel o CSV. Un cambio de cuadrilla lo verá el jefe
    correspondiente en su próxima sincronización.
  </p>

  <h2>Altas</h2>
  <p>
    Completa los datos laborales (DNI, nº de afiliación a la Seguridad
    Social, IBAN, fecha de alta/baja, tipo de contrato, categoría) de cada
    trabajador. Filtra por pendientes, completas o todas.
  </p>

  <h2>Partes</h2>
  <p>
    Consulta los partes de trabajo de todas las cuadrillas, con su detalle de
    anotaciones por trabajador o grupo.
  </p>

  <h2>Asistencia</h2>
  <p>
    Tabla mensual de quién estuvo presente cada día, separada por
    recolectores y auxiliares. Exportable a Excel o CSV.
  </p>

  <h2>Tarifas</h2>
  <p>
    Precio por unidad recolectada, con vigencia por fechas (desde/hasta) para
    cada producto y unidad.
  </p>

  <h2>Liquidación</h2>
  <p>
    Calcula el pago de un periodo (destajo + transporte) a partir de los
    partes y las tarifas vigentes. Se puede filtrar por cuadrilla y exportar
    a PDF, Excel o CSV.
  </p>

  <h2>Equipo</h2>
  <p>
    Invita a jefes de cuadrilla por email, asígnales las cuadrillas que
    lideran y revoca invitaciones pendientes. Si llegas al límite de jefes de
    tu plan, desde aquí puedes cambiar al plan Empresa.
  </p>

  <h2>¿Necesitas ayuda?</h2>
  <p>Escríbenos si algo no funciona como esperas o tienes cualquier duda.</p>
  <button type="button" class="primario" onclick={escribir}>
    Escribir a soporte
  </button>
</div>

<style>
  .ayuda {
    max-width: 44rem;
    line-height: 1.5;
  }
</style>
